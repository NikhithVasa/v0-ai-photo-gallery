import { Pool } from "pg";
import { Signer } from "@aws-sdk/rds-signer";

const RDS_HOST =
  process.env.RDS_HOST ||
  "photo-gallery-postgres-dev.c7o2u4ouqyim.us-east-1.rds.amazonaws.com";
const RDS_PORT = parseInt(process.env.RDS_PORT || "5432");
const RDS_USER = process.env.RDS_USER || "photo_worker";
const RDS_DB = process.env.RDS_DB || "postgres";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const RDS_PASSWORD = process.env.RDS_PASSWORD;
const IAM_TOKEN_REFRESH_MS = 12 * 60 * 1000;

async function generateAuthToken(): Promise<string> {
  const signer = new Signer({
    hostname: RDS_HOST,
    port: RDS_PORT,
    username: RDS_USER,
    region: AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  return signer.getAuthToken();
}

let poolPromise: Promise<Pool> | null = null;
let poolCreatedAt = 0;

async function getPool(): Promise<Pool> {
  const shouldRefresh =
    !poolPromise || Date.now() - poolCreatedAt > IAM_TOKEN_REFRESH_MS;

  if (shouldRefresh) {
    const previousPoolPromise = poolPromise;
    poolCreatedAt = Date.now();
    poolPromise = (async () => {
      const password = RDS_PASSWORD ?? (await generateAuthToken());
      return new Pool({
        host: RDS_HOST,
        port: RDS_PORT,
        user: RDS_USER,
        database: RDS_DB,
        password,
        ssl: {
          rejectUnauthorized: false,
        },
      });
    })();

    previousPoolPromise
      ?.then((pool) => pool.end())
      .catch(() => undefined);
  }

  return poolPromise!;
}

async function resetPool() {
  const previousPoolPromise = poolPromise;
  poolPromise = null;
  poolCreatedAt = 0;
  await previousPoolPromise?.then((pool) => pool.end()).catch(() => undefined);
}

function isAuthTokenError(error: unknown) {
  return (
    error instanceof Error &&
    /PAM authentication failed|password authentication failed|expired/i.test(
      error.message
    )
  );
}

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  try {
    const pool = await getPool();
    const result = await pool.query(text, params);
    return result.rows as T[];
  } catch (error) {
    if (!isAuthTokenError(error)) {
      throw error;
    }

    await resetPool();
    const pool = await getPool();
    const result = await pool.query(text, params);
    return result.rows as T[];
  }
}

export async function queryOne<T>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

import { Pool, type PoolClient, type PoolConfig } from "pg";
import { Signer } from "@aws-sdk/rds-signer";

declare global {
  var pgPool: Pool | undefined;
}

const RDS_HOST =
  process.env.RDS_HOST ||
  "photo-gallery-postgres-dev.c7o2u4ouqyim.us-east-1.rds.amazonaws.com";
const RDS_PORT = parseInt(process.env.RDS_PORT || "5432", 10);
const RDS_USER = process.env.RDS_USER || "photo_worker";
const RDS_DB = process.env.RDS_DB || "postgres";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const RDS_PASSWORD = process.env.RDS_PASSWORD;
const POOL_MAX = Math.max(
  1,
  Number.parseInt(process.env.PG_POOL_MAX || "3", 10) || 3,
);

const poolDefaults = {
  max: POOL_MAX,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 5000,
  application_name: "photo-gallery-web",
} satisfies Partial<PoolConfig>;

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

async function buildPoolConfig(): Promise<PoolConfig> {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ...poolDefaults,
      ssl: { rejectUnauthorized: false },
    };
  }

  const password = RDS_PASSWORD ?? (await generateAuthToken());

  return {
    host: RDS_HOST,
    port: RDS_PORT,
    user: RDS_USER,
    database: RDS_DB,
    password,
    ssl: {
      rejectUnauthorized: false,
    },
    ...poolDefaults,
  };
}

async function createPool() {
  return new Pool(await buildPoolConfig());
}

async function getPool(): Promise<Pool> {
  if (!global.pgPool) {
    global.pgPool = await createPool();
  }

  return global.pgPool;
}

async function resetPool() {
  const existingPool = global.pgPool;
  global.pgPool = undefined;

  if (existingPool) {
    await existingPool.end().catch(() => undefined);
  }
}

function isAuthTokenError(error: unknown) {
  return (
    error instanceof Error &&
    /PAM authentication failed|password authentication failed|expired/i.test(
      error.message,
    )
  );
}

async function runQuery<T>(text: string, params?: unknown[]): Promise<T[]> {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  try {
    return await runQuery<T>(text, params);
  } catch (error) {
    if (!isAuthTokenError(error)) {
      throw error;
    }

    await resetPool();
    return runQuery<T>(text, params);
  }
}

export async function queryOne<T>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

async function runTransaction<T>(
  pool: Pool,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  try {
    const pool = await getPool();
    return await runTransaction(pool, callback);
  } catch (error) {
    if (!isAuthTokenError(error)) {
      throw error;
    }

    await resetPool();
    const pool = await getPool();
    return runTransaction(pool, callback);
  }
}

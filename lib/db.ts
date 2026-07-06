import { Pool, type PoolClient, type PoolConfig } from "pg";
import { Signer } from "@aws-sdk/rds-signer";

declare global {
  var pgPool: Pool | undefined;
  var pgPoolInitPromise: Promise<Pool> | undefined;
}

const RDS_HOST =
  process.env.RDS_HOST ||
  "photo-gallery-postgres-dev.c7o2u4ouqyim.us-east-1.rds.amazonaws.com";
const RDS_PORT = Number.parseInt(process.env.RDS_PORT || "5432", 10);
const RDS_USER = process.env.RDS_USER || "photo_worker";
const RDS_DB = process.env.RDS_DB || "postgres";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const RDS_PASSWORD = process.env.RDS_PASSWORD;

// Serverless: one connection per warm instance. Override with PG_POOL_MAX if needed.
const POOL_MAX = Math.max(
  1,
  Number.parseInt(process.env.PG_POOL_MAX || "1", 10) || 1,
);

const poolDefaults = {
  max: POOL_MAX,
  min: 0,
  idleTimeoutMillis: 1000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true,
  application_name: "photo-gallery-web",
} satisfies Partial<PoolConfig>;

export class DbConnectionLimitError extends Error {
  code = "53300";

  constructor(message = "Database connection limit reached") {
    super(message);
    this.name = "DbConnectionLimitError";
  }
}

export function isConnectionLimitError(error: unknown) {
  if (error instanceof DbConnectionLimitError) return true;

  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "53300"
  );
}

async function generateAuthToken(): Promise<string> {
  // Production can omit RDS_PASSWORD and use short-lived IAM auth tokens instead.
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
function clearPoolGlobals() {
  global.pgPool = undefined;
  global.pgPoolInitPromise = undefined;
}

async function createPool() {
  const pool = new Pool(await buildPoolConfig());

  pool.on("error", (error) => {
    console.error("[db] idle client error", error);
  });

  pool.on("end", () => {
    if (global.pgPool === pool) {
      clearPoolGlobals();
    }
  });

  return pool;
}

async function getPool(): Promise<Pool> {
  if (global.pgPool) {
    return global.pgPool;
  }

  global.pgPoolInitPromise ??= createPool()
    .then((pool) => {
      global.pgPool = pool;
      return pool;
    })
    .catch((error) => {
      clearPoolGlobals();
      throw error;
    });

  return global.pgPoolInitPromise;
}

async function resetPool() {
  const existingPool = global.pgPool;
  clearPoolGlobals();

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

function normalizeQueryError(error: unknown) {
  if (isConnectionLimitError(error)) {
    return new DbConnectionLimitError();
  }

  return error;
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
    if (isConnectionLimitError(error)) {
      throw new DbConnectionLimitError();
    }

    if (!isAuthTokenError(error)) {
      throw normalizeQueryError(error);
    }

    // IAM database tokens expire; reset the warm pool once and retry with a
    // freshly generated token before surfacing the failure.
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
    if (isConnectionLimitError(error)) {
      throw new DbConnectionLimitError();
    }

    if (!isAuthTokenError(error)) {
      throw normalizeQueryError(error);
    }

    await resetPool();
    const pool = await getPool();
    return runTransaction(pool, callback);
  }
}

export function dbErrorResponse(error: unknown) {
  if (isConnectionLimitError(error)) {
    return Response.json(
      { error: "Database is busy. Please retry in a moment." },
      {
        status: 503,
        headers: {
          "Retry-After": "2",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return null;
}

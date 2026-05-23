import { Pool } from "pg";
import { Signer } from "@aws-sdk/rds-signer";

const RDS_HOST = process.env.RDS_HOST || "database-1-instance-1.c7o2u4ouqyim.us-east-1.rds.amazonaws.com";
const RDS_PORT = parseInt(process.env.RDS_PORT || "5432");
const RDS_USER = process.env.RDS_USER || "photo_worker";
const RDS_DB = process.env.RDS_DB || "postgres";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

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

async function getPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = (async () => {
      const token = await generateAuthToken();
      return new Pool({
        host: RDS_HOST,
        port: RDS_PORT,
        user: RDS_USER,
        database: RDS_DB,
        password: token,
        ssl: {
          rejectUnauthorized: false,
        },
      });
    })();
  }
  return poolPromise;
}

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const pool = await getPool();
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

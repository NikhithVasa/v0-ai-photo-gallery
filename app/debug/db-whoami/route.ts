import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

declare global {
  // eslint-disable-next-line no-var
  var debugDbWhoamiPool: Pool | undefined;
}

const pool =
  global.debugDbWhoamiPool ??
  new Pool({
    host:
      process.env.RDS_HOST ||
      "photo-gallery-postgres-dev.c7o2u4ouqyim.us-east-1.rds.amazonaws.com",
    port: Number.parseInt(process.env.RDS_PORT || "5432", 10),
    database: process.env.RDS_DB || "postgres",
    user: process.env.RDS_USER || "photo_worker",
    password: process.env.RDS_PASSWORD,
    max: 1,
    min: 0,
    idleTimeoutMillis: 3000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: true,
    ssl: { rejectUnauthorized: false },
    application_name: "debug-db-whoami",
  });

if (process.env.NODE_ENV !== "production") {
  global.debugDbWhoamiPool = pool;
}

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        current_user,
        session_user,
        current_database() AS database_name,
        current_setting('application_name', true) AS application_name,
        inet_server_addr()::text AS server_addr,
        inet_server_port() AS server_port
    `);

    return NextResponse.json({
      ok: true,
      db: result.rows[0],
      envSeen: {
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        rdsHost: process.env.RDS_HOST || null,
        rdsUser: process.env.RDS_USER || null,
        rdsDb: process.env.RDS_DB || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? String(error),
        code: error?.code,
        envSeen: {
          hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
          rdsHost: process.env.RDS_HOST || null,
          rdsUser: process.env.RDS_USER || null,
          rdsDb: process.env.RDS_DB || null,
        },
      },
      { status: 500 },
    );
  }
}
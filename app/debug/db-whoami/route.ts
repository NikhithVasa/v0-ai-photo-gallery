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
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 3000,
    connectionTimeoutMillis: 5000,
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
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? String(error),
        code: error?.code,
      },
      { status: 500 }
    );
  }
}

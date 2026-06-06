// app/api/debug/db-whoami/route.ts
import { NextResponse } from "next/server";
import { pool } from "@/lib/db"; // adjust path to your db pool

export async function GET() {
  const result = await pool.query(`
    SELECT
      current_user,
      session_user,
      current_database() AS database,
      inet_server_addr() AS server_addr,
      inet_server_port() AS server_port,
      current_setting('application_name', true) AS application_name
  `);

  return NextResponse.json({
    ok: true,
    db: result.rows[0],
  });
}
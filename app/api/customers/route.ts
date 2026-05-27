import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CustomerRow {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  phone: string | null;
  album_count: number | string | null;
  created_at: Date | string | null;
}

function countValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

export async function GET() {
  try {
    const rows = await query<CustomerRow>(`
      SELECT
        c.id,
        c.slug,
        c.name,
        c.email,
        c.phone,
        COUNT(a.id)::int AS album_count,
        c.created_at
      FROM customers c
      LEFT JOIN albums a
        ON a.customer_id = c.id
       AND COALESCE(a.is_deleted, false) = false
      WHERE COALESCE(c.is_deleted, false) = false
      GROUP BY c.id
      ORDER BY c.created_at DESC NULLS LAST, c.name ASC
    `);

    const customers = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      email: row.email,
      phone: row.phone,
      albumCount: countValue(row.album_count),
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at ?? "",
    }));

    return NextResponse.json({ customers });
  } catch (error) {
    console.error("Error fetching customers:", error);

    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}
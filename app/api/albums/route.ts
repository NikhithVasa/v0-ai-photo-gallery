import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { signedUrl } from "@/lib/s3";
import type { AlbumSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AlbumSummaryRow {
  id: string;
  slug: string;
  name: string;
  password_required: boolean | null;
  cover_photo_s3_key: string | null;
  event_count: number | string | null;
  photo_count: number | string | null;
  people_count: number | string | null;
  created_at: Date | string | null;

  customer_id: string | null;
  customer_slug: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
}

function countValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

export async function GET() {
  try {
    const rows = await query<AlbumSummaryRow>(`
      WITH active_albums AS (
        SELECT
          a.id,
          a.slug,
          a.name,
          a.password_required,
          a.cover_photo_s3_key,
          a.created_at,
          a.customer_id
        FROM albums a
        WHERE COALESCE(a.is_deleted, false) = false
      ),

      event_counts AS (
        SELECT
          e.album_id,
          COUNT(*)::int AS event_count
        FROM album_events e
        WHERE COALESCE(e.is_deleted, false) = false
        GROUP BY e.album_id
      ),

      photo_counts AS (
        SELECT
          p.album_id,
          COUNT(*)::int AS photo_count
        FROM photos p
        WHERE COALESCE(p.is_deleted, false) = false
        GROUP BY p.album_id
      ),

      people_counts AS (
        SELECT
          pe.album_id,
          COUNT(*)::int AS people_count
        FROM people pe
        WHERE COALESCE(pe.is_hidden, false) = false
        GROUP BY pe.album_id
      )

      SELECT
        a.id,
        a.slug,
        a.name,
        a.password_required,
        a.cover_photo_s3_key,

        COALESCE(ec.event_count, 0)::int AS event_count,
        COALESCE(pc.photo_count, 0)::int AS photo_count,
        COALESCE(pec.people_count, 0)::int AS people_count,

        a.created_at,

        c.id AS customer_id,
        c.slug AS customer_slug,
        c.name AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone

      FROM active_albums a

      LEFT JOIN event_counts ec
        ON ec.album_id = a.id

      LEFT JOIN photo_counts pc
        ON pc.album_id = a.id

      LEFT JOIN people_counts pec
        ON pec.album_id = a.id

      LEFT JOIN customers c
        ON c.id = a.customer_id
       AND COALESCE(c.is_deleted, false) = false

      ORDER BY a.created_at DESC NULLS LAST, a.name ASC
    `);

    const albums: AlbumSummary[] = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        slug: row.slug,

        // Show customer name on album cards when available.
        // Example: "Nikhith & Vasavi" instead of internal album name "Nikhith".
        name: row.customer_name || row.name,

        passwordRequired: Boolean(row.password_required),
        coverPhotoUrl: await signedUrl(row.cover_photo_s3_key),

        eventCount: countValue(row.event_count),
        photoCount: countValue(row.photo_count),
        peopleCount: countValue(row.people_count),

        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at ?? "",

        customer: row.customer_id
          ? {
              id: row.customer_id,
              slug: row.customer_slug,
              name: row.customer_name ?? "",
              email: row.customer_email,
              phone: row.customer_phone,
            }
          : null,
      }))
    );

    return NextResponse.json({ albums });
  } catch (error) {
    console.error("Error fetching albums:", error);

    return NextResponse.json(
      { error: "Failed to fetch albums" },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { signedUrl } from "@/lib/s3";
import type { AlbumSummary } from "@/lib/types";

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
}

function countValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

export async function GET() {
  try {
    const rows = await query<AlbumSummaryRow>(`
      SELECT
        a.id,
        a.slug,
        a.name,
        a.password_required,
        cover.cover_photo_s3_key,
        COUNT(DISTINCT e.id)::int AS event_count,
        COUNT(DISTINCT CASE
          WHEN COALESCE(p.is_deleted, false) = false THEN p.id
        END)::int AS photo_count,
        COUNT(DISTINCT CASE
          WHEN COALESCE(pe.is_hidden, false) = false THEN pe.id
        END)::int AS people_count,
        a.created_at
      FROM albums a
      LEFT JOIN album_events e ON e.album_id = a.id
      LEFT JOIN photos p ON p.album_id = a.id
      LEFT JOIN people pe ON pe.album_id = a.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          p2.thumbnail_s3_key,
          p2.watermarked_preview_s3_key,
          p2.clean_preview_s3_key,
          p2.original_s3_key
        ) AS cover_photo_s3_key
        FROM photos p2
        WHERE p2.album_id = a.id
          AND COALESCE(p2.is_deleted, false) = false
        ORDER BY p2.created_at ASC
        LIMIT 1
      ) cover ON true
      GROUP BY a.id, cover.cover_photo_s3_key
      ORDER BY a.created_at DESC NULLS LAST, a.name ASC
    `);

    const albums: AlbumSummary[] = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        passwordRequired: Boolean(row.password_required),
        coverPhotoUrl: await signedUrl(row.cover_photo_s3_key),
        eventCount: countValue(row.event_count),
        photoCount: countValue(row.photo_count),
        peopleCount: countValue(row.people_count),
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at ?? "",
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

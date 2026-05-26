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
  created_at: Date | string | null;
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
        a.created_at
      FROM albums a
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          p.thumbnail_s3_key,
          p.watermarked_preview_s3_key,
          p.clean_preview_s3_key,
          p.original_s3_key
        ) AS cover_photo_s3_key
        FROM photos p
        WHERE p.album_id = a.id
          AND COALESCE(p.is_deleted, false) = false
          AND COALESCE(
            p.thumbnail_s3_key,
            p.watermarked_preview_s3_key,
            p.clean_preview_s3_key,
            p.original_s3_key
          ) IS NOT NULL
        ORDER BY RANDOM()
        LIMIT 1
      ) cover ON true
      WHERE COALESCE(a.is_deleted, false) = false
      ORDER BY a.created_at DESC NULLS LAST, a.name ASC
    `);

    const albums: AlbumSummary[] = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        passwordRequired: Boolean(row.password_required),
        coverPhotoUrl: await signedUrl(row.cover_photo_s3_key),

        // Keeping these as 0 so existing AlbumSummary type does not break.
        eventCount: 0,
        photoCount: 0,
        peopleCount: 0,

        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at ?? "",
      }))
    );

    return NextResponse.json(
      { albums },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching albums:", error);

    return NextResponse.json(
      { error: "Failed to fetch albums" },
      { status: 500 }
    );
  }
}
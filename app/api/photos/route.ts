import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { signedUrl, signedDownloadUrl } from "@/lib/s3";
import type { Photo } from "@/lib/types";

interface PhotoRow {
  id: string;
  caption: string | null;
  search_text: string | null;
  original_s3_key: string | null;
  preview_s3_key: string | null;
  thumbnail_s3_key: string | null;
}

export async function GET() {
  try {
    const rows = await query<PhotoRow>(`
      SELECT
        id,
        caption,
        search_text,
        original_s3_key,
        preview_s3_key,
        thumbnail_s3_key
      FROM photos
      ORDER BY created_at DESC
      LIMIT 300
    `);

    const photos: Photo[] = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        caption: row.caption,
        searchText: row.search_text,
        previewUrl: await signedUrl(row.preview_s3_key),
        thumbnailUrl: await signedUrl(row.thumbnail_s3_key),
        downloadUrl: await signedDownloadUrl(row.original_s3_key),
      }))
    );

    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Error fetching photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos" },
      { status: 500 }
    );
  }
}

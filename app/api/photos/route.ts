import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { derivedThumbnailKey, signedUrl } from "@/lib/s3";
import type { Photo } from "@/lib/types";

interface PhotoRow {
  id: string;
  file_name: string | null;
  caption: string | null;
  search_text: string | null;
  original_s3_key: string | null;
  preview_s3_key: string | null;
  thumbnail_s3_key: string | null;
  width: number | null;
  height: number | null;
}

export async function GET() {
  try {
    const rows = await query<PhotoRow>(`
      SELECT
        id,
        file_name,
        caption,
        search_text,
        original_s3_key,
        preview_s3_key,
        thumbnail_s3_key,
        width,
        height
      FROM photos
      ORDER BY created_at DESC
      LIMIT 300
    `);

    const photos: Photo[] = await Promise.all(
      rows.map(async (row) => {
        const thumbnailKey =
          derivedThumbnailKey(row.original_s3_key, row.thumbnail_s3_key) ??
          row.preview_s3_key ??
          row.original_s3_key;
        const thumbnailUrl = await signedUrl(thumbnailKey);

        return {
          id: row.id,
          fileName: row.file_name,
          caption: row.caption,
          searchText: row.search_text,
          previewUrl: null,
          thumbnailUrl,
          downloadUrl: null,
          width: row.width,
          height: row.height,
        };
      })
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

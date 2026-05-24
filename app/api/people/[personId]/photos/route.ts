import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { derivedThumbnailKey, listS3Keys, signedUrl } from "@/lib/s3";

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
  person_search_text?: string | null;
  qwen_description?: string | null;
}

interface Props {
  params: Promise<{ personId: string }>;
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { personId } = await params;

    const rows = await query<PhotoRow>(
      `
      SELECT DISTINCT
        p.id,
        p.file_name,
        p.caption,
        p.search_text,
        p.original_s3_key,
        p.preview_s3_key,
        p.thumbnail_s3_key,
        p.width,
        p.height,
        p.created_at,
        pp.search_text AS person_search_text,
        pp.qwen_description
      FROM photo_people pp
      JOIN photos p ON p.id = pp.photo_id
      WHERE pp.person_id = $1
      ORDER BY p.created_at DESC
    `,
      [personId]
    );
    const thumbnailKeys = await listS3Keys(
      process.env.THUMB_PREFIX || "thumbnails/pilot-100/"
    );
    const thumbnailKeySet = new Set(thumbnailKeys);

    const photos = await Promise.all(
      rows.map(async (row) => {
        const derivedKey = derivedThumbnailKey(
          row.original_s3_key,
          row.thumbnail_s3_key
        );
        const gridKey =
          derivedKey && thumbnailKeySet.has(derivedKey)
            ? derivedKey
            : row.preview_s3_key ?? row.original_s3_key;
        const thumbnailUrl = await signedUrl(gridKey);

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
          personSearchText: row.person_search_text,
          qwenDescription: row.qwen_description,
        };
      })
    );

    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Error fetching person photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos" },
      { status: 500 }
    );
  }
}

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
        p.caption,
        p.search_text,
        p.original_s3_key,
        p.preview_s3_key,
        p.thumbnail_s3_key,
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

    const photos: Photo[] = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        caption: row.caption,
        searchText: row.search_text,
        previewUrl: await signedUrl(row.preview_s3_key ?? row.original_s3_key),
        thumbnailUrl: await signedUrl(
          row.thumbnail_s3_key ?? row.preview_s3_key ?? row.original_s3_key
        ),
        downloadUrl: await signedDownloadUrl(row.original_s3_key),
        personSearchText: row.person_search_text,
        qwenDescription: row.qwen_description,
      }))
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

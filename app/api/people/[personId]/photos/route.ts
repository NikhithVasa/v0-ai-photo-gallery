import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { signedUrl } from "@/lib/s3";
import {
  getAuthAccess,
  unauthorizedResponse,
} from "@/lib/auth-access";

interface PhotoRow {
  id: string;
  file_name: string | null;
  caption: string | null;
  search_text: string | null;
  original_s3_key: string | null;
  ai_input_s3_key: string | null;
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
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();

    const { personId } = await params;

    const rows = await query<PhotoRow>(
      `
      SELECT DISTINCT
        p.id,
        p.file_name,
        p.caption,
        p.search_text,
        p.original_s3_key,
        p.ai_input_s3_key,
        p.thumbnail_s3_key,
        p.width,
        p.height,
        p.created_at,
        pp.search_text AS person_search_text,
        pp.qwen_description
      FROM photo_people pp
      JOIN photos p ON p.id = pp.photo_id
      JOIN albums a
        ON a.id = p.album_id
       AND COALESCE(a.is_deleted, false) = false
      WHERE pp.person_id = $1
        AND COALESCE(p.is_deleted, false) = false
        AND (
          $2::boolean = true
          OR a.customer_id = ANY($3::uuid[])
        )
      ORDER BY p.created_at DESC
    `,
      [personId, access.isAdmin, access.customerIds]
    );
    const photos = await Promise.all(
      rows.map(async (row) => {
        const thumbnailUrl = await signedUrl(row.ai_input_s3_key);

        return {
          id: row.id,
          fileName: row.file_name,
          caption: row.caption,
          searchText: row.search_text,
          previewUrl: thumbnailUrl,
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

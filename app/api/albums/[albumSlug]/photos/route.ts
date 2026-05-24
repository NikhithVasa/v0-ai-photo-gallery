import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { toPhoto, type PhotoRow } from "@/lib/gallery-data";
import type { Photo } from "@/lib/types";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get("event") || null;

    const rows = await query<PhotoRow>(
      `
      SELECT
        p.id,
        p.album_id,
        a.slug AS album_slug,
        p.album_event_id,
        p.file_name,
        p.caption,
        p.search_text,
        p.width,
        p.height,
        p.original_s3_key,
        p.clean_preview_s3_key,
        p.watermarked_preview_s3_key,
        p.thumbnail_s3_key,
        p.annotated_s3_key,
        e.slug AS event_slug,
        e.name AS event_name
      FROM photos p
      JOIN albums a ON a.id = p.album_id
      JOIN album_events e ON e.id = p.album_event_id
      WHERE a.slug = $1
        AND ($2::text IS NULL OR e.slug = $2)
        AND COALESCE(p.is_deleted, false) = false
      ORDER BY p.created_at ASC
      `,
      [albumSlug, eventSlug]
    );

    const photos: Photo[] = await Promise.all(rows.map(toPhoto));
    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Error fetching album photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch album photos" },
      { status: 500 }
    );
  }
}

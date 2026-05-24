import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { signedPhotoUrlBundle, type PhotoRow } from "@/lib/gallery-data";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const body = (await request.json()) as {
      photoIds?: unknown;
      ids?: unknown;
    };
    const rawIds = Array.isArray(body.photoIds)
      ? body.photoIds
      : Array.isArray(body.ids)
        ? body.ids
        : [];
    const photoIds = rawIds
      .filter((id): id is string => typeof id === "string" && isUuid(id))
      .slice(0, 12);

    if (!photoIds.length) {
      return NextResponse.json({ urls: {}, photos: [] });
    }

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
        AND p.id = ANY($2::uuid[])
        AND COALESCE(p.is_deleted, false) = false
      `,
      [albumSlug, photoIds]
    );

    const photos = await Promise.all(rows.map(signedPhotoUrlBundle));
    const urls = Object.fromEntries(
      photos.map((photo) => [
        photo.id,
        {
          previewUrl: photo.previewUrl,
          downloadUrl: photo.downloadUrl,
          thumbnailUrl: photo.thumbnailUrl,
        },
      ])
    );

    return NextResponse.json({ urls, photos });
  } catch (error) {
    console.error("Error signing album photo URLs:", error);
    return NextResponse.json(
      { error: "Failed to sign photo URLs" },
      { status: 500 }
    );
  }
}

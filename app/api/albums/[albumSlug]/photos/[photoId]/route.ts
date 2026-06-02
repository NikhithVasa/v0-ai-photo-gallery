import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { deleteS3Object } from "@/lib/s3";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";

interface Props {
  params: Promise<{ albumSlug: string; photoId: string }>;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

interface PhotoDeleteRow {
  id: string;
  original_s3_key: string | null;
  ai_input_s3_key: string | null;
  clean_preview_s3_key: string | null;
  watermarked_preview_s3_key: string | null;
  thumbnail_s3_key: string | null;
  annotated_s3_key: string | null;
}

export async function DELETE(_request: Request, { params }: Props) {
  try {
    const { albumSlug, photoId } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    if (!isUuid(photoId)) {
      return NextResponse.json({ error: "Invalid photo id" }, { status: 400 });
    }

    const photo = await queryOne<PhotoDeleteRow>(
      `
      UPDATE photos p
      SET is_deleted = true,
          deleted_at = now(),
          updated_at = now()
      FROM albums a
      WHERE p.album_id = a.id
        AND a.slug = $1
        AND p.id = $2::uuid
        AND COALESCE(p.is_deleted, false) = false
      RETURNING
        p.id,
        p.original_s3_key,
        p.ai_input_s3_key,
        p.clean_preview_s3_key,
        p.watermarked_preview_s3_key,
        p.thumbnail_s3_key,
        p.annotated_s3_key
      `,
      [albumSlug, photoId]
    );

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    await Promise.allSettled([
      deleteS3Object(photo.original_s3_key),
      deleteS3Object(photo.ai_input_s3_key),
      deleteS3Object(photo.clean_preview_s3_key),
      deleteS3Object(photo.watermarked_preview_s3_key),
      deleteS3Object(photo.thumbnail_s3_key),
      deleteS3Object(photo.annotated_s3_key),
    ]);

    return NextResponse.json({ ok: true, photoId: photo.id });
  } catch (error) {
    console.error("Error deleting album photo:", error);
    return NextResponse.json(
      { error: "Failed to delete photo" },
      { status: 500 }
    );
  }
}

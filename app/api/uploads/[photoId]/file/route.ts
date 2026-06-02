import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { s3 } from "@/lib/s3";
import { requirePhotoIdsAccess } from "@/lib/auth-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ photoId: string }>;
}

interface PhotoUploadRow {
  id: string;
  original_s3_key: string;
  upload_status: string | null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    value
  );
}

function isAllowedUploadKey(value: string) {
  return (
    value.startsWith("albums/") &&
    value.includes("/originals/") &&
    !value.includes("..") &&
    !value.startsWith("/") &&
    !value.endsWith("/")
  );
}

function isAllowedContentType(value: string) {
  return value.startsWith("image/") || value === "application/octet-stream";
}

export async function PUT(request: Request, { params }: Props) {
  try {
    const { photoId } = await params;
    if (!isUuid(photoId)) {
      return NextResponse.json({ error: "Invalid photo id" }, { status: 400 });
    }

    const accessDenied = await requirePhotoIdsAccess([photoId]);
    if (accessDenied) return accessDenied;

    const contentType =
      request.headers.get("content-type") || "application/octet-stream";
    if (!isAllowedContentType(contentType)) {
      return NextResponse.json(
        { error: "Only image uploads are supported" },
        { status: 400 }
      );
    }

    const photo = await queryOne<PhotoUploadRow>(
      `
      SELECT id, original_s3_key, upload_status
      FROM photos
      WHERE id = $1::uuid
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      `,
      [photoId]
    );

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    if (!isAllowedUploadKey(photo.original_s3_key)) {
      return NextResponse.json(
        { error: "Invalid upload destination" },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await request.arrayBuffer());
    if (!bytes.length) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: photo.original_s3_key,
        Body: bytes,
        ContentType: contentType,
      })
    );

    return NextResponse.json({
      ok: true,
      photoId: photo.id,
      key: photo.original_s3_key,
    });
  } catch (error) {
    console.error("Error uploading photo through server:", error);
    return NextResponse.json(
      { error: "Failed to upload photo" },
      { status: 500 }
    );
  }
}

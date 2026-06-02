import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { signedDownloadUrl, signedUrl } from "@/lib/s3";
import { requireAdminAccess } from "@/lib/auth-access";

interface PhotoUrlRow {
  id: string;
  file_name: string | null;
  original_s3_key: string | null;
  preview_s3_key: string | null;
  thumbnail_s3_key: string | null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isAllowedS3PhotoKey(value: string) {
  const originalPrefix = process.env.ORIGINAL_PREFIX || "originals/pilot-100/";
  return value.startsWith(originalPrefix) && /\.(avif|gif|jpe?g|png|webp)$/i.test(value);
}

function fileNameFromKey(key: string) {
  return key.split("/").pop() || "photo.jpg";
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminAccess();
    if (admin.response) return admin.response;

    const body = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 8)
      : [];

    if (!ids.length) {
      return NextResponse.json({ photos: [] });
    }

    const uuidIds = ids.filter(isUuid);
    const s3PhotoKeys = ids
      .filter((id) => id.startsWith("s3:"))
      .map((id) => id.slice(3))
      .filter(isAllowedS3PhotoKey);

    const rows = await query<PhotoUrlRow>(
      `
      SELECT
        id,
        file_name,
        original_s3_key,
        preview_s3_key,
        thumbnail_s3_key
      FROM photos
      WHERE id = ANY($1::uuid[])
    `,
      [uuidIds]
    );

    const dbPhotos = await Promise.all(
      rows.map(async (row) => {
        const previewKey =
          row.preview_s3_key ?? row.original_s3_key ?? row.thumbnail_s3_key;
        const [previewUrl, downloadUrl] = await Promise.all([
          signedUrl(previewKey),
          signedDownloadUrl(row.original_s3_key, row.file_name ?? undefined),
        ]);

        return {
          id: row.id,
          previewUrl,
          downloadUrl,
        };
      })
    );
    const s3Photos = await Promise.all(
      s3PhotoKeys.map(async (key) => {
        const [previewUrl, downloadUrl] = await Promise.all([
          signedUrl(key),
          signedDownloadUrl(key, fileNameFromKey(key)),
        ]);

        return {
          id: `s3:${key}`,
          previewUrl,
          downloadUrl,
        };
      })
    );

    return NextResponse.json({ photos: [...dbPhotos, ...s3Photos] });
  } catch (error) {
    console.error("Error signing photo URLs:", error);
    return NextResponse.json(
      { error: "Failed to sign photo URLs" },
      { status: 500 }
    );
  }
}

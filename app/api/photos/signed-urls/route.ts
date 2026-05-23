import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { signedDownloadUrl, signedUrl } from "@/lib/s3";

interface PhotoUrlRow {
  id: string;
  file_name: string | null;
  original_s3_key: string | null;
  preview_s3_key: string | null;
  thumbnail_s3_key: string | null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 8)
      : [];

    if (!ids.length) {
      return NextResponse.json({ photos: [] });
    }

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
      [ids]
    );

    const photos = await Promise.all(
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

    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Error signing photo URLs:", error);
    return NextResponse.json(
      { error: "Failed to sign photo URLs" },
      { status: 500 }
    );
  }
}

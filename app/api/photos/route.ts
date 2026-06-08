import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { listS3Keys, signedUrl } from "@/lib/s3";
import { requireAdminAccess } from "@/lib/auth-access";

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
}

function isImageKey(key: string) {
  return /\.(avif|gif|jpe?g|png|webp)$/i.test(key);
}

function fileNameFromKey(key: string) {
  return key.split("/").pop() || key;
}

export async function GET() {
  try {
    const admin = await requireAdminAccess();
    if (admin.response) return admin.response;

    const originalPrefix = process.env.ORIGINAL_PREFIX || "originals/pilot-100/";
    const [rows, originalKeys] = await Promise.all([
      query<PhotoRow>(`
        SELECT
          id,
          file_name,
          caption,
          search_text,
          original_s3_key,
          ai_input_s3_key,
          thumbnail_s3_key,
          width,
          height
        FROM photos
      `),
      listS3Keys(originalPrefix),
    ]);

    const rowsByOriginalKey = new Map(
      rows
        .filter((row) => row.original_s3_key)
        .map((row) => [row.original_s3_key as string, row])
    );
    const rowsByFileName = new Map(
      rows
        .filter((row) => row.file_name)
        .map((row) => [row.file_name as string, row])
    );
    const photos = await Promise.all(
      originalKeys.filter(isImageKey).map(async (originalKey) => {
        const fileName = fileNameFromKey(originalKey);
        const row = rowsByOriginalKey.get(originalKey) ?? rowsByFileName.get(fileName);
        const gridKey = row?.ai_input_s3_key ?? null;
        const thumbnailUrl = await signedUrl(gridKey);

        return {
          id: row?.id ?? `s3:${originalKey}`,
          fileName: row?.file_name ?? fileName,
          caption: row?.caption ?? null,
          searchText: row?.search_text ?? null,
          previewUrl: null,
          thumbnailUrl,
          downloadUrl: null,
          width: row?.width ?? null,
          height: row?.height ?? null,
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

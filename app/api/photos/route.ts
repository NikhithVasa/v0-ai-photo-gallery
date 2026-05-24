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
}

function isImageKey(key: string) {
  return /\.(avif|gif|jpe?g|png|webp)$/i.test(key);
}

function fileNameFromKey(key: string) {
  return key.split("/").pop() || key;
}

export async function GET() {
  try {
    const originalPrefix = process.env.ORIGINAL_PREFIX || "originals/pilot-100/";
    const thumbnailPrefix = process.env.THUMB_PREFIX || "thumbnails/pilot-100/";
    const [rows, originalKeys, thumbnailKeys] = await Promise.all([
      query<PhotoRow>(`
        SELECT
          id,
          file_name,
          caption,
          search_text,
          original_s3_key,
          preview_s3_key,
          thumbnail_s3_key,
          width,
          height
        FROM photos
      `),
      listS3Keys(originalPrefix),
      listS3Keys(thumbnailPrefix),
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
    const thumbnailKeySet = new Set(thumbnailKeys);

    const photos = await Promise.all(
      originalKeys.filter(isImageKey).map(async (originalKey) => {
        const fileName = fileNameFromKey(originalKey);
        const row = rowsByOriginalKey.get(originalKey) ?? rowsByFileName.get(fileName);
        const derivedKey = derivedThumbnailKey(originalKey, row?.thumbnail_s3_key);
        const gridKey =
          derivedKey && thumbnailKeySet.has(derivedKey)
            ? derivedKey
            : row?.preview_s3_key ?? originalKey;
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

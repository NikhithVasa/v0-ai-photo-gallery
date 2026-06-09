import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePhotoIdsAccess } from "@/lib/auth-access";

interface ProcessingStatusBody {
  photoIds?: unknown;
}

interface ProcessingStatusRow {
  id: string;
  upload_status: string | null;
  compression_status: string | null;
  watermark_status: string | null;
  face_index_status: string | null;
  qwen_status: string | null;
  search_index_status: string | null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalized(value: string | null) {
  return (value || "").toLowerCase();
}

function isFailed(value: string | null) {
  return ["failed", "error"].includes(normalized(value));
}

function isDone(value: string | null) {
  return ["completed", "skipped"].includes(normalized(value));
}

function customerStatus(row: ProcessingStatusRow) {
  if (normalized(row.upload_status) !== "completed") return "uploaded";

  if (
    [
      row.compression_status,
      row.watermark_status,
      row.face_index_status,
      row.qwen_status,
      row.search_index_status,
    ].some(isFailed)
  ) {
    return "failed";
  }

  if (
    isDone(row.compression_status) &&
    isDone(row.watermark_status) &&
    isDone(row.face_index_status) &&
    isDone(row.qwen_status) &&
    isDone(row.search_index_status)
  ) {
    return "ready";
  }

  return "processing";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProcessingStatusBody;
    const photoIds = Array.isArray(body.photoIds)
      ? body.photoIds.filter(
          (id): id is string => typeof id === "string" && isUuid(id),
        )
      : [];

    if (!photoIds.length) {
      return NextResponse.json({ error: "photoIds are required" }, { status: 400 });
    }

    const accessDenied = await requirePhotoIdsAccess(photoIds);
    if (accessDenied) return accessDenied;

    const rows = await query<ProcessingStatusRow>(
      `
      SELECT
        id,
        upload_status,
        compression_status,
        watermark_status,
        face_index_status,
        qwen_status,
        search_index_status
      FROM photos
      WHERE id = ANY($1::uuid[])
        AND COALESCE(is_deleted, false) = false
      `,
      [photoIds],
    );

    const photos = rows.map((row) => ({
      photoId: row.id,
      status: customerStatus(row),
      uploadStatus: row.upload_status,
      compressionStatus: row.compression_status,
      watermarkStatus: row.watermark_status,
      faceIndexStatus: row.face_index_status,
      qwenStatus: row.qwen_status,
      searchIndexStatus: row.search_index_status,
    }));

    const readyCount = photos.filter((photo) => photo.status === "ready").length;
    const failedCount = photos.filter((photo) => photo.status === "failed").length;
    const processingCount = photos.filter(
      (photo) => photo.status === "processing",
    ).length;

    return NextResponse.json({
      photos,
      summary: {
        total: photos.length,
        readyCount,
        failedCount,
        processingCount,
      },
    });
  } catch (error) {
    console.error("Error loading processing status:", error);
    return NextResponse.json(
      { error: "Failed to load processing status" },
      { status: 500 },
    );
  }
}

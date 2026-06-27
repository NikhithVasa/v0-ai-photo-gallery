import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePhotoIdsAccess } from "@/lib/auth-access";

interface CompleteRequestBody {
  photoIds?: unknown;
  runAi?: unknown;
}

interface PreviewCandidateRow {
  id: string;
  file_name: string | null;
  original_s3_key: string | null;
  source_s3_key: string | null;
}

const RAW_PREVIEW_EXTS = new Set([
  ".nef",
  ".cr2",
  ".cr3",
  ".arw",
  ".dng",
  ".raf",
  ".orf",
  ".rw2",
]);

const WEB_RENDERABLE_IMAGE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".jpe",
  ".jfif",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".bmp",
]);

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({ unserializable: true, error: String(error) });
  }
}

function uploadCompleteLog(event: string, fields: Record<string, unknown> = {}) {
  console.log(`[UPLOAD_COMPLETE] ${event} ${safeJson(fields)}`);
}

function parseJsonPayload(text: string) {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { rawBody: text.slice(0, 4000) };
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function extensionFromPath(value: string | null | undefined) {
  if (!value) return "";
  const path = value.split(/[?#]/, 1)[0] ?? value;
  const name = path.split("/").pop() ?? path;
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : "";
}

function needsRawPreview(row: PreviewCandidateRow) {
  const ext =
    extensionFromPath(row.file_name) ||
    extensionFromPath(row.original_s3_key) ||
    extensionFromPath(row.source_s3_key);

  if (RAW_PREVIEW_EXTS.has(ext)) return true;
  if (WEB_RENDERABLE_IMAGE_EXTS.has(ext)) return false;
  return Boolean(ext);
}

async function photoIdsNeedingRawPreview(photoIds: string[]) {
  const rows = await query<PreviewCandidateRow>(
    `
    SELECT id::text, file_name, original_s3_key, source_s3_key
    FROM photos
    WHERE id = ANY($1::uuid[])
      AND COALESCE(is_deleted, false) = false
    `,
    [photoIds]
  );

  const ids = rows.filter(needsRawPreview).map((row) => row.id);
  uploadCompleteLog("photo_worker_candidate_filter", {
    requestedPhotoIds: photoIds,
    candidatePhotoIds: ids,
    rows: rows.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      originalExt: extensionFromPath(row.original_s3_key),
      sourceExt: extensionFromPath(row.source_s3_key),
      fileExt: extensionFromPath(row.file_name),
      needsRawPreview: needsRawPreview(row),
    })),
  });

  return ids;
}

async function invokePhotoWorker(photoIds: string[]) {
  const startedAt = Date.now();
  const lambdaUrl =
    process.env.PHOTO_WORKER_LAMBDA_URL?.trim() ||
    process.env.RAW_PREVIEW_LAMBDA_URL?.trim();

  if (!lambdaUrl) {
    uploadCompleteLog("photo_worker_not_configured", { photoIds });
    return { configured: false };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const adminKey =
    process.env.PHOTO_WORKER_ADMIN_KEY?.trim() ||
    process.env.RAW_PREVIEW_WORKER_ADMIN_KEY?.trim() ||
    process.env.ADMIN_KEY?.trim();
  if (adminKey) headers["x-admin-key"] = adminKey;

  const timeoutMs = Math.max(
    1000,
    Number.parseInt(process.env.PHOTO_WORKER_INVOKE_TIMEOUT_MS || "30000", 10) ||
      30000,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const requestBody = { action: "render_raw_previews", photoIds };

  uploadCompleteLog("photo_worker_invoke_start", {
    lambdaUrl,
    photoIds,
    requestBody,
    timeoutMs,
    adminKeyConfigured: Boolean(adminKey),
  });

  try {
    const response = await fetch(lambdaUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const responseText = await response.text();
    const payload = parseJsonPayload(responseText);
    const durationMs = Date.now() - startedAt;

    uploadCompleteLog("photo_worker_invoke_done", {
      lambdaUrl,
      status: response.status,
      responseOk: response.ok,
      payloadOk: payload.ok,
      durationMs,
      responseBody: payload,
    });

    return {
      configured: true,
      ok: response.ok && payload.ok !== false,
      status: response.status,
      payload,
      durationMs,
    };
  } catch (error) {
    uploadCompleteLog("photo_worker_invoke_error", {
      lambdaUrl,
      photoIds,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined,
    });
    return {
      configured: true,
      ok: false,
      error: error instanceof Error ? error.message : "Photo worker invocation failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const body = (await request.json()) as CompleteRequestBody;
    uploadCompleteLog("request_received", {
      body,
      contentType: request.headers.get("content-type"),
      referer: request.headers.get("referer"),
      userAgent: request.headers.get("user-agent"),
    });

    const photoIds = Array.isArray(body.photoIds)
      ? body.photoIds.filter(
          (id): id is string => typeof id === "string" && isUuid(id)
        )
      : [];

    uploadCompleteLog("photo_ids_normalized", {
      rawPhotoIds: body.photoIds,
      validPhotoIds: photoIds,
      validCount: photoIds.length,
    });

    if (!photoIds.length) {
      uploadCompleteLog("request_rejected", {
        reason: "photoIds are required",
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json({ error: "photoIds are required" }, { status: 400 });
    }

    const accessDenied = await requirePhotoIdsAccess(photoIds);
    if (accessDenied) {
      uploadCompleteLog("access_denied", {
        photoIds,
        durationMs: Date.now() - startedAt,
      });
      return accessDenied;
    }

    uploadCompleteLog("access_granted", { photoIds });

    const runAi = body.runAi !== false;
    uploadCompleteLog("db_mark_upload_complete_start", { photoIds, runAi });

    await query(
      `
      UPDATE photos
      SET upload_status = 'completed',
          face_index_status = CASE WHEN $2::boolean THEN face_index_status ELSE 'skipped' END,
          qwen_status = CASE WHEN $2::boolean THEN qwen_status ELSE 'skipped' END,
          search_index_status = CASE WHEN $2::boolean THEN search_index_status ELSE 'skipped' END,
          updated_at = now()
      WHERE id = ANY($1::uuid[])
      `,
      [photoIds, runAi]
    );

    uploadCompleteLog("db_mark_upload_complete_done", { photoIds, runAi });

    uploadCompleteLog("db_upsert_compress_jobs_start", { photoIds });

    await query(
      `
      INSERT INTO processing_jobs(
        album_id,
        album_event_id,
        photo_id,
        job_type,
        status,
        created_at,
        updated_at
      )
      SELECT
        album_id,
        album_event_id,
        id,
        'compress_photo',
        'pending',
        now(),
        now()
      FROM photos
      WHERE id = ANY($1::uuid[])
      ON CONFLICT(photo_id, job_type) DO UPDATE SET
        status = 'pending',
        error_message = NULL,
        updated_at = now()
      `,
      [photoIds]
    );

    uploadCompleteLog("db_upsert_compress_jobs_done", { photoIds });

    if (runAi) {
      uploadCompleteLog("db_upsert_face_jobs_start", { photoIds });
      await query(
        `
        INSERT INTO processing_jobs(
          album_id,
          album_event_id,
          photo_id,
          job_type,
          status,
          created_at,
          updated_at
        )
        SELECT
          album_id,
          album_event_id,
          id,
          'face_index_photo',
          'pending',
          now(),
          now()
        FROM photos
        WHERE id = ANY($1::uuid[])
        ON CONFLICT(photo_id, job_type) DO UPDATE SET
          status = 'pending',
          error_message = NULL,
          updated_at = now()
        `,
        [photoIds]
      );
      uploadCompleteLog("db_upsert_face_jobs_done", { photoIds });
    } else {
      uploadCompleteLog("db_upsert_face_jobs_skipped", { photoIds, runAi });
    }

    const rawPreviewPhotoIds = await photoIdsNeedingRawPreview(photoIds);
    const photoWorker = rawPreviewPhotoIds.length
      ? await invokePhotoWorker(rawPreviewPhotoIds)
      : {
          configured: Boolean(
            process.env.PHOTO_WORKER_LAMBDA_URL?.trim() ||
              process.env.RAW_PREVIEW_LAMBDA_URL?.trim(),
          ),
          skipped: true,
          reason: "all_uploaded_images_web_renderable",
        };

    uploadCompleteLog("request_done", {
      photoIds,
      rawPreviewPhotoIds,
      runAi,
      photoWorker,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: true, photoWorker });
  } catch (error) {
    console.error("[UPLOAD_COMPLETE] request_error", {
      durationMs: Date.now() - startedAt,
      error,
    });
    return NextResponse.json(
      { error: "Failed to complete uploads" },
      { status: 500 }
    );
  }
}

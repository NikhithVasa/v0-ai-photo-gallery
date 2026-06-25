import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePhotoIdsAccess } from "@/lib/auth-access";

interface CompleteRequestBody {
  photoIds?: unknown;
  runAi?: unknown;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function invokePhotoWorker(photoIds: string[]) {
  const lambdaUrl =
    process.env.PHOTO_WORKER_LAMBDA_URL?.trim() ||
    process.env.RAW_PREVIEW_LAMBDA_URL?.trim();

  if (!lambdaUrl) {
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

  try {
    const response = await fetch(lambdaUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "render_raw_previews", photoIds }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    return {
      configured: true,
      ok: response.ok && payload.ok !== false,
      status: response.status,
      payload,
    };
  } catch (error) {
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
  try {
    const body = (await request.json()) as CompleteRequestBody;
    const photoIds = Array.isArray(body.photoIds)
      ? body.photoIds.filter(
          (id): id is string => typeof id === "string" && isUuid(id)
        )
      : [];

    if (!photoIds.length) {
      return NextResponse.json({ error: "photoIds are required" }, { status: 400 });
    }

    const accessDenied = await requirePhotoIdsAccess(photoIds);
    if (accessDenied) return accessDenied;

    const runAi = body.runAi !== false;

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

    if (runAi) {
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
    }

    const photoWorker = await invokePhotoWorker(photoIds);

    return NextResponse.json({ ok: true, photoWorker });
  } catch (error) {
    console.error("Error completing uploads:", error);
    return NextResponse.json(
      { error: "Failed to complete uploads" },
      { status: 500 }
    );
  }
}

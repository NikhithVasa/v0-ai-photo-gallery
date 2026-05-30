import { NextResponse } from "next/server";
import { query } from "@/lib/db";

interface CompleteRequestBody {
  photoIds?: unknown;
  runAi?: unknown;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error completing uploads:", error);
    return NextResponse.json(
      { error: "Failed to complete uploads" },
      { status: 500 }
    );
  }
}

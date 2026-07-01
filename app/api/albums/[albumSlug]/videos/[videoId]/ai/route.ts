import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { signedObjectUrl } from "@/lib/s3";

const DEFAULT_AI_WORKER_LAMBDA_URL =
  "https://ytwjenx44g62fzjrrb2wdad6gi0pnbrt.lambda-url.us-east-1.on.aws/";

interface Props {
  params: Promise<{ albumSlug: string; videoId: string }>;
}

interface RunVideoAiBody {
  personId?: unknown;
  personIds?: unknown;
  selfieS3Keys?: unknown;
}

interface VideoRow {
  id: string;
  album_id: string;
  album_event_id: string | null;
  customer_id: string | null;
  file_name: string | null;
  original_s3_key: string | null;
  storage_album_slug: string | null;
  storage_event_slug: string | null;
  event_slug: string | null;
}

interface PersonTargetRow {
  id: string;
  cover_face_s3_key: string | null;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function uuidArray(value: unknown) {
  if (Array.isArray(value)) return value.filter(isUuid);
  if (isUuid(value)) return [value];
  return [];
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function aiWorkerAdminKey() {
  return (
    process.env.ADMIN_KEY ||
    process.env.AI_WORKER_ADMIN_KEY ||
    process.env.RUNPOD_ADMIN_KEY ||
    ""
  ).trim();
}

function faceOccurrenceLambdaUrl() {
  return (
    process.env.FACE_OCCURRENCE_LAMBDA_URL?.trim() ||
    process.env.AI_WORKER_LAMBDA_URL?.trim() ||
    DEFAULT_AI_WORKER_LAMBDA_URL
  );
}

function lambdaJobRecord(payload: Record<string, unknown>) {
  const record = payload.runpodJobRecord;
  return record && typeof record === "object" ? (record as Record<string, unknown>) : null;
}

function lambdaFaceOccurrence(payload: Record<string, unknown>) {
  const occurrence = payload.faceOccurrence;
  return occurrence && typeof occurrence === "object" ? (occurrence as Record<string, unknown>) : null;
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug, videoId } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json()) as RunVideoAiBody;
    const personIds = uuidArray(body.personIds).concat(uuidArray(body.personId));
    const uniquePersonIds = [...new Set(personIds)];
    const selfieS3Keys = stringArray(body.selfieS3Keys);

    const video = await queryOne<VideoRow>(
      `
      SELECT
        v.id,
        v.album_id,
        v.album_event_id,
        v.customer_id,
        v.file_name,
        v.original_s3_key,
        v.storage_album_slug,
        v.storage_event_slug,
        e.slug AS event_slug
      FROM videos v
      JOIN albums a
        ON a.id = v.album_id
      LEFT JOIN album_events e
        ON e.id = v.album_event_id
      WHERE v.id = $2::uuid
        AND lower(a.slug) = lower($1)
        AND COALESCE(v.is_deleted, false) = false
      LIMIT 1
      `,
      [albumSlug, videoId],
    );

    if (!video?.original_s3_key) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const targetKeys: string[] = [];
    let targetPersonId: string | null = uniquePersonIds[0] ?? null;

    if (uniquePersonIds.length) {
      const people = await query<PersonTargetRow>(
        `
        SELECT id, cover_face_s3_key
        FROM people
        WHERE album_id = $1::uuid
          AND id = ANY($2::uuid[])
          AND COALESCE(is_hidden, false) = false
        `,
        [video.album_id, uniquePersonIds],
      );

      targetKeys.push(
        ...people
          .map((person) => person.cover_face_s3_key)
          .filter((key): key is string => Boolean(key)),
      );
      if (!targetPersonId && people[0]?.id) targetPersonId = people[0].id;
    }

    targetKeys.push(...selfieS3Keys);

    const videoUrl = await signedObjectUrl(video.original_s3_key);
    const targetUrls = (
      await Promise.all(targetKeys.map((key) => signedObjectUrl(key)))
    ).filter((url): url is string => Boolean(url));

    if (!videoUrl) {
      return NextResponse.json({ error: "Could not create video URL" }, { status: 500 });
    }
    if (!targetUrls.length) {
      return NextResponse.json(
        { error: "Choose a person or upload a selfie before running AI" },
        { status: 400 },
      );
    }

    const adminKey = aiWorkerAdminKey();
    if (!adminKey) {
      return NextResponse.json(
        { error: "AI worker admin key is not configured" },
        { status: 500 },
      );
    }

    await query(
      `
      UPDATE videos
      SET detection_status = 'processing',
          detection_error = NULL,
          target_person_id = COALESCE($2::uuid, target_person_id),
          target_s3_keys = $3::jsonb,
          updated_at = now()
      WHERE id = $1::uuid
      `,
      [video.id, targetPersonId, JSON.stringify(targetKeys)],
    );

    const response = await fetch(faceOccurrenceLambdaUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify({
        input: {
          video_id: video.id,
          album_id: video.album_id,
          album_event_id: video.album_event_id,
          customer_id: video.customer_id,
          target_person_id: targetPersonId,
          file_name: video.file_name,
          original_s3_key: video.original_s3_key,
          storage_album_slug: video.storage_album_slug || albumSlug,
          storage_event_slug: video.storage_event_slug || video.event_slug,
          target_s3_keys: targetKeys,
          selected_person_ids: uniquePersonIds,
          persist_results: true,
          video_url: videoUrl,
          target_urls: targetUrls,
        },
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok || payload.ok === false) {
      const error = typeof payload.error === "string" ? payload.error : "Video AI failed to start";
      await query(
        `
        UPDATE videos
        SET detection_status = 'failed',
            detection_error = $2,
            updated_at = now()
        WHERE id = $1::uuid
        `,
        [video.id, error],
      );
      return NextResponse.json({ error }, { status: response.ok ? 502 : response.status });
    }

    const record = lambdaJobRecord(payload);
    const occurrence = lambdaFaceOccurrence(payload);
    const jobId = typeof record?.jobId === "string" ? record.jobId : null;
    const endpointId =
      (typeof record?.endpointId === "string" ? record.endpointId : null) ||
      (typeof occurrence?.endpointId === "string" ? occurrence.endpointId : null);

    await query(
      `
      UPDATE videos
      SET runpod_endpoint_id = COALESCE($2, runpod_endpoint_id),
          runpod_job_id = COALESCE($3, runpod_job_id),
          detection_status = 'processing',
          detection_error = NULL,
          updated_at = now()
      WHERE id = $1::uuid
      `,
      [video.id, endpointId, jobId],
    );

    return NextResponse.json({ ok: true, lambda: payload });
  } catch (error) {
    console.error("Failed to start video AI", error);
    return NextResponse.json({ error: "Failed to start video AI" }, { status: 500 });
  }
}

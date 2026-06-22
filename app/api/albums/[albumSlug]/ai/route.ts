import { NextResponse } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { checkRunpodEndpoint, submitRunpodJob } from "@/lib/runpod";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";

const DEFAULT_AI_WORKER_LAMBDA_URL =
  "https://ytwjenx44g62fzjrrb2wdad6gi0pnbrt.lambda-url.us-east-1.on.aws/";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

type AiAction =
  | "run_event"
  | "run_face_worker"
  | "run_image_text_worker"
  | "best_photos_full"
  | "process_new"
  | "process_all_new"
  | "sample"
  | "retry_captions"
  | "rebuild_search"
  | "retry_faces"
  | "check_status"
  | "clean_temp"
  | "delete_album_ai"
  | "reset_album_ai";

interface EventRow {
  id: string;
  name: string;
  slug: string;
  source_prefix: string | null;
}

interface DbQueryResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number | null;
}

interface DbQueryClient {
  query: (text: string, params?: unknown[]) => Promise<DbQueryResult>;
}

function aiWorkerAdminKey() {
  return (
    process.env.ADMIN_KEY ||
    process.env.AI_WORKER_ADMIN_KEY ||
    process.env.RUNPOD_ADMIN_KEY ||
    ""
  ).trim();
}

async function startAiWorker(
  albumId: string,
  eventId: string | null,
  mode: "new_photos_only" | "full_album_reset",
  input: Record<string, unknown>,
) {
  const adminKey = aiWorkerAdminKey();
  if (!adminKey) {
    throw new Error("AI worker admin key is not configured");
  }

  const lambdaUrl =
    process.env.AI_WORKER_LAMBDA_URL?.trim() || DEFAULT_AI_WORKER_LAMBDA_URL;
  const response = await fetch(lambdaUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
    },
    body: JSON.stringify({
      albumId,
      eventId,
      mode,
      full_mode: input.full_mode === true,
      input,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok || payload.ok === false) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "AI worker failed to start"
    );
  }

  return payload;
}

function slugList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    )
  );
}

function sourcePrefix(albumSlug: string, event: EventRow) {
  return (
    event.source_prefix?.trim() ||
    `albums/${albumSlug}/events/${event.slug}/originals/`
  );
}

function stepsForAction(action: AiAction) {
  if (action === "run_face_worker") {
    return {
      ingest: false,
      compress: true,
      image_embedding: true,
      face_index: true,
      safe_people_reconcile: true,
      crop_person_covers: true,
      enqueue_qwen: false,
      rebuild_people: false,
      qwen: false,
      embeddings: false,
      culling: false,
      cleanup_temp: false,
    };
  }

  if (action === "run_image_text_worker") {
    return {
      ingest: false,
      compress: false,
      image_embedding: false,
      face_index: false,
      safe_people_reconcile: false,
      crop_person_covers: true,
      enqueue_qwen: true,
      rebuild_people: false,
      qwen: true,
      embeddings: true,
      culling: false,
      cleanup_temp: false,
    };
  }

  if (action === "reset_album_ai") {
    return {
      ingest: false,
      compress: false,
      image_embedding: true,
      face_index: true,
      safe_people_reconcile: true,
      rebuild_people: true,
      qwen: true,
      embeddings: true,
      cleanup_temp: false,
    };
  }

  if (action === "retry_captions") {
    return {
      ingest: false,
      compress: false,
      image_embedding: false,
      face_index: false,
      safe_people_reconcile: false,
      rebuild_people: false,
      qwen: true,
      embeddings: true,
      cleanup_temp: false,
    };
  }

  if (action === "rebuild_search") {
    return {
      ingest: false,
      compress: false,
      image_embedding: true,
      face_index: false,
      safe_people_reconcile: false,
      rebuild_people: false,
      qwen: false,
      embeddings: false,
      cleanup_temp: false,
    };
  }

  if (action === "retry_faces") {
    return {
      ingest: false,
      compress: false,
      image_embedding: false,
      face_index: true,
      safe_people_reconcile: true,
      rebuild_people: false,
      qwen: false,
      embeddings: false,
      cleanup_temp: false,
    };
  }

  if (action === "check_status") {
    return {
      ingest: false,
      compress: false,
      image_embedding: false,
      face_index: false,
      safe_people_reconcile: false,
      rebuild_people: false,
      qwen: false,
      embeddings: false,
      cleanup_temp: false,
    };
  }

  if (action === "clean_temp") {
    return {
      ingest: false,
      compress: false,
      image_embedding: false,
      face_index: false,
      safe_people_reconcile: false,
      rebuild_people: false,
      qwen: false,
      embeddings: false,
      cleanup_temp: true,
    };
  }

  return null;
}

async function tableExists(client: DbQueryClient, tableName: string) {
  const { rows } = await client.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = $1
    ) AS exists
    `,
    [tableName],
  );

  return Boolean(rows[0]?.exists);
}

async function tableColumns(client: DbQueryClient, tableName: string) {
  const { rows } = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = $1
    `,
    [tableName],
  );

  return new Set(
    rows
      .map((row: { column_name?: unknown }) => row.column_name)
      .filter((value: unknown): value is string => typeof value === "string"),
  );
}

async function resetAlbumAiData(albumId: string) {
  return withTransaction(async (client) => {
    const resetStats: Record<string, number> = {};

    if (await tableExists(client, "person_aliases")) {
      const result = await client.query(
        `
        DELETE FROM person_aliases pa
        USING people pe
        WHERE pe.id = pa.person_id
          AND pe.album_id = $1::uuid
        `,
        [albumId],
      );
      resetStats.personAliasesDeleted = result.rowCount ?? 0;
    }

    if (await tableExists(client, "person_merge_history")) {
      const result = await client.query(
        `
        DELETE FROM person_merge_history
        WHERE album_id = $1::uuid
        `,
        [albumId],
      );
      resetStats.personMergeHistoryDeleted = result.rowCount ?? 0;
    }

    if (await tableExists(client, "person_event_stats")) {
      const result = await client.query(
        `
        DELETE FROM person_event_stats pes
        USING album_events e
        WHERE pes.album_event_id = e.id
          AND e.album_id = $1::uuid
        `,
        [albumId],
      );
      resetStats.personEventStatsDeleted = result.rowCount ?? 0;
    }

    if (await tableExists(client, "person_cooccurrence_stats")) {
      const result = await client.query(
        `
        DELETE FROM person_cooccurrence_stats
        WHERE album_id = $1::uuid
        `,
        [albumId],
      );
      resetStats.personCooccurrenceStatsDeleted = result.rowCount ?? 0;
    }

    if (await tableExists(client, "person_merge_candidates")) {
      const result = await client.query(
        `
        DELETE FROM person_merge_candidates
        WHERE album_id = $1::uuid
        `,
        [albumId],
      );
      resetStats.personMergeCandidatesDeleted = result.rowCount ?? 0;
    }

    if (await tableExists(client, "photo_relationships")) {
      const result = await client.query(
        `
        DELETE FROM photo_relationships
        WHERE album_id = $1::uuid
        `,
        [albumId],
      );
      resetStats.photoRelationshipsDeleted = result.rowCount ?? 0;
    }

    if (await tableExists(client, "photo_people")) {
      const result = await client.query(
        `
        DELETE FROM photo_people pp
        USING photos p
        WHERE pp.photo_id = p.id
          AND p.album_id = $1::uuid
        `,
        [albumId],
      );
      resetStats.photoPeopleDeleted = result.rowCount ?? 0;
    }

    if (await tableExists(client, "faces")) {
      const faceColumns = await tableColumns(client, "faces");
      let result: { rowCount: number | null } | null = null;

      if (faceColumns.has("album_id")) {
        result = await client.query(
          `
          DELETE FROM faces
          WHERE album_id = $1::uuid
          `,
          [albumId],
        );
      } else if (faceColumns.has("photo_id")) {
        result = await client.query(
          `
          DELETE FROM faces f
          USING photos p
          WHERE f.photo_id = p.id
            AND p.album_id = $1::uuid
          `,
          [albumId],
        );
      }

      resetStats.facesDeleted = result?.rowCount ?? 0;
    }

    if (await tableExists(client, "people")) {
      const result = await client.query(
        `
        DELETE FROM people
        WHERE album_id = $1::uuid
        `,
        [albumId],
      );
      resetStats.peopleDeleted = result.rowCount ?? 0;
    }

    const photoColumns = await tableColumns(client, "photos");
    const setClauses: string[] = [];

    for (const column of [
      "compression_status",
      "face_index_status",
      "qwen_status",
      "search_index_status",
      "image_embedding_status",
    ]) {
      if (photoColumns.has(column)) {
        setClauses.push(`${column} = 'pending'`);
      }
    }

    for (const column of [
      "compression_error",
      "caption",
      "qwen_json",
      "qwen_description",
      "ai_description",
      "search_text",
      "search_embedding",
      "image_embedding",
      "image_embedding_model",
      "image_embedded_at",
      "face_index_error",
      "qwen_error",
      "search_index_error",
      "face_indexed_at",
      "qwen_completed_at",
      "search_indexed_at",
    ]) {
      if (photoColumns.has(column)) {
        setClauses.push(`${column} = NULL`);
      }
    }

    setClauses.push("updated_at = now()");

    const photoResult = await client.query(
      `
      UPDATE photos
      SET ${setClauses.join(", ")}
      WHERE album_id = $1::uuid
        AND COALESCE(is_deleted, false) = false
        AND upload_status = 'completed'
      `,
      [albumId],
    );
    resetStats.photosReset = photoResult.rowCount ?? 0;

    if (await tableExists(client, "processing_jobs")) {
      const result = await client.query(
        `
        UPDATE processing_jobs
        SET status = 'pending',
            attempt_count = 0,
            error_message = NULL,
            completed_at = NULL,
            started_at = NULL,
            updated_at = now()
        WHERE album_id = $1::uuid
          AND job_type IN ('compress_photo', 'face_index_photo')
        `,
        [albumId],
      );
      resetStats.processingJobsReset = result.rowCount ?? 0;
    }

    return resetStats;
  });
}

async function hasEventSourcePrefix() {
  const row = await queryOne<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'album_events'
        AND column_name = 'source_prefix'
    ) AS exists
    `,
    []
  );

  return Boolean(row?.exists);
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json()) as {
      action?: unknown;
      eventSlugs?: unknown;
      selectedPhotoIds?: unknown;
      maxFiles?: unknown;
    };
    const action = typeof body.action === "string" ? body.action : "";
    const validActions: AiAction[] = [
      "run_event",
      "run_face_worker",
      "run_image_text_worker",
      "best_photos_full",
      "process_new",
      "process_all_new",
      "sample",
      "retry_captions",
      "rebuild_search",
      "retry_faces",
      "check_status",
      "clean_temp",
      "delete_album_ai",
      "reset_album_ai",
    ];

    if (!validActions.includes(action as AiAction)) {
      return NextResponse.json({ error: "Invalid AI action" }, { status: 400 });
    }

    const album = await queryOne<{ id: string; slug: string; name: string }>(
      `
      SELECT id, slug, name
      FROM albums
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      `,
      [albumSlug]
    );

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const requestedSlugs = slugList(body.eventSlugs);
    const sourcePrefixSelect = (await hasEventSourcePrefix())
      ? "e.source_prefix"
      : "NULL::text AS source_prefix";
    const events = await query<EventRow>(
      `
      SELECT e.id, e.name, e.slug, ${sourcePrefixSelect}
      FROM album_events e
      WHERE e.album_id = $1::uuid
        AND COALESCE(e.is_deleted, false) = false
        AND ($2::text[] IS NULL OR e.slug = ANY($2::text[]))
      ORDER BY e.sort_order ASC NULLS LAST, e.name ASC
      `,
      [album.id, requestedSlugs.length ? requestedSlugs : null]
    );

    if (!events.length && action !== "delete_album_ai") {
      return NextResponse.json(
        { error: "Select at least one event" },
        { status: 400 }
      );
    }

    const eventInputs = events.map((event) => ({
      name: event.name,
      slug: event.slug,
      source_prefix: sourcePrefix(album.slug, event),
    }));

    const input: Record<string, unknown> = {
      mode: "album_pipeline",
      album_slug: album.slug,
      album_name: album.name,
      events: eventInputs,
      cleanup_temp: false,
    };

    if (action === "run_event") {
      input.full_mode = true;
    }

    if (action === "best_photos_full") {
      input.mode = "best_photos_full";
    }

    if (action === "reset_album_ai") {
      input.full_mode = true;
      input.skip_completed = false;
      input.resume_partial = false;
      input.force_reprocess = true;
      input.reset_ai_data = true;
    }

    if (action === "process_new" || action === "process_all_new") {
      input.full_mode = true;
      input.skip_completed = true;
      input.resume_partial = true;
    }

    if (action === "sample") {
      input.full_mode = true;
      input.skip_completed = true;
      input.resume_partial = true;
      input.events = eventInputs.map((event) => ({
        ...event,
        max_files:
          typeof body.maxFiles === "number" && body.maxFiles > 0
            ? Math.min(Math.floor(body.maxFiles), 100)
            : 20,
      }));
    }

    const steps = stepsForAction(action as AiAction);
    if (steps) input.steps = steps;
    if (action === "retry_captions") input.only_failed = true;

    const selectedPhotoIds = slugList(body.selectedPhotoIds);
    if (selectedPhotoIds.length) {
      const rows = await query<{
        event_slug: string;
        original_s3_key: string | null;
      }>(
        `
        SELECT e.slug AS event_slug, p.original_s3_key
        FROM photos p
        JOIN album_events e ON e.id = p.album_event_id
        WHERE p.album_id = $1::uuid
          AND p.id::text = ANY($2::text[])
          AND COALESCE(p.is_deleted, false) = false
        `,
        [album.id, selectedPhotoIds]
      );
      const keysByEvent = new Map<string, string[]>();
      for (const row of rows) {
        if (!row.original_s3_key) continue;
        keysByEvent.set(row.event_slug, [
          ...(keysByEvent.get(row.event_slug) ?? []),
          row.original_s3_key,
        ]);
      }
      input.events = eventInputs.map((event) => ({
        ...event,
        only_s3_keys: keysByEvent.get(event.slug) ?? [],
      }));
    }

    const shouldStartLambda = new Set<AiAction>([
      "run_event",
      "run_face_worker",
      "run_image_text_worker",
      "best_photos_full",
      "process_new",
      "reset_album_ai",
    ]).has(action as AiAction);
    const lambda = shouldStartLambda
      ? await startAiWorker(
          album.id,
          action === "reset_album_ai" ? null : events[0]?.id ?? null,
          action === "reset_album_ai"
            ? "full_album_reset"
            : "new_photos_only",
          input,
        )
      : null;

    if (action === "reset_album_ai") {
      await checkRunpodEndpoint();
    }

    const reset =
      action === "reset_album_ai"
        ? await resetAlbumAiData(album.id)
        : action === "delete_album_ai"
          ? await resetAlbumAiData(album.id)
          : null;

    if (action === "delete_album_ai") {
      return NextResponse.json({ ok: true, reset });
    }

    const runpod = await submitRunpodJob(input);
    return NextResponse.json({ ok: true, input, runpod, reset, lambda });
  } catch (error) {
    console.error("Error submitting AI job:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit AI job" },
      { status: 500 }
    );
  }
}

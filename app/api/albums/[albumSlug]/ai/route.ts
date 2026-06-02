import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAlbumAccess } from "@/lib/album-access";
import { submitRunpodJob } from "@/lib/runpod";
import { requireAdminAccess } from "@/lib/auth-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

type AiAction =
  | "run_event"
  | "process_new"
  | "sample"
  | "retry_captions"
  | "rebuild_search"
  | "retry_faces"
  | "check_status"
  | "clean_temp";

interface EventRow {
  id: string;
  name: string;
  slug: string;
  source_prefix: string | null;
}

function slugList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter((item): item is string => typeof item === "string" && item.trim())
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
  if (action === "retry_captions") {
    return {
      ingest: false,
      compress: false,
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
      face_index: false,
      safe_people_reconcile: false,
      rebuild_people: false,
      qwen: false,
      embeddings: true,
      cleanup_temp: false,
    };
  }

  if (action === "retry_faces") {
    return {
      ingest: false,
      compress: false,
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
    const admin = await requireAdminAccess();
    if (admin.response) return admin.response;

    const { albumSlug } = await params;
    const accessDenied = await requireAlbumAccess(request, albumSlug);
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
      "process_new",
      "sample",
      "retry_captions",
      "rebuild_search",
      "retry_faces",
      "check_status",
      "clean_temp",
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

    if (!events.length) {
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

    if (action === "process_new") {
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

    const runpod = await submitRunpodJob(input);
    return NextResponse.json({ ok: true, input, runpod });
  } catch (error) {
    console.error("Error submitting AI job:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit AI job" },
      { status: 500 }
    );
  }
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAlbumAccess } from "@/lib/album-access";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { signedObjectUrl, signedUploadUrl } from "@/lib/s3";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface VideoUploadBody {
  eventSlug?: string;
  fileName?: string;
  size?: number;
  contentType?: string;
}

interface AlbumRow {
  id: string;
  slug: string;
  name: string;
  customer_id: string | null;
}

interface EventRow {
  id: string;
  slug: string;
  name: string;
  source_prefix: string | null;
}

interface VideoRow {
  id: string;
  album_id: string | null;
  album_event_id: string | null;
  customer_id: string | null;
  file_name: string | null;
  original_s3_key: string | null;
  storage_album_slug: string | null;
  storage_event_slug: string | null;
  duration_sec: number | string | null;
  model: string | null;
  detection_params: Record<string, unknown> | null;
  target_person_id: string | null;
  target_s3_keys: unknown;
  runpod_endpoint_id: string | null;
  runpod_job_id: string | null;
  detection_status: string | null;
  detection_error: string | null;
  result_json: Record<string, unknown> | null;
  match_count: number | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  completed_at: Date | string | null;
  event_slug: string | null;
  event_name: string | null;
  matches: unknown;
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || randomUUID()
  );
}

function safeStem(fileName: string) {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  return slugify(withoutExt);
}

function videoExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.(mp4|mov|m4v|webm|avi|mkv)$/);
  return match ? `.${match[1]}` : ".mp4";
}

function videoContentType(fileName: string, contentType?: string) {
  if (contentType?.startsWith("video/")) return contentType;
  const ext = videoExtension(fileName);
  return (
    {
      ".mp4": "video/mp4",
      ".m4v": "video/x-m4v",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
      ".avi": "video/x-msvideo",
      ".mkv": "video/x-matroska",
    }[ext] ?? "application/octet-stream"
  );
}

function cleanSourcePrefix(value?: string | null) {
  return value
    ?.trim()
    .replace(/^s3:\/\/[^/]+\//, "")
    .replace(/^https?:\/\/[^/]+\//, "")
    .replace(/^\/+|\/+$/g, "");
}

function dateTimeValue(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function numberValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value) || 0;
  return 0;
}

async function albumBySlug(albumSlug: string) {
  return queryOne<AlbumRow>(
    `
    SELECT id, slug, name, customer_id
    FROM albums
    WHERE lower(slug) = lower($1)
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
    `,
    [albumSlug],
  );
}

async function eventBySlug(albumId: string, eventSlug: string) {
  return queryOne<EventRow>(
    `
    SELECT id, slug, name, source_prefix
    FROM album_events
    WHERE album_id = $1::uuid
      AND slug = $2
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
    `,
    [albumId, eventSlug],
  );
}

function buildVideoKey(album: AlbumRow, event: EventRow, videoId: string, fileName: string) {
  const base = cleanSourcePrefix(event.source_prefix) || `albums/${album.slug}/events/${event.slug}`;
  return `${base}/videos/${videoId}_${safeStem(fileName)}${videoExtension(fileName)}`;
}

async function toVideo(row: VideoRow) {
  const matches = Array.isArray(row.matches) ? row.matches : [];

  return {
    id: row.id,
    albumId: row.album_id,
    eventId: row.album_event_id,
    eventSlug: row.event_slug ?? row.storage_event_slug,
    eventName: row.event_name,
    customerId: row.customer_id,
    fileName: row.file_name,
    originalS3Key: row.original_s3_key,
    videoUrl: await signedObjectUrl(row.original_s3_key),
    durationSec: numberValue(row.duration_sec),
    model: row.model,
    detectionParams: row.detection_params ?? {},
    targetPersonId: row.target_person_id,
    targetS3Keys: row.target_s3_keys,
    runpodEndpointId: row.runpod_endpoint_id,
    runpodJobId: row.runpod_job_id,
    detectionStatus: row.detection_status ?? "pending",
    detectionError: row.detection_error,
    resultJson: row.result_json,
    matchCount: numberValue(row.match_count),
    matches,
    createdAt: dateTimeValue(row.created_at),
    updatedAt: dateTimeValue(row.updated_at),
    completedAt: dateTimeValue(row.completed_at),
  };
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) return accessDenied;

    const album = await albumBySlug(albumSlug);
    if (!album) return NextResponse.json({ error: "Album not found" }, { status: 404 });

    const events = await query<EventRow>(
      `
      SELECT id, slug, name, source_prefix
      FROM album_events
      WHERE album_id = $1::uuid
        AND COALESCE(is_deleted, false) = false
      ORDER BY sort_order ASC NULLS LAST, name ASC
      `,
      [album.id],
    );

    const rows = await query<VideoRow>(
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
        v.duration_sec,
        v.model,
        v.detection_params,
        v.target_person_id,
        v.target_s3_keys,
        v.runpod_endpoint_id,
        v.runpod_job_id,
        v.detection_status,
        v.detection_error,
        v.result_json,
        v.match_count,
        v.created_at,
        v.updated_at,
        v.completed_at,
        e.slug AS event_slug,
        e.name AS event_name,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', m.id,
              'startSec', m.start_sec,
              'endSec', m.end_sec,
              'startTime', m.start_time,
              'endTime', m.end_time,
              'maxSimilarity', m.max_similarity,
              'avgSimilarity', m.avg_similarity,
              'framesMatched', m.frames_matched,
              'verified', m.verified
            )
            ORDER BY m.start_sec ASC
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'::jsonb
        ) AS matches
      FROM videos v
      JOIN albums a
        ON a.id = v.album_id
      LEFT JOIN album_events e
        ON e.id = v.album_event_id
      LEFT JOIN video_face_matches m
        ON m.video_id = v.id
      WHERE lower(a.slug) = lower($1)
        AND COALESCE(v.is_deleted, false) = false
      GROUP BY v.id, e.slug, e.name
      ORDER BY v.created_at DESC
      `,
      [albumSlug],
    );

    return NextResponse.json({
      album: { id: album.id, slug: album.slug, name: album.name, customerId: album.customer_id },
      events: events.map((event) => ({ id: event.id, slug: event.slug, name: event.name })),
      videos: await Promise.all(rows.map(toVideo)),
    });
  } catch (error) {
    console.error("Failed to load album videos", error);
    return NextResponse.json({ error: "Failed to load videos" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json()) as VideoUploadBody;
    const fileName = body.fileName?.trim();
    const eventSlug = body.eventSlug?.trim();

    if (!fileName || !body.size || body.size <= 0) {
      return NextResponse.json({ error: "fileName and size are required" }, { status: 400 });
    }
    if (!eventSlug) {
      return NextResponse.json({ error: "eventSlug is required" }, { status: 400 });
    }

    const album = await albumBySlug(albumSlug);
    if (!album) return NextResponse.json({ error: "Album not found" }, { status: 404 });

    const event = await eventBySlug(album.id, eventSlug);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const videoId = randomUUID();
    const contentType = videoContentType(fileName, body.contentType);
    const originalS3Key = buildVideoKey(album, event, videoId, fileName);

    const row = await queryOne<{ id: string; original_s3_key: string }>(
      `
      INSERT INTO videos(
        id,
        album_id,
        album_event_id,
        customer_id,
        file_name,
        original_s3_key,
        storage_album_slug,
        storage_event_slug,
        detection_status,
        created_at,
        updated_at
      )
      VALUES(
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5,
        $6,
        $7,
        $8,
        'pending',
        now(),
        now()
      )
      RETURNING id, original_s3_key
      `,
      [
        videoId,
        album.id,
        event.id,
        album.customer_id,
        fileName,
        originalS3Key,
        album.slug,
        event.slug,
      ],
    );

    if (!row) throw new Error("Could not create video row");

    return NextResponse.json({
      video: {
        id: row.id,
        fileName,
        contentType,
        originalS3Key: row.original_s3_key,
        eventSlug: event.slug,
        eventName: event.name,
      },
      uploadUrl: await signedUploadUrl(row.original_s3_key, contentType),
    });
  } catch (error) {
    console.error("Failed to prepare video upload", error);
    return NextResponse.json({ error: "Failed to prepare video upload" }, { status: 500 });
  }
}

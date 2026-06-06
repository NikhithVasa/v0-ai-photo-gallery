import { NextResponse } from "next/server";
import { requireAlbumAccess } from "@/lib/album-access";
import { query } from "@/lib/db";
import { toPhoto, type PhotoRow } from "@/lib/gallery-data";
import type { AiReviewPhoto, PhotoAiAnalysis } from "@/lib/types";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

type ReviewMode =
  | "all"
  | "best"
  | "problems"
  | "looking"
  | "sharp"
  | "decor"
  | "groups"
  | "no_people";

interface AiReviewPhotoRow extends PhotoRow {
  album_score: number | string | null;
  clarity_score: number | string | null;
  background_score: number | string | null;
  camera_gaze: string | null;
  decoration_keywords: string | null;
  album_worthy_reason: string | null;
  qwen_status: string | null;
  detected_people_count: number | string | null;
  problem_reasons: string[] | null;
}

const MODES = new Set<ReviewMode>([
  "all",
  "best",
  "problems",
  "looking",
  "sharp",
  "decor",
  "groups",
  "no_people",
]);

function modeValue(value: string | null): ReviewMode {
  return value && MODES.has(value as ReviewMode)
    ? (value as ReviewMode)
    : "best";
}

function limitValue(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : 100;
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(parsed, 250);
}

function numberValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toAiAnalysis(row: AiReviewPhotoRow): PhotoAiAnalysis {
  return {
    albumScore: numberValue(row.album_score),
    clarityScore: numberValue(row.clarity_score),
    backgroundScore: numberValue(row.background_score),
    cameraGaze: row.camera_gaze,
    decorationKeywords: row.decoration_keywords,
    reason: row.album_worthy_reason,
    qwenStatus: row.qwen_status,
    peopleCount: numberValue(row.detected_people_count),
  };
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) return accessDenied;

    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get("event") || null;
    const mode = modeValue(searchParams.get("mode"));
    const limit = limitValue(searchParams.get("limit"));

    const rows = await query<AiReviewPhotoRow>(
      `
      WITH scored_photos AS (
        SELECT
          p.id,
          p.album_id,
          a.slug AS album_slug,
          p.album_event_id,
          p.file_name,
          p.caption,
          p.search_text,
          p.width,
          p.height,
          p.original_s3_key,
          p.clean_preview_s3_key,
          p.watermarked_preview_s3_key,
          p.thumbnail_s3_key,
          p.annotated_s3_key,
          p.compression_status,
          p.watermark_status,
          e.slug AS event_slug,
          e.name AS event_name,
          p.qwen_status,
          CASE
            WHEN (p.qwen_json::jsonb->'raw'->>'album_worthy_score') ~ '^\\d+(\\.\\d+)?$'
              THEN (p.qwen_json::jsonb->'raw'->>'album_worthy_score')::numeric
            ELSE NULL
          END AS album_score,
          CASE
            WHEN (p.qwen_json::jsonb->'raw'->>'frame_clarity') ~ '^\\d+(\\.\\d+)?$'
              THEN (p.qwen_json::jsonb->'raw'->>'frame_clarity')::numeric
            ELSE NULL
          END AS clarity_score,
          CASE
            WHEN (p.qwen_json::jsonb->'raw'->>'background_quality') ~ '^\\d+(\\.\\d+)?$'
              THEN (p.qwen_json::jsonb->'raw'->>'background_quality')::numeric
            ELSE NULL
          END AS background_score,
          COALESCE(
            p.qwen_json::jsonb->'raw'->'camera_gaze'->>'overall',
            p.qwen_json::jsonb->'raw'->>'camera_gaze'
          ) AS camera_gaze,
          COALESCE(
            p.qwen_json::jsonb->'raw'->>'decoration_keywords',
            p.qwen_json::jsonb->'raw'->>'decorations',
            p.qwen_json::jsonb->'raw'->>'background_keywords'
          ) AS decoration_keywords,
          p.qwen_json::jsonb->'raw'->>'album_worthy_reason' AS album_worthy_reason,
          CASE
            WHEN jsonb_typeof(p.qwen_json::jsonb->'raw'->'people') = 'array'
              THEN jsonb_array_length(p.qwen_json::jsonb->'raw'->'people')
            ELSE NULL
          END AS detected_people_count,
          COALESCE(photo_people_summary.people, '[]'::jsonb) AS people
        FROM photos p
        JOIN albums a ON a.id = p.album_id
        JOIN album_events e ON e.id = p.album_event_id
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', pe.id,
              'person_number', pe.person_number,
              'default_name', pe.default_name,
              'display_name', pe.display_name,
              'photo_count', pe.photo_count,
              'cover_face_s3_key', pe.cover_face_s3_key
            )
            ORDER BY pe.person_number ASC NULLS LAST, pe.default_name ASC
          ) AS people
          FROM photo_people pp
          JOIN people pe ON pe.id = pp.person_id
          WHERE pp.photo_id = p.id
            AND COALESCE(pe.is_hidden, false) = false
        ) photo_people_summary ON true
        WHERE a.slug = $1
          AND ($2::text IS NULL OR e.slug = $2)
          AND COALESCE(p.is_deleted, false) = false
          AND p.upload_status = 'completed'
      )
      SELECT
        *,
        ARRAY_REMOVE(ARRAY[
          CASE
            WHEN lower(COALESCE(qwen_status, '')) <> 'completed'
              THEN 'No completed AI metadata'
          END,
          CASE
            WHEN album_score IS NOT NULL AND album_score <= 5
              THEN 'Low album-worthy score'
          END,
          CASE
            WHEN clarity_score IS NOT NULL AND clarity_score <= 5
              THEN 'Low clarity'
          END,
          CASE
            WHEN background_score IS NOT NULL AND background_score <= 5
              THEN 'Weak background'
          END,
          CASE
            WHEN lower(COALESCE(camera_gaze, '')) IN ('none', 'few', 'no', 'not looking')
              THEN 'People not looking at camera'
          END
        ], NULL) AS problem_reasons
      FROM scored_photos
      WHERE
        CASE
          WHEN $3::text = 'problems' THEN
            lower(COALESCE(qwen_status, '')) <> 'completed'
            OR album_score IS NULL
            OR album_score <= 5
            OR clarity_score <= 5
            OR background_score <= 5
            OR lower(COALESCE(camera_gaze, '')) IN ('none', 'few', 'no', 'not looking')
          WHEN $3::text = 'looking' THEN lower(COALESCE(camera_gaze, '')) IN ('all', 'most')
          WHEN $3::text = 'sharp' THEN clarity_score IS NOT NULL
          WHEN $3::text = 'decor' THEN
            COALESCE(decoration_keywords, '') <> ''
            OR COALESCE(search_text, '') ILIKE '%decor%'
            OR COALESCE(search_text, '') ILIKE '%mandap%'
            OR COALESCE(search_text, '') ILIKE '%flowers%'
            OR COALESCE(search_text, '') ILIKE '%jewelry%'
          WHEN $3::text = 'groups' THEN COALESCE(detected_people_count, 0) >= 3
          WHEN $3::text = 'no_people' THEN COALESCE(detected_people_count, 0) = 0
          WHEN $3::text = 'all' THEN true
          ELSE lower(COALESCE(qwen_status, '')) = 'completed'
        END
      ORDER BY
        CASE
          WHEN $3::text = 'problems' AND lower(COALESCE(qwen_status, '')) <> 'completed' THEN 0
          ELSE 1
        END ASC,
        CASE WHEN $3::text = 'problems' THEN album_score END ASC NULLS FIRST,
        CASE WHEN $3::text <> 'problems' THEN album_score END DESC NULLS LAST,
        clarity_score DESC NULLS LAST,
        background_score DESC NULLS LAST,
        file_name ASC NULLS LAST
      LIMIT $4
      `,
      [albumSlug, eventSlug, mode, limit],
    );

    const items: AiReviewPhoto[] = await Promise.all(
      rows.map(async (row) => ({
        photo: await toPhoto(row),
        ai: toAiAnalysis(row),
        problemReasons: row.problem_reasons ?? [],
      })),
    );

    return NextResponse.json(
      { mode, event: eventSlug, photos: items },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching AI review photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI review photos" },
      { status: 500 },
    );
  }
}

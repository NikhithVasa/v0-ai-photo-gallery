import { NextResponse } from "next/server";
import { requireAlbumAccess } from "@/lib/album-access";
import { query } from "@/lib/db";
import { toPhoto, type PhotoRow } from "@/lib/gallery-data";
import { signedUrl } from "@/lib/s3";
import type {
  AiReviewPersonGroup,
  AiReviewPhoto,
  Person,
  PhotoAiAnalysis,
} from "@/lib/types";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface BestByPersonRow extends PhotoRow {
  person_id: string;
  person_album_id: string;
  person_number: number | string | null;
  default_name: string;
  display_name: string | null;
  cover_face_s3_key: string | null;
  face_count: number | string | null;
  person_photo_count: number | string | null;
  occurrence_count: number | string | null;
  album_score: number | string | null;
  clarity_score: number | string | null;
  background_score: number | string | null;
  camera_gaze: string | null;
  decoration_keywords: string | null;
  album_worthy_reason: string | null;
  qwen_status: string | null;
  detected_people_count: number | string | null;
  qwen_json: Record<string, unknown> | null;
}

function limitValue(value: string | null, fallback: number, max: number) {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function numberValue(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function nullableNumberValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toAiAnalysis(row: BestByPersonRow): PhotoAiAnalysis {
  return {
    albumScore: nullableNumberValue(row.album_score),
    clarityScore: nullableNumberValue(row.clarity_score),
    backgroundScore: nullableNumberValue(row.background_score),
    cameraGaze: row.camera_gaze,
    decorationKeywords: row.decoration_keywords,
    reason: row.album_worthy_reason,
    qwenStatus: row.qwen_status,
    peopleCount: nullableNumberValue(row.detected_people_count),
    qwenJson: row.qwen_json,
  };
}

async function toPerson(row: BestByPersonRow): Promise<Person> {
  return {
    id: row.person_id,
    albumId: row.person_album_id,
    personNumber: numberValue(row.person_number),
    defaultName: row.default_name,
    displayName: row.display_name,
    photoCount: numberValue(row.person_photo_count),
    faceCount: numberValue(row.face_count),
    occurrenceCount: numberValue(row.occurrence_count),
    coverFaceUrl: await signedUrl(row.cover_face_s3_key),
  };
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) return accessDenied;

    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get("event") || null;
    const perPerson = limitValue(searchParams.get("perPerson"), 10, 25);
    const peopleLimit = limitValue(searchParams.get("peopleLimit"), 24, 80);

    const rows = await query<BestByPersonRow>(
      `
      WITH selected_people AS (
        SELECT
          pe.id,
          pe.album_id,
          pe.person_number,
          pe.default_name,
          pe.display_name,
          pe.cover_face_s3_key,
          pe.face_count,
          pe.photo_count,
          pe.occurrence_count
        FROM people pe
        JOIN albums a ON a.id = pe.album_id
        WHERE lower(a.slug) = lower($1)
          AND COALESCE(pe.is_hidden, false) = false
          AND COALESCE(pe.photo_count, 0) > 0
        ORDER BY pe.occurrence_count DESC NULLS LAST, pe.photo_count DESC NULLS LAST
        LIMIT $4
      ),
      ranked_photos AS (
        SELECT
          pe.id AS person_id,
          pe.album_id AS person_album_id,
          pe.person_number,
          pe.default_name,
          pe.display_name,
          pe.cover_face_s3_key,
          pe.face_count,
          pe.photo_count AS person_photo_count,
          pe.occurrence_count,
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
          p.ai_input_s3_key,
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
            WHEN p.qwen_json IS NULL THEN NULL
            ELSE jsonb_build_object(
              'photo', COALESCE(p.qwen_json::jsonb->'photo', '{}'::jsonb),
              'quality', COALESCE(p.qwen_json::jsonb->'quality', '{}'::jsonb),
              'people_map', COALESCE(p.qwen_json::jsonb->'people_map', '{}'::jsonb),
              'relationships', COALESCE(p.qwen_json::jsonb->'relationships', '[]'::jsonb)
            )
          END AS qwen_json,
          CASE
            WHEN (p.qwen_json::jsonb->'quality'->>'album_worthy_score') ~ '^\\d+(\\.\\d+)?$'
              THEN (p.qwen_json::jsonb->'quality'->>'album_worthy_score')::numeric
            ELSE NULL
          END AS album_score,
          CASE
            WHEN (p.qwen_json::jsonb->'quality'->>'frame_clarity') ~ '^\\d+(\\.\\d+)?$'
              THEN (p.qwen_json::jsonb->'quality'->>'frame_clarity')::numeric
            ELSE NULL
          END AS clarity_score,
          CASE
            WHEN (p.qwen_json::jsonb->'quality'->>'background_quality') ~ '^\\d+(\\.\\d+)?$'
              THEN (p.qwen_json::jsonb->'quality'->>'background_quality')::numeric
            ELSE NULL
          END AS background_score,
          p.qwen_json::jsonb->'quality'->>'camera_gaze_overall' AS camera_gaze,
          p.qwen_json::jsonb->'quality'->>'decoration_keywords' AS decoration_keywords,
          p.qwen_json::jsonb->'quality'->>'album_worthy_reason' AS album_worthy_reason,
          CASE
            WHEN jsonb_typeof(p.qwen_json::jsonb->'people_map') = 'object'
              THEN (
                SELECT COUNT(*)::int
                FROM jsonb_object_keys(p.qwen_json::jsonb->'people_map')
              )
            ELSE NULL
          END AS detected_people_count,
          COALESCE(photo_people_summary.people, '[]'::jsonb) AS people,
          ROW_NUMBER() OVER (
            PARTITION BY pe.id
            ORDER BY
              CASE
                WHEN (p.qwen_json::jsonb->'quality'->>'album_worthy_score') ~ '^\\d+(\\.\\d+)?$'
                  THEN (p.qwen_json::jsonb->'quality'->>'album_worthy_score')::numeric
                ELSE NULL
              END DESC NULLS LAST,
              CASE
                WHEN (p.qwen_json::jsonb->'quality'->>'frame_clarity') ~ '^\\d+(\\.\\d+)?$'
                  THEN (p.qwen_json::jsonb->'quality'->>'frame_clarity')::numeric
                ELSE NULL
              END DESC NULLS LAST,
              p.created_at DESC
          ) AS rank
        FROM selected_people pe
        JOIN photo_people pp ON pp.person_id = pe.id
        JOIN photos p ON p.id = pp.photo_id
        JOIN albums a ON a.id = p.album_id
        JOIN album_events e ON e.id = p.album_event_id
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', related_pe.id,
              'person_number', related_pe.person_number,
              'default_name', related_pe.default_name,
              'display_name', related_pe.display_name,
              'photo_count', related_pe.photo_count,
              'cover_face_s3_key', related_pe.cover_face_s3_key
            )
            ORDER BY related_pe.person_number ASC NULLS LAST, related_pe.default_name ASC
          ) AS people
          FROM photo_people related_pp
          JOIN people related_pe ON related_pe.id = related_pp.person_id
          WHERE related_pp.photo_id = p.id
            AND COALESCE(related_pe.is_hidden, false) = false
        ) photo_people_summary ON true
        WHERE lower(a.slug) = lower($1)
          AND ($2::text IS NULL OR e.slug = $2)
          AND COALESCE(p.is_deleted, false) = false
          AND p.upload_status = 'completed'
          AND lower(COALESCE(p.qwen_status, '')) = 'completed'
      )
      SELECT *
      FROM ranked_photos
      WHERE rank <= $3
      ORDER BY occurrence_count DESC NULLS LAST, person_number ASC NULLS LAST, rank ASC
      `,
      [albumSlug, eventSlug, perPerson, peopleLimit],
    );

    const groupsByPerson = new Map<string, AiReviewPersonGroup>();

    for (const row of rows) {
      let group = groupsByPerson.get(row.person_id);
      if (!group) {
        group = {
          person: await toPerson(row),
          photos: [],
        };
        groupsByPerson.set(row.person_id, group);
      }

      const item: AiReviewPhoto = {
        photo: await toPhoto(row),
        ai: toAiAnalysis(row),
      };
      group.photos.push(item);
    }

    return NextResponse.json(
      {
        event: eventSlug,
        perPerson,
        groups: Array.from(groupsByPerson.values()),
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching best photos by person:", error);
    return NextResponse.json(
      { error: "Failed to fetch best photos by person" },
      { status: 500 },
    );
  }
}

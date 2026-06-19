import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { toPhoto, type PhotoRow } from "@/lib/gallery-data";
import { requireAlbumAccess } from "@/lib/album-access";
import { getShareLinkAccess } from "@/lib/share-access";
import {
  albumSortMode,
  ensurePhotoSortSchema,
  eventSortMode,
  photoOriginalDateExpression,
  photoOrderBySql,
  photoRatingExpression,
} from "@/lib/photo-sort";
import type { Photo } from "@/lib/types";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const requestUrl = new URL(request.url);
    const shareToken = requestUrl.searchParams.get("share") || "";
    console.info("[share-debug] album photos API start", {
      albumSlug,
      hasShareToken: Boolean(shareToken),
      shareToken: shareToken ? `${shareToken.slice(0, 6)}...${shareToken.slice(-4)}` : "",
    });

    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) {
      console.warn("[share-debug] album photos API access denied", {
        albumSlug,
        status: accessDenied.status,
      });
      return accessDenied;
    }

    const { searchParams } = requestUrl;
    const eventSlug = searchParams.get("event") || null;
    const requestedPersonIds = (searchParams.get("people") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id && isUuid(id));
    const rawPeopleMode = searchParams.get("peopleMode");
    const requestedPeopleMode =
      rawPeopleMode === "any" || rawPeopleMode === "only"
        ? rawPeopleMode
        : "all";
    const shareAccess = await getShareLinkAccess(request, albumSlug);
    const personIds = shareAccess?.personId
      ? [shareAccess.personId]
      : requestedPersonIds;
    const peopleMode = shareAccess?.personId
      ? shareAccess.onlyPerson
        ? "only"
        : "all"
      : requestedPeopleMode;
    await ensurePhotoSortSchema();
    const sortMode = eventSlug
      ? await eventSortMode(albumSlug, eventSlug)
      : await albumSortMode(albumSlug);
    const orderBy = await photoOrderBySql(sortMode);
    const originalDateExpression = await photoOriginalDateExpression();
    const ratingExpression = await photoRatingExpression();

    console.info("[share-debug] album photos API querying photos", {
      albumSlug,
      eventSlug,
      peopleCount: personIds.length,
      peopleMode,
      sortMode,
      isShareView: Boolean(shareToken),
    });

    const rows = await query<PhotoRow>(
      `
      SELECT
        p.id,
        p.album_id,
        a.slug AS album_slug,
        p.album_event_id,
        p.file_name,
        p.caption,
        p.search_text,
        p.created_at,
        ${originalDateExpression} AS original_date,
        ${ratingExpression} AS rating,
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
        COALESCE(pso.position, p.custom_sort_order) AS custom_sort_order,
        e.slug AS event_slug,
        e.name AS event_name,
        COALESCE(photo_people_summary.people, '[]'::jsonb) AS people
      FROM photos p
      JOIN albums a ON a.id = p.album_id
      JOIN album_events e ON e.id = p.album_event_id
      LEFT JOIN photo_sort_positions pso
        ON pso.album_id = p.album_id
       AND pso.photo_id = p.id
       AND pso.scope = CASE WHEN $2::text IS NULL THEN 'album' ELSE 'event' END
       AND (
         ($2::text IS NULL AND pso.album_event_id IS NULL)
         OR ($2::text IS NOT NULL AND pso.album_event_id = e.id)
       )
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
          AND ($5::uuid IS NULL OR pe.id = $5::uuid)
      ) photo_people_summary ON true
      WHERE lower(a.slug) = lower($1)
        AND ($2::text IS NULL OR e.slug = $2)
        AND (
          $3::uuid[] IS NULL
          OR CASE
            WHEN $4::text = 'only' THEN (
              SELECT COUNT(DISTINCT pp.person_id)
              FROM photo_people pp
              WHERE pp.photo_id = p.id
                AND pp.person_id = ANY($3::uuid[])
            ) = cardinality($3::uuid[])
            AND (
              SELECT COUNT(DISTINCT pp.person_id)
              FROM photo_people pp
              JOIN people pe
                ON pe.id = pp.person_id
               AND COALESCE(pe.is_hidden, false) = false
              WHERE pp.photo_id = p.id
            ) = cardinality($3::uuid[])
            WHEN $4::text = 'all' THEN (
              SELECT COUNT(DISTINCT pp.person_id)
              FROM photo_people pp
              WHERE pp.photo_id = p.id
                AND pp.person_id = ANY($3::uuid[])
            ) = cardinality($3::uuid[])
            ELSE EXISTS (
              SELECT 1
              FROM photo_people pp
              WHERE pp.photo_id = p.id
                AND pp.person_id = ANY($3::uuid[])
            )
          END
        )
        AND COALESCE(p.is_deleted, false) = false
        AND p.upload_status = 'completed'
      ORDER BY ${orderBy}
      `,
      [
        albumSlug,
        eventSlug,
        personIds.length ? personIds : null,
        peopleMode,
        shareAccess?.personId ?? null,
      ]
    );

    console.info("[share-debug] album photos API rows loaded", {
      albumSlug,
      count: rows.length,
    });

    const photos: Photo[] = await Promise.all(
      rows.map((row) =>
        toPhoto(row, {
          signMediaUrls: false,
          signPersonCoverUrls: false,
        }),
      ),
    );
    return NextResponse.json(
      { photos, sortMode },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("[share-debug] album photos API failed", {
      error,
    });
    return NextResponse.json(
      { error: "Failed to fetch album photos" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { toPhoto, type PhotoRow } from "@/lib/gallery-data";
import { requireAlbumAccess } from "@/lib/album-access";
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
    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) return accessDenied;

    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get("event") || null;
    const personIds = (searchParams.get("people") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id && isUuid(id));
    const peopleMode = searchParams.get("peopleMode") === "any" ? "any" : "all";

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
        p.width,
        p.height,
        p.original_s3_key,
        p.clean_preview_s3_key,
        p.watermarked_preview_s3_key,
        p.thumbnail_s3_key,
        p.annotated_s3_key,
        e.slug AS event_slug,
        e.name AS event_name,
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
        AND (
          $3::uuid[] IS NULL
          OR CASE
            WHEN $4::boolean THEN (
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
      ORDER BY p.created_at ASC
      `,
      [albumSlug, eventSlug, personIds.length ? personIds : null, peopleMode === "all"]
    );

    const photos: Photo[] = await Promise.all(rows.map(toPhoto));
    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Error fetching album photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch album photos" },
      { status: 500 }
    );
  }
}

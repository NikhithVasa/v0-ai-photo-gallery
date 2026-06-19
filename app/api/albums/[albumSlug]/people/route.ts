import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { toPerson, type PersonRow } from "@/lib/gallery-data";
import { requireAlbumAccess } from "@/lib/album-access";
import { getShareLinkAccess } from "@/lib/share-access";
import type { Person } from "@/lib/types";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface PersonEventStatsRow {
  person_id: string;
  event_id: string;
  event_slug: string;
  event_name: string;
  photo_count: number | string | null;
  face_count: number | string | null;
}

function countValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

function shortToken(value: string | null) {
  if (!value) return "";
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const { searchParams } = new URL(request.url);
    const shareToken = searchParams.get("share");
    const eventSlug = searchParams.get("event") || null;
    console.log("[share-debug] album people API start", {
      albumSlug,
      eventSlug,
      hasShareToken: Boolean(shareToken),
      shareToken: shortToken(shareToken),
    });

    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) {
      console.log("[share-debug] album people API access denied", {
        albumSlug,
        eventSlug,
        status: accessDenied.status,
        hasShareToken: Boolean(shareToken),
      });
      return accessDenied;
    }

    const shareAccess = await getShareLinkAccess(request, albumSlug);

    console.log("[share-debug] album people API querying people", {
      albumSlug,
      eventSlug,
    });

    const rows = eventSlug
      ? await query<PersonRow>(
          `
          SELECT
            pe.id,
            pe.album_id,
            pe.person_number,
            pe.default_name,
            pe.display_name,
            COALESCE(
              pe.cover_face_s3_key,
              MIN(
                COALESCE(
                  p.thumbnail_s3_key,
                  p.ai_input_s3_key,
                  p.clean_preview_s3_key,
                  p.watermarked_preview_s3_key
                )
              )
            ) AS cover_face_s3_key,
            COUNT(DISTINCT p.id)::int AS photo_count,
            COUNT(p.id)::int AS face_count,
            COUNT(p.id)::int AS occurrence_count
          FROM people pe
          JOIN albums a
            ON a.id = pe.album_id
          JOIN album_events e
            ON e.album_id = a.id
           AND e.slug = $2
           AND COALESCE(e.is_deleted, false) = false
          JOIN photo_people pp
            ON pp.person_id = pe.id
           AND pp.album_event_id = e.id
          JOIN photos p
            ON p.id = pp.photo_id
           AND p.album_event_id = e.id
           AND COALESCE(p.is_deleted, false) = false
           AND p.upload_status = 'completed'
          WHERE lower(a.slug) = lower($1)
            AND ($3::uuid IS NULL OR pe.id = $3::uuid)
            AND COALESCE(a.is_deleted, false) = false
            AND COALESCE(pe.is_hidden, false) = false
          GROUP BY
            pe.id,
            pe.album_id,
            pe.person_number,
            pe.default_name,
            pe.display_name,
            pe.cover_face_s3_key
          ORDER BY COUNT(DISTINCT p.id) DESC, pe.person_number ASC
          `,
          [albumSlug, eventSlug, shareAccess?.personId ?? null]
        )
      : await query<PersonRow>(
          `
          SELECT
            pe.id,
            pe.album_id,
            pe.person_number,
            pe.default_name,
            pe.display_name,
            COALESCE(
              pe.cover_face_s3_key,
              MIN(
                COALESCE(
                  p.thumbnail_s3_key,
                  p.ai_input_s3_key,
                  p.clean_preview_s3_key,
                  p.watermarked_preview_s3_key
                )
              )
            ) AS cover_face_s3_key,
            COUNT(p.id)::int AS face_count,
            COUNT(DISTINCT p.id)::int AS photo_count,
            COUNT(p.id)::int AS occurrence_count
          FROM people pe
          JOIN albums a
            ON a.id = pe.album_id
          LEFT JOIN photo_people pp
            ON pp.person_id = pe.id
          LEFT JOIN photos p
            ON p.id = pp.photo_id
           AND COALESCE(p.is_deleted, false) = false
           AND p.upload_status = 'completed'
          WHERE lower(a.slug) = lower($1)
            AND ($2::uuid IS NULL OR pe.id = $2::uuid)
            AND COALESCE(a.is_deleted, false) = false
            AND COALESCE(pe.is_hidden, false) = false
          GROUP BY
            pe.id,
            pe.album_id,
            pe.person_number,
            pe.default_name,
            pe.display_name,
            pe.cover_face_s3_key
          ORDER BY COUNT(DISTINCT p.id) DESC, pe.person_number ASC
          `,
          [albumSlug, shareAccess?.personId ?? null]
        );

    const peopleBase = (await Promise.all(rows.map(toPerson))) satisfies Person[];
    console.log("[share-debug] album people API people loaded", {
      albumSlug,
      eventSlug,
      rows: rows.length,
      people: peopleBase.length,
    });

    if (!peopleBase.length) {
      return NextResponse.json({ people: [] });
    }

    const personIds = peopleBase.map((person) => person.id);

    const statsRows = await query<PersonEventStatsRow>(
      `
      SELECT
        pp.person_id,
        e.id AS event_id,
        e.slug AS event_slug,
        e.name AS event_name,
        COUNT(DISTINCT p.id)::int AS photo_count,
        COUNT(p.id)::int AS face_count
      FROM photo_people pp
      JOIN photos p
        ON p.id = pp.photo_id
       AND COALESCE(p.is_deleted, false) = false
       AND p.upload_status = 'completed'
      JOIN album_events e
        ON e.id = pp.album_event_id
       AND e.id = p.album_event_id
       AND COALESCE(e.is_deleted, false) = false
      JOIN albums a
        ON a.id = e.album_id
      WHERE lower(a.slug) = lower($1)
        AND COALESCE(a.is_deleted, false) = false
        AND pp.person_id = ANY($2::uuid[])
      GROUP BY
        pp.person_id,
        e.id,
        e.slug,
        e.name,
        e.sort_order
      HAVING COUNT(DISTINCT p.id) > 0
      ORDER BY e.sort_order ASC NULLS LAST, e.name ASC
      `,
      [albumSlug, personIds]
    );
    console.log("[share-debug] album people API stats loaded", {
      albumSlug,
      eventSlug,
      personIds: personIds.length,
      statsRows: statsRows.length,
    });

    const statsByPersonId = new Map<string, PersonEventStatsRow[]>();

    for (const stat of statsRows) {
      const existing = statsByPersonId.get(stat.person_id) ?? [];
      existing.push(stat);
      statsByPersonId.set(stat.person_id, existing);
    }

    const people = peopleBase.map((person) => ({
      ...person,
      eventStats: (statsByPersonId.get(person.id) ?? []).map((stat) => ({
        eventId: stat.event_id,
        eventSlug: stat.event_slug,
        eventName: stat.event_name,
        photoCount: countValue(stat.photo_count),
        faceCount: countValue(stat.face_count),
      })),
    }));

    return NextResponse.json({ people });
  } catch (error) {
    console.error("[share-debug] album people API failed", error);

    return NextResponse.json(
      { error: "Failed to fetch album people" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { toPerson, type PersonRow } from "@/lib/gallery-data";
import { requireAlbumAccess } from "@/lib/album-access";
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

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) return accessDenied;

    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get("event") || null;

    const rows = eventSlug
      ? await query<PersonRow>(
          `
          SELECT
            pe.id,
            pe.album_id,
            pe.person_number,
            pe.default_name,
            pe.display_name,
            pe.cover_face_s3_key,
            COUNT(DISTINCT pp.photo_id)::int AS photo_count,
            COUNT(*)::int AS face_count,
            COUNT(*)::int AS occurrence_count
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
          WHERE a.slug = $1
            AND COALESCE(a.is_deleted, false) = false
            AND COALESCE(pe.is_hidden, false) = false
          GROUP BY
            pe.id,
            pe.album_id,
            pe.person_number,
            pe.default_name,
            pe.display_name,
            pe.cover_face_s3_key
          ORDER BY COUNT(DISTINCT pp.photo_id) DESC, pe.person_number ASC
          `,
          [albumSlug, eventSlug]
        )
      : await query<PersonRow>(
          `
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
          JOIN albums a
            ON a.id = pe.album_id
          WHERE a.slug = $1
            AND COALESCE(a.is_deleted, false) = false
            AND COALESCE(pe.is_hidden, false) = false
          ORDER BY pe.photo_count DESC NULLS LAST, pe.person_number ASC
          `,
          [albumSlug]
        );

    const peopleBase = (await Promise.all(rows.map(toPerson))) satisfies Person[];

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
        COUNT(DISTINCT pp.photo_id)::int AS photo_count,
        COUNT(*)::int AS face_count
      FROM photo_people pp
      JOIN album_events e
        ON e.id = pp.album_event_id
       AND COALESCE(e.is_deleted, false) = false
      JOIN albums a
        ON a.id = e.album_id
      WHERE a.slug = $1
        AND COALESCE(a.is_deleted, false) = false
        AND pp.person_id = ANY($2::uuid[])
      GROUP BY
        pp.person_id,
        e.id,
        e.slug,
        e.name,
        e.sort_order
      HAVING COUNT(DISTINCT pp.photo_id) > 0
      ORDER BY e.sort_order ASC NULLS LAST, e.name ASC
      `,
      [albumSlug, personIds]
    );

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
    console.error("Error fetching album people:", error);

    return NextResponse.json(
      { error: "Failed to fetch album people" },
      { status: 500 }
    );
  }
}

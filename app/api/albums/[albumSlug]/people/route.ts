import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { toPerson, type PersonRow } from "@/lib/gallery-data";
import type { Person } from "@/lib/types";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface PersonEventStatsRow {
  person_id: string;
  event_id: string;
  event_slug: string;
  event_name: string;
  face_count: number | string | null;
  photo_count: number | string | null;
}

function countValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
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
            COALESCE(pes.face_count, 0)::int AS face_count,
            COALESCE(pes.photo_count, 0)::int AS photo_count,
            pe.occurrence_count
          FROM people pe
          JOIN albums a
            ON a.id = pe.album_id
          JOIN album_events e
            ON e.album_id = a.id
           AND e.slug = $2
           AND COALESCE(e.is_deleted, false) = false
          LEFT JOIN person_event_stats pes
            ON pes.person_id = pe.id
           AND pes.album_event_id = e.id
          WHERE a.slug = $1
            AND COALESCE(a.is_deleted, false) = false
            AND COALESCE(pe.is_hidden, false) = false
            AND COALESCE(pes.photo_count, 0) > 0
          ORDER BY COALESCE(pes.photo_count, 0) DESC, pe.person_number ASC
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
        pes.person_id,
        e.id AS event_id,
        e.slug AS event_slug,
        e.name AS event_name,
        COALESCE(pes.face_count, 0)::int AS face_count,
        COALESCE(pes.photo_count, 0)::int AS photo_count
      FROM person_event_stats pes
      JOIN album_events e
        ON e.id = pes.album_event_id
       AND COALESCE(e.is_deleted, false) = false
      JOIN albums a
        ON a.id = e.album_id
      WHERE a.slug = $1
        AND COALESCE(a.is_deleted, false) = false
        AND pes.person_id = ANY($2::uuid[])
        AND COALESCE(pes.photo_count, 0) > 0
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
        faceCount: countValue(stat.face_count),
        photoCount: countValue(stat.photo_count),
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
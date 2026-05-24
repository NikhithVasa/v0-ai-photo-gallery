import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  attachPersonEventStats,
  toPerson,
  type PersonRow,
} from "@/lib/gallery-data";
import type { Person } from "@/lib/types";

interface Props {
  params: Promise<{ albumSlug: string }>;
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
          JOIN albums a ON a.id = pe.album_id
          JOIN album_events e ON e.album_id = a.id AND e.slug = $2
          LEFT JOIN person_event_stats pes
            ON pes.person_id = pe.id
           AND pes.album_event_id = e.id
          WHERE a.slug = $1
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
          JOIN albums a ON a.id = pe.album_id
          WHERE a.slug = $1
            AND COALESCE(pe.is_hidden, false) = false
          ORDER BY pe.photo_count DESC NULLS LAST, pe.person_number ASC
          `,
          [albumSlug]
        );

    const people = await attachPersonEventStats(
      albumSlug,
      (await Promise.all(rows.map(toPerson))) satisfies Person[]
    );

    return NextResponse.json({ people });
  } catch (error) {
    console.error("Error fetching album people:", error);
    return NextResponse.json(
      { error: "Failed to fetch album people" },
      { status: 500 }
    );
  }
}

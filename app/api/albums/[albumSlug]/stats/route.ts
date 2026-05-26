import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface AlbumRow {
  id: string;
}

interface AlbumStatsRow {
  photo_count: number | string | null;
  people_count: number | string | null;
}

interface EventStatsRow {
  event_id: string;
  photo_count: number | string | null;
  people_count: number | string | null;
}

function countValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

export async function GET(_request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;

    const album = await queryOne<AlbumRow>(
      `
      SELECT id
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

    const [albumStats, eventStats] = await Promise.all([
      queryOne<AlbumStatsRow>(
        `
        SELECT
          (
            SELECT COUNT(*)::int
            FROM photos p
            WHERE p.album_id = $1::uuid
              AND COALESCE(p.is_deleted, false) = false
          ) AS photo_count,
          (
            SELECT COUNT(*)::int
            FROM people pe
            WHERE pe.album_id = $1::uuid
              AND COALESCE(pe.is_hidden, false) = false
          ) AS people_count
        `,
        [album.id]
      ),

      query<EventStatsRow>(
        `
        WITH event_photo_counts AS (
          SELECT
            event_id,
            COUNT(*)::int AS photo_count
          FROM photos
          WHERE album_id = $1::uuid
            AND COALESCE(is_deleted, false) = false
          GROUP BY event_id
        ),
        event_people_counts AS (
          SELECT
            p.event_id,
            COUNT(DISTINCT f.person_id)::int AS people_count
          FROM photos p
          JOIN photo_faces f ON f.photo_id = p.id
          JOIN people pe ON pe.id = f.person_id
          WHERE p.album_id = $1::uuid
            AND COALESCE(p.is_deleted, false) = false
            AND COALESCE(pe.is_hidden, false) = false
            AND f.person_id IS NOT NULL
          GROUP BY p.event_id
        )
        SELECT
          e.id AS event_id,
          COALESCE(epc.photo_count, 0)::int AS photo_count,
          COALESCE(epec.people_count, 0)::int AS people_count
        FROM album_events e
        LEFT JOIN event_photo_counts epc ON epc.event_id = e.id
        LEFT JOIN event_people_counts epec ON epec.event_id = e.id
        WHERE e.album_id = $1::uuid
          AND COALESCE(e.is_deleted, false) = false
        `,
        [album.id]
      ),
    ]);

    return NextResponse.json(
      {
        stats: {
          photoCount: countValue(albumStats?.photo_count ?? 0),
          peopleCount: countValue(albumStats?.people_count ?? 0),
          events: eventStats.map((event) => ({
            eventId: event.event_id,
            photoCount: countValue(event.photo_count),
            peopleCount: countValue(event.people_count),
          })),
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching album stats:", error);

    return NextResponse.json(
      { error: "Failed to fetch album stats" },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAlbumAccess } from "@/lib/album-access";

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
  pending_ai_count: number | string | null;
}

function countValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const url = new URL(request.url);
    const shareToken = url.searchParams.get("share") || "";
    console.info("[share-debug] album stats API start", {
      albumSlug,
      hasShareToken: Boolean(shareToken),
      shareToken: shareToken ? `${shareToken.slice(0, 6)}...${shareToken.slice(-4)}` : "",
    });

    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) {
      console.warn("[share-debug] album stats API access denied", {
        albumSlug,
        status: accessDenied.status,
      });
      return accessDenied;
    }

    console.info("[share-debug] album stats API querying album", {
      albumSlug,
    });
    const album = await queryOne<AlbumRow>(
      `
      SELECT id
      FROM albums
      WHERE lower(slug) = lower($1)
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      `,
      [albumSlug]
    );

    if (!album) {
      console.warn("[share-debug] album stats API album not found", {
        albumSlug,
      });
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    console.info("[share-debug] album stats API album found", {
      albumSlug,
      albumId: album.id,
    });

    const [albumStats, eventStats] = await Promise.all([
      queryOne<AlbumStatsRow>(
        `
        SELECT
          (
            SELECT COUNT(*)::int
            FROM photos p
            WHERE p.album_id = $1::uuid
              AND COALESCE(p.is_deleted, false) = false
              AND p.upload_status = 'completed'
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
            album_event_id,
            COUNT(*)::int AS photo_count,
            COUNT(*) FILTER (
              WHERE lower(COALESCE(face_index_status, '')) IN (
                      'pending',
                      'queued',
                      'submitted',
                      'processing',
                      'running',
                      'started',
                      'in_progress'
                    )
                 OR lower(COALESCE(qwen_status, '')) IN (
                      'pending',
                      'queued',
                      'submitted',
                      'processing',
                      'running',
                      'started',
                      'in_progress'
                    )
                 OR lower(COALESCE(search_index_status, '')) IN (
                      'pending',
                      'queued',
                      'submitted',
                      'processing',
                      'running',
                      'started',
                      'in_progress'
                    )
            )::int AS pending_ai_count
          FROM photos
          WHERE album_id = $1::uuid
            AND COALESCE(is_deleted, false) = false
            AND upload_status = 'completed'
          GROUP BY album_event_id
        ),
        event_people_counts AS (
          SELECT
            pes.album_event_id,
            COUNT(DISTINCT pes.person_id)::int AS people_count
          FROM person_event_stats pes
          JOIN people pe ON pe.id = pes.person_id
          WHERE pes.photo_count > 0
            AND COALESCE(pe.is_hidden, false) = false
          GROUP BY pes.album_event_id
        )
        SELECT
          e.id AS event_id,
          COALESCE(epc.photo_count, 0)::int AS photo_count,
          COALESCE(epec.people_count, 0)::int AS people_count,
          COALESCE(epc.pending_ai_count, 0)::int AS pending_ai_count
        FROM album_events e
        LEFT JOIN event_photo_counts epc ON epc.album_event_id = e.id
        LEFT JOIN event_people_counts epec ON epec.album_event_id = e.id
        WHERE e.album_id = $1::uuid
          AND COALESCE(e.is_deleted, false) = false
        ORDER BY e.sort_order ASC NULLS LAST, e.name ASC
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
            pendingAiCount: countValue(event.pending_ai_count),
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
    console.error("[share-debug] album stats API failed", {
      error,
    });

    return NextResponse.json(
      { error: "Failed to fetch album stats" },
      { status: 500 }
    );
  }
}

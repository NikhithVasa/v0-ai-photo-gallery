import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  getAuthAccess,
  unauthorizedResponse,
} from "@/lib/auth-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AlbumStatsRow {
  album_id: string;
  event_count: number | string | null;
  photo_count: number | string | null;
  people_count: number | string | null;
}

function countValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

export async function GET() {
  try {
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();

    const rows = await query<AlbumStatsRow>(
      `
      WITH event_counts AS (
        SELECT
          album_id,
          COUNT(*)::int AS event_count
        FROM album_events
        WHERE COALESCE(is_deleted, false) = false
        GROUP BY album_id
      ),
      photo_counts AS (
        SELECT
          album_id,
          COUNT(*)::int AS photo_count
        FROM photos
        WHERE COALESCE(is_deleted, false) = false
          AND upload_status = 'completed'
        GROUP BY album_id
      ),
      people_counts AS (
        SELECT
          album_id,
          COUNT(*)::int AS people_count
        FROM people
        WHERE COALESCE(is_hidden, false) = false
        GROUP BY album_id
      )
      SELECT
        a.id AS album_id,
        COALESCE(ec.event_count, 0)::int AS event_count,
        COALESCE(pc.photo_count, 0)::int AS photo_count,
        COALESCE(pec.people_count, 0)::int AS people_count
      FROM albums a
      LEFT JOIN event_counts ec ON ec.album_id = a.id
      LEFT JOIN photo_counts pc ON pc.album_id = a.id
      LEFT JOIN people_counts pec ON pec.album_id = a.id
      LEFT JOIN customers c
        ON c.id = a.customer_id
       AND COALESCE(c.is_deleted, false) = false
      WHERE COALESCE(a.is_deleted, false) = false
        AND (
          $1::boolean = true
          OR a.customer_id = ANY($2::uuid[])
        )
      `,
      [access.isAdmin, access.customerIds]
    );

    const stats = rows.map((row) => ({
      albumId: row.album_id,
      eventCount: countValue(row.event_count),
      photoCount: countValue(row.photo_count),
      peopleCount: countValue(row.people_count),
    }));

    return NextResponse.json(
      { stats },
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

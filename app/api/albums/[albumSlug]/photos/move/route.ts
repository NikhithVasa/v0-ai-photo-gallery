import { NextResponse } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { fetchAlbumEvents } from "@/lib/gallery-data";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function uniqueUuidList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter(isUuid))).slice(0, 500);
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json()) as {
      photoIds?: unknown;
      eventSlug?: unknown;
    };
    const photoIds = uniqueUuidList(body.photoIds);
    const eventSlug =
      typeof body.eventSlug === "string" && body.eventSlug.trim()
        ? body.eventSlug.trim()
        : "";

    if (!photoIds.length || !eventSlug) {
      return NextResponse.json(
        { error: "photoIds and eventSlug are required" },
        { status: 400 },
      );
    }

    const album = await queryOne<{ id: string }>(
      `
      SELECT id
      FROM albums
      WHERE lower(slug) = lower($1)
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      `,
      [albumSlug],
    );

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const targetEvent = await queryOne<{ id: string; slug: string; name: string }>(
      `
      SELECT id, slug, name
      FROM album_events
      WHERE album_id = $1::uuid
        AND slug = $2
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      `,
      [album.id, eventSlug],
    );

    if (!targetEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const result = await withTransaction(async (client) => {
      const moved = await client.query<{
        photo_id: string;
        old_event_id: string;
      }>(
        `
        WITH selected AS (
          SELECT id, album_event_id AS old_event_id
          FROM photos
          WHERE album_id = $1::uuid
            AND id = ANY($2::uuid[])
            AND album_event_id <> $3::uuid
            AND COALESCE(is_deleted, false) = false
        )
        UPDATE photos p
        SET album_event_id = $3::uuid,
            updated_at = now()
        FROM selected s
        WHERE p.id = s.id
        RETURNING p.id AS photo_id, s.old_event_id
        `,
        [album.id, photoIds, targetEvent.id],
      );

      const movedRows = moved.rows as Array<{
        photo_id: string;
        old_event_id: string;
      }>;
      const movedPhotoIds = movedRows.map((row) => row.photo_id);
      const affectedEventIds = Array.from(
        new Set([
          targetEvent.id,
          ...movedRows.map((row) => row.old_event_id),
        ]),
      );

      if (!movedPhotoIds.length) {
        return { movedPhotoIds, affectedPeopleCount: 0 };
      }

      await client.query(
        `
        UPDATE photo_people
        SET album_event_id = $2::uuid
        WHERE photo_id = ANY($1::uuid[])
        `,
        [movedPhotoIds, targetEvent.id],
      );

      await client.query(
        `
        DELETE FROM photo_sort_positions
        WHERE album_id = $1::uuid
          AND photo_id = ANY($2::uuid[])
          AND scope = 'event'
        `,
        [album.id, movedPhotoIds],
      );

      const affectedPeople = await client.query<{ person_id: string }>(
        `
        SELECT DISTINCT person_id
        FROM photo_people
        WHERE photo_id = ANY($1::uuid[])
        `,
        [movedPhotoIds],
      );
      const affectedPeopleRows = affectedPeople.rows as Array<{ person_id: string }>;
      const affectedPersonIds = affectedPeopleRows.map((row) => row.person_id);

      if (affectedPersonIds.length && affectedEventIds.length) {
        await client.query(
          `
          DELETE FROM person_event_stats
          WHERE person_id = ANY($1::uuid[])
            AND album_event_id = ANY($2::uuid[])
          `,
          [affectedPersonIds, affectedEventIds],
        );

        await client.query(
          `
          INSERT INTO person_event_stats(
            person_id,
            album_event_id,
            photo_count,
            face_count
          )
          SELECT
            pp.person_id,
            pp.album_event_id,
            COUNT(DISTINCT pp.photo_id)::int,
            COUNT(*)::int
          FROM photo_people pp
          WHERE pp.person_id = ANY($1::uuid[])
            AND pp.album_event_id = ANY($2::uuid[])
          GROUP BY pp.person_id, pp.album_event_id
          `,
          [affectedPersonIds, affectedEventIds],
        );
      }

      return {
        movedPhotoIds,
        affectedPeopleCount: affectedPersonIds.length,
      };
    });

    const events = await fetchAlbumEvents(albumSlug);

    return NextResponse.json({
      ok: true,
      event: targetEvent,
      movedPhotoIds: result.movedPhotoIds,
      movedCount: result.movedPhotoIds.length,
      affectedPeopleCount: result.affectedPeopleCount,
      events,
    });
  } catch (error) {
    console.error("Error moving photos:", error);
    return NextResponse.json(
      { error: "Failed to move selected photos" },
      { status: 500 },
    );
  }
}

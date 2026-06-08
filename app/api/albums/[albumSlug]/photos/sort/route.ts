import { NextResponse } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import {
  ensurePhotoSortSchema,
  normalizePhotoSortMode,
} from "@/lib/photo-sort";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface SortPositionInput {
  photoId?: unknown;
  position?: unknown;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function parsePositions(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .map((item): { photoId: string; position: number } | null => {
      const position = item as SortPositionInput;
      if (!isUuid(position.photoId)) return null;
      if (seen.has(position.photoId)) return null;

      seen.add(position.photoId);
      const nextPosition =
        typeof position.position === "number"
          ? Math.max(1, Math.floor(position.position))
          : 0;

      return nextPosition
        ? { photoId: position.photoId, position: nextPosition }
        : null;
    })
    .filter((item): item is { photoId: string; position: number } =>
      Boolean(item),
    )
    .sort((a, b) => a.position - b.position);
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    await ensurePhotoSortSchema();

    const body = (await request.json()) as {
      eventSlug?: unknown;
      sortMode?: unknown;
      positions?: unknown;
    };
    const sortMode = normalizePhotoSortMode(body.sortMode);
    const eventSlug =
      typeof body.eventSlug === "string" && body.eventSlug.trim()
        ? body.eventSlug.trim()
        : null;

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

    const event = eventSlug
      ? await queryOne<{ id: string }>(
          `
          SELECT id
          FROM album_events
          WHERE album_id = $1::uuid
            AND slug = $2
            AND COALESCE(is_deleted, false) = false
          LIMIT 1
          `,
          [album.id, eventSlug],
        )
      : null;

    if (eventSlug && !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const parsedPositions = parsePositions(body.positions);
    const normalizedPositions = parsedPositions.map((position, index) => ({
      photoId: position.photoId,
      position: index + 1,
    }));

    await withTransaction(async (client) => {
      if (event) {
        await client.query(
          `
          UPDATE album_events
          SET photo_sort_mode = $3,
              updated_at = now()
          WHERE album_id = $1::uuid
            AND id = $2::uuid
          `,
          [album.id, event.id, sortMode],
        );
      } else {
        await client.query(
          `
          UPDATE albums
          SET photo_sort_mode = $2,
              updated_at = now()
          WHERE id = $1::uuid
          `,
          [album.id, sortMode],
        );
      }

      if (sortMode === "custom" && normalizedPositions.length) {
        await client.query(
          `
          INSERT INTO photo_sort_positions (
            album_id,
            album_event_id,
            scope,
            photo_id,
            position,
            updated_at
          )
          SELECT
            $1::uuid,
            $4::uuid,
            CASE WHEN $4::uuid IS NULL THEN 'album' ELSE 'event' END,
            ordered.photo_id,
            ordered.position,
            now()
          FROM (
            SELECT *
            FROM unnest($2::uuid[], $3::int[]) AS ordered(photo_id, position)
          ) ordered
          JOIN photos p ON p.id = ordered.photo_id
          WHERE p.album_id = $1::uuid
            AND ($4::uuid IS NULL OR p.album_event_id = $4::uuid)
            AND COALESCE(p.is_deleted, false) = false
          ON CONFLICT (album_id, scope, photo_id)
          DO UPDATE SET
            album_event_id = EXCLUDED.album_event_id,
            position = EXCLUDED.position,
            updated_at = now()
          `,
          [
            album.id,
            normalizedPositions.map((position) => position.photoId),
            normalizedPositions.map((position) => position.position),
            event?.id ?? null,
          ],
        );
      }
    });

    return NextResponse.json({
      ok: true,
      sortMode,
      eventSlug,
      positions:
        sortMode === "custom" && normalizedPositions.length
          ? normalizedPositions
          : undefined,
    });
  } catch (error) {
    console.error("Error saving photo sort:", error);
    return NextResponse.json(
      { error: "Failed to save sort order" },
      { status: 500 },
    );
  }
}

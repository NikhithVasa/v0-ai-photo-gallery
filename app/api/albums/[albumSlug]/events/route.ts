import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { fetchAlbumEvents } from "@/lib/gallery-data";
import { requireAlbumAccess } from "@/lib/album-access";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface AlbumRow {
  id: string;
  slug: string;
  customer_id: string | null;
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || randomUUID()
  );
}

async function hasEventSourcePrefix() {
  const row = await queryOne<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'album_events'
        AND column_name = 'source_prefix'
    ) AS exists
    `,
    []
  );

  return Boolean(row?.exists);
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) return accessDenied;

    const events = await fetchAlbumEvents(albumSlug);
    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error fetching album events:", error);
    return NextResponse.json(
      { error: "Failed to fetch album events" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
    };
    const eventName = typeof body.name === "string" ? body.name.trim() : "";

    if (!eventName) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const album = await queryOne<AlbumRow>(
      `
      SELECT id, slug, customer_id
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

    const eventSlug = slugify(eventName);
    const sourcePrefix = `albums/${album.slug}/events/${eventSlug}`;
    const sourcePrefixSelect = (await hasEventSourcePrefix())
      ? "source_prefix"
      : "NULL::text AS source_prefix";
    const hasSourcePrefix = sourcePrefixSelect === "source_prefix";

    const event = await queryOne<{ id: string; slug: string; name: string }>(
      hasSourcePrefix
        ? `
      INSERT INTO album_events(album_id, customer_id, name, slug, source_prefix, sort_order, created_at, updated_at)
      VALUES(
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        $5,
        COALESCE(
          (SELECT MAX(sort_order) + 1 FROM album_events WHERE album_id = $1::uuid),
          1
        ),
        now(),
        now()
      )
      ON CONFLICT(album_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        customer_id = EXCLUDED.customer_id,
        source_prefix = COALESCE(album_events.source_prefix, EXCLUDED.source_prefix),
        updated_at = now()
      RETURNING id, slug, name
      `
        : `
      INSERT INTO album_events(album_id, customer_id, name, slug, sort_order, created_at, updated_at)
      VALUES(
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        COALESCE(
          (SELECT MAX(sort_order) + 1 FROM album_events WHERE album_id = $1::uuid),
          1
        ),
        now(),
        now()
      )
      ON CONFLICT(album_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        customer_id = EXCLUDED.customer_id,
        updated_at = now()
      RETURNING id, slug, name
      `,
      hasSourcePrefix
        ? [album.id, album.customer_id, eventName, eventSlug, sourcePrefix]
        : [album.id, album.customer_id, eventName, eventSlug]
    );

    if (!event) {
      throw new Error("Could not create event");
    }

    return NextResponse.json({ event, events: await fetchAlbumEvents(albumSlug) });
  } catch (error) {
    console.error("Error creating album event:", error);
    return NextResponse.json(
      { error: "Failed to create album event" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json()) as {
      eventId?: unknown;
      eventSlug?: unknown;
      name?: unknown;
    };
    const eventKey =
      typeof body.eventId === "string" && body.eventId.trim()
        ? body.eventId.trim()
        : typeof body.eventSlug === "string" && body.eventSlug.trim()
          ? body.eventSlug.trim()
          : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!eventKey || !name) {
      return NextResponse.json(
        { error: "eventId/eventSlug and name are required" },
        { status: 400 }
      );
    }

    const updated = await queryOne<{ id: string }>(
      `
      UPDATE album_events e
      SET name = $3,
          updated_at = now()
      FROM albums a
      WHERE e.album_id = a.id
        AND a.slug = $1
        AND (e.id::text = $2 OR e.slug = $2)
        AND COALESCE(e.is_deleted, false) = false
      RETURNING e.id
      `,
      [albumSlug, eventKey, name]
    );

    if (!updated) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const events = await fetchAlbumEvents(albumSlug);
    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error updating album event:", error);
    return NextResponse.json(
      { error: "Failed to update album event" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json().catch(() => ({}))) as {
      eventId?: unknown;
      eventSlug?: unknown;
    };
    const eventKey =
      typeof body.eventId === "string" && body.eventId.trim()
        ? body.eventId.trim()
        : typeof body.eventSlug === "string" && body.eventSlug.trim()
          ? body.eventSlug.trim()
          : "";

    if (!eventKey) {
      return NextResponse.json(
        { error: "eventId or eventSlug is required" },
        { status: 400 }
      );
    }

    const event = await queryOne<{ id: string }>(
      `
      UPDATE album_events e
      SET is_deleted = true,
          deleted_at = now(),
          updated_at = now()
      FROM albums a
      WHERE e.album_id = a.id
        AND a.slug = $1
        AND (e.id::text = $2 OR e.slug = $2)
        AND COALESCE(e.is_deleted, false) = false
      RETURNING e.id
      `,
      [albumSlug, eventKey]
    );

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await query(
      `
      UPDATE photos
      SET is_deleted = true,
          deleted_at = now(),
          updated_at = now()
      WHERE album_event_id = $1::uuid
        AND COALESCE(is_deleted, false) = false
      `,
      [event.id]
    );

    const events = await fetchAlbumEvents(albumSlug);
    return NextResponse.json({ ok: true, events });
  } catch (error) {
    console.error("Error deleting album event:", error);
    return NextResponse.json(
      { error: "Failed to delete album event" },
      { status: 500 }
    );
  }
}

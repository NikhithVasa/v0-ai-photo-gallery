import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { fetchAlbumEvents } from "@/lib/gallery-data";
import { requireAlbumAccess } from "@/lib/album-access";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
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

import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { fetchAlbumEvents } from "@/lib/gallery-data";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

export async function GET(_request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
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

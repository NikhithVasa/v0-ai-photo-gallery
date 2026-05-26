import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import type { AlbumDetail } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface AlbumRow {
  id: string;
  slug: string;
  name: string;
  password_required: boolean | null;
  watermark_enabled: boolean | null;
}

interface EventRow {
  id: string;
  slug: string;
  name: string;
  sort_order: number | string | null;
}

function numberValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

export async function GET(_request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;

    const album = await queryOne<AlbumRow>(
      `
      SELECT
        id,
        slug,
        name,
        password_required,
        watermark_enabled
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

    const events = await query<EventRow>(
      `
      SELECT
        id,
        slug,
        name,
        sort_order
      FROM album_events
      WHERE album_id = $1::uuid
        AND COALESCE(is_deleted, false) = false
      ORDER BY sort_order ASC NULLS LAST, name ASC
      `,
      [album.id]
    );

    const detail: AlbumDetail = {
      id: album.id,
      slug: album.slug,
      name: album.name,
      passwordRequired: Boolean(album.password_required),
      watermarkEnabled: Boolean(album.watermark_enabled),

      events: events.map((event) => ({
        id: event.id,
        slug: event.slug,
        name: event.name,
        sortOrder: numberValue(event.sort_order),

        // Loaded later by /api/albums/[albumSlug]/stats
        photoCount: 0,
        peopleCount: 0,
      })),

      // Loaded later by /api/albums/[albumSlug]/stats
      photoCount: 0,
      peopleCount: 0,
    };

    return NextResponse.json(
      { album: detail },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching album:", error);

    return NextResponse.json(
      { error: "Failed to fetch album" },
      { status: 500 }
    );
  }
}
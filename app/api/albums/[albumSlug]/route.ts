import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { fetchAlbumEvents } from "@/lib/gallery-data";
import type { AlbumDetail } from "@/lib/types";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface AlbumRow {
  id: string;
  slug: string;
  name: string;
  password_required: boolean | null;
  watermark_enabled: boolean | null;
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
      SELECT
        a.id,
        a.slug,
        a.name,
        a.password_required,
        a.watermark_enabled,
        COUNT(DISTINCT CASE
          WHEN COALESCE(p.is_deleted, false) = false THEN p.id
        END)::int AS photo_count,
        COUNT(DISTINCT CASE
          WHEN COALESCE(pe.is_hidden, false) = false THEN pe.id
        END)::int AS people_count
      FROM albums a
      LEFT JOIN photos p ON p.album_id = a.id
      LEFT JOIN people pe ON pe.album_id = a.id
      WHERE a.slug = $1
      GROUP BY a.id
      `,
      [albumSlug]
    );

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const events = await fetchAlbumEvents(albumSlug);
    const detail: AlbumDetail = {
      id: album.id,
      slug: album.slug,
      name: album.name,
      passwordRequired: Boolean(album.password_required),
      watermarkEnabled: Boolean(album.watermark_enabled),
      events,
      photoCount: countValue(album.photo_count),
      peopleCount: countValue(album.people_count),
    };

    return NextResponse.json({ album: detail });
  } catch (error) {
    console.error("Error fetching album:", error);
    return NextResponse.json(
      { error: "Failed to fetch album" },
      { status: 500 }
    );
  }
}

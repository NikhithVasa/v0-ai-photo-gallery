import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import type { AlbumDetail } from "@/lib/types";
import { signedUrl } from "@/lib/s3";

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
  cover_photo_s3_key: string | null;
  photo_count: number | string | null;
  people_count: number | string | null;
  customer_id: string | null;
  customer_slug: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
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
  a.id,
  a.slug,
  a.name,
  a.password_required,
  a.watermark_enabled,
  COALESCE(
    a.cover_photo_s3_key,
    fallback_cover.cover_photo_s3_key
  ) AS cover_photo_s3_key,
  COUNT(DISTINCT CASE
    WHEN COALESCE(p.is_deleted, false) = false THEN p.id
  END)::int AS photo_count,
  COUNT(DISTINCT CASE
    WHEN COALESCE(pe.is_hidden, false) = false THEN pe.id
  END)::int AS people_count,
  c.id AS customer_id,
  c.slug AS customer_slug,
  c.name AS customer_name,
  c.email AS customer_email,
  c.phone AS customer_phone
FROM albums a
LEFT JOIN customers c
  ON c.id = a.customer_id
 AND COALESCE(c.is_deleted, false) = false
LEFT JOIN photos p ON p.album_id = a.id
LEFT JOIN people pe ON pe.album_id = a.id
LEFT JOIN LATERAL (
  SELECT COALESCE(
    p2.thumbnail_s3_key,
    p2.watermarked_preview_s3_key,
    p2.clean_preview_s3_key,
    p2.original_s3_key
  ) AS cover_photo_s3_key
  FROM photos p2
  WHERE p2.album_id = a.id
    AND COALESCE(p2.is_deleted, false) = false
  ORDER BY p2.created_at ASC
  LIMIT 1
) fallback_cover ON true
WHERE a.slug = $1
GROUP BY
  a.id,
  fallback_cover.cover_photo_s3_key,
  c.id,
  c.slug,
  c.name,
  c.email,
  c.phone
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
      coverPhotoUrl: await signedUrl(album.cover_photo_s3_key),
customer: album.customer_id
  ? {
      id: album.customer_id,
      slug: album.customer_slug,
      name: album.customer_name ?? "",
      email: album.customer_email,
      phone: album.customer_phone,
    }
  : null,
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
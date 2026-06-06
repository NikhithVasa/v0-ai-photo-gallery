import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { signedUrl } from "@/lib/s3";
import { requireAlbumAccess } from "@/lib/album-access";
import { ensureCustomerAccessSchema } from "@/lib/customer-schema";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
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
  description: string | null;
  album_date: Date | string | null;
  expires_at: Date | string | null;
  is_expired: boolean | null;
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
  customer_cover_photo_s3_key: string | null;
  customer_password_required: boolean | null;
}

interface EventRow {
  id: string;
  slug: string;
  name: string;
  sort_order: number | string | null;
  photo_count: number | string | null;
  people_count: number | string | null;
}

function numberValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

function dateValue(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) return accessDenied;

    await ensureCustomerAccessSchema();

    const album = await queryOne<AlbumRow>(
      `
      WITH selected_album AS (
        SELECT
          a.id,
          a.slug,
          a.name,
          a.description,
          a.album_date,
          a.expires_at,
          (a.expires_at IS NOT NULL AND a.expires_at < CURRENT_DATE) AS is_expired,
          a.password_required,
          a.watermark_enabled,
          a.cover_photo_s3_key,
          a.customer_id
        FROM albums a
        WHERE lower(a.slug) = lower($1)
          AND COALESCE(a.is_deleted, false) = false
        LIMIT 1
      ),

      photo_counts AS (
        SELECT
          p.album_id,
          COUNT(*)::int AS photo_count
        FROM photos p
        JOIN selected_album a ON a.id = p.album_id
        WHERE COALESCE(p.is_deleted, false) = false
          AND p.upload_status = 'completed'
        GROUP BY p.album_id
      ),

      people_counts AS (
        SELECT
          pe.album_id,
          COUNT(*)::int AS people_count
        FROM people pe
        JOIN selected_album a ON a.id = pe.album_id
        WHERE COALESCE(pe.is_hidden, false) = false
        GROUP BY pe.album_id
      )

      SELECT
        a.id,
        a.slug,
        a.name,
        a.description,
        a.album_date,
        a.expires_at,
        a.is_expired,
        a.password_required,
        a.watermark_enabled,
        a.cover_photo_s3_key,

        COALESCE(pc.photo_count, 0)::int AS photo_count,
        COALESCE(pec.people_count, 0)::int AS people_count,

        c.id AS customer_id,
        c.slug AS customer_slug,
        c.name AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone,
        c.cover_photo_s3_key AS customer_cover_photo_s3_key,
        c.password_required AS customer_password_required

      FROM selected_album a

      LEFT JOIN photo_counts pc
        ON pc.album_id = a.id

      LEFT JOIN people_counts pec
        ON pec.album_id = a.id

      LEFT JOIN customers c
        ON c.id = a.customer_id
       AND COALESCE(c.is_deleted, false) = false
      `,
      [albumSlug]
    );

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const events = await query<EventRow>(
      `
      WITH selected_album AS (
        SELECT id
        FROM albums
        WHERE lower(slug) = lower($1)
          AND COALESCE(is_deleted, false) = false
        LIMIT 1
      ),

      active_events AS (
        SELECT
          e.id,
          e.slug,
          e.name,
          e.sort_order,
          e.album_id
        FROM album_events e
        JOIN selected_album a ON a.id = e.album_id
        WHERE COALESCE(e.is_deleted, false) = false
      ),

      photo_counts AS (
        SELECT
          p.album_event_id,
          COUNT(*)::int AS photo_count
        FROM photos p
        JOIN active_events e ON e.id = p.album_event_id
        WHERE COALESCE(p.is_deleted, false) = false
          AND p.upload_status = 'completed'
        GROUP BY p.album_event_id
      ),

      people_counts AS (
        SELECT
          pes.album_event_id,
          COUNT(*)::int AS people_count
        FROM person_event_stats pes
        JOIN active_events e ON e.id = pes.album_event_id
        WHERE COALESCE(pes.photo_count, 0) > 0
        GROUP BY pes.album_event_id
      )

      SELECT
        e.id,
        e.slug,
        e.name,
        e.sort_order,
        COALESCE(pc.photo_count, 0)::int AS photo_count,
        COALESCE(pec.people_count, 0)::int AS people_count
      FROM active_events e
      LEFT JOIN photo_counts pc
        ON pc.album_event_id = e.id
      LEFT JOIN people_counts pec
        ON pec.album_event_id = e.id
      ORDER BY e.sort_order ASC NULLS LAST, e.name ASC
      `,
      [albumSlug]
    );

    const detail: AlbumDetail = {
      id: album.id,
      slug: album.slug,
      name: album.name,
      description: album.description,
      albumDate: dateValue(album.album_date),
      expiresAt: dateValue(album.expires_at),
      isExpired: Boolean(album.is_expired),
      passwordRequired: Boolean(album.password_required),
      watermarkEnabled: Boolean(album.watermark_enabled),

      events: events.map((event) => ({
        id: event.id,
        slug: event.slug,
        name: event.name,
        sortOrder: numberValue(event.sort_order),
        photoCount: numberValue(event.photo_count),
        peopleCount: numberValue(event.people_count),
      })),

      photoCount: numberValue(album.photo_count),
      peopleCount: numberValue(album.people_count),

      coverPhotoUrl: await signedUrl(album.cover_photo_s3_key),

      customer: album.customer_id
        ? {
            id: album.customer_id,
            slug: album.customer_slug,
            name: album.customer_name ?? "",
            email: album.customer_email,
            phone: album.customer_phone,
            coverPhotoUrl: await signedUrl(album.customer_cover_photo_s3_key),
            passwordRequired: Boolean(album.customer_password_required),
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

export async function DELETE(_request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const album = await queryOne<{ id: string; name: string }>(
      `
      UPDATE albums
      SET is_deleted = true,
          deleted_at = now(),
          updated_at = now()
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      RETURNING id, name
      `,
      [albumSlug]
    );

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, album });
  } catch (error) {
    console.error("Error deleting album:", error);

    return NextResponse.json(
      { error: "Failed to delete album" },
      { status: 500 }
    );
  }
}

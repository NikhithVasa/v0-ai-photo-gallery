import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { signedUrl } from "@/lib/s3";
import { getCustomerSlugFromRequest } from "@/lib/customer-host";
import { ensureCustomerAccessSchema } from "@/lib/customer-schema";
import type { AlbumSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ customerSlug: string }>;
}

interface CustomerAlbumRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  album_date: Date | string | null;
  expires_at: Date | string | null;
  is_expired: boolean | null;
  password_required: boolean | null;
  cover_photo_s3_key: string | null;
  event_count: number | string | null;
  photo_count: number | string | null;
  people_count: number | string | null;
  created_at: Date | string | null;

  customer_id: string;
  customer_slug: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_cover_photo_s3_key: string | null;
  customer_password_required: boolean | null;
}

function countValue(value: number | string | null) {
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
    await ensureCustomerAccessSchema();

    const { customerSlug } = await params;
    const hostCustomerSlug = getCustomerSlugFromRequest(request);
    const hideExpired = Boolean(hostCustomerSlug);

    const rows = await query<CustomerAlbumRow>(
      `
      WITH customer AS (
        SELECT
          c.id,
          c.slug,
          c.name,
          c.email,
          c.phone,
          c.cover_photo_s3_key,
          c.password_required
        FROM customers c
        WHERE c.slug = $1
          AND COALESCE(c.is_deleted, false) = false
        LIMIT 1
      ),

      customer_albums AS (
        SELECT
          a.id,
          a.slug,
          a.name,
          a.description,
          a.album_date,
          a.expires_at,
          (a.expires_at IS NOT NULL AND a.expires_at < CURRENT_DATE) AS is_expired,
          a.password_required,
          a.cover_photo_s3_key,
          a.created_at,
          a.customer_id
        FROM albums a
        JOIN customer c ON c.id = a.customer_id
        WHERE COALESCE(a.is_deleted, false) = false
          AND ($2::boolean = false OR a.expires_at IS NULL OR a.expires_at >= CURRENT_DATE)
      ),

      event_counts AS (
        SELECT
          e.album_id,
          COUNT(*)::int AS event_count
        FROM album_events e
        JOIN customer_albums a ON a.id = e.album_id
        WHERE COALESCE(e.is_deleted, false) = false
        GROUP BY e.album_id
      ),

      photo_counts AS (
        SELECT
          p.album_id,
          COUNT(*)::int AS photo_count
        FROM photos p
        JOIN customer_albums a ON a.id = p.album_id
        WHERE COALESCE(p.is_deleted, false) = false
          AND p.upload_status = 'completed'
        GROUP BY p.album_id
      ),

      people_counts AS (
        SELECT
          pe.album_id,
          COUNT(*)::int AS people_count
        FROM people pe
        JOIN customer_albums a ON a.id = pe.album_id
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
        a.cover_photo_s3_key,
        COALESCE(ec.event_count, 0)::int AS event_count,
        COALESCE(pc.photo_count, 0)::int AS photo_count,
        COALESCE(pec.people_count, 0)::int AS people_count,
        a.created_at,

        c.id AS customer_id,
        c.slug AS customer_slug,
        c.name AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone,
        c.cover_photo_s3_key AS customer_cover_photo_s3_key,
        c.password_required AS customer_password_required

      FROM customer_albums a
      JOIN customer c ON c.id = a.customer_id
      LEFT JOIN event_counts ec ON ec.album_id = a.id
      LEFT JOIN photo_counts pc ON pc.album_id = a.id
      LEFT JOIN people_counts pec ON pec.album_id = a.id
      ORDER BY a.created_at DESC NULLS LAST, a.name ASC
      `,
      [customerSlug, hideExpired]
    );

    if (!rows.length) {
      const customerRows = await query<{
        id: string;
        slug: string;
        name: string;
        email: string | null;
        phone: string | null;
        cover_photo_s3_key: string | null;
        password_required: boolean | null;
      }>(
        `
        SELECT id, slug, name, email, phone, cover_photo_s3_key, password_required
        FROM customers
        WHERE slug = $1
          AND COALESCE(is_deleted, false) = false
        LIMIT 1
        `,
        [customerSlug]
      );

      if (!customerRows.length) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }

      const customer = customerRows[0];

      return NextResponse.json({
        customer: {
          id: customer.id,
          slug: customer.slug,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          coverPhotoUrl: await signedUrl(customer.cover_photo_s3_key),
          passwordRequired: Boolean(customer.password_required),
        },
        albums: [],
      });
    }

    const first = rows[0];

    const albums: AlbumSummary[] = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        albumDate: dateValue(row.album_date),
        expiresAt: dateValue(row.expires_at),
        isExpired: Boolean(row.is_expired),
        passwordRequired: Boolean(row.password_required),
        coverPhotoUrl: await signedUrl(row.cover_photo_s3_key),
        eventCount: countValue(row.event_count),
        photoCount: countValue(row.photo_count),
        peopleCount: countValue(row.people_count),
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at ?? "",
        customer: {
          id: row.customer_id,
          slug: row.customer_slug,
          name: row.customer_name,
          email: row.customer_email,
          phone: row.customer_phone,
          coverPhotoUrl: await signedUrl(row.customer_cover_photo_s3_key),
          passwordRequired: Boolean(row.customer_password_required),
        },
      }))
    );

    return NextResponse.json({
      customer: {
        id: first.customer_id,
        slug: first.customer_slug,
        name: first.customer_name,
        email: first.customer_email,
        phone: first.customer_phone,
        coverPhotoUrl: await signedUrl(first.customer_cover_photo_s3_key),
        passwordRequired: Boolean(first.customer_password_required),
      },
      albums,
    });
  } catch (error) {
    console.error("Error fetching customer albums:", error);

    return NextResponse.json(
      { error: "Failed to fetch customer albums" },
      { status: 500 }
    );
  }
}

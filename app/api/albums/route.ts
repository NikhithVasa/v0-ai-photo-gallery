import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { signedUploadUrl, signedUrl } from "@/lib/s3";
import { getCustomerSlugFromRequest } from "@/lib/customer-host";
import { ensureCustomerAccessSchema } from "@/lib/customer-schema";
import {
  getAuthAccess,
  unauthorizedResponse,
} from "@/lib/auth-access";
import type { AlbumSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AlbumSummaryRow {
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

  customer_id: string | null;
  customer_slug: string | null;
  customer_name: string | null;
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

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || randomUUID()
  );
}

function extensionFromFileName(fileName: string) {
  const match = fileName
    .toLowerCase()
    .match(/\.(jpe?g|png|webp|gif|avif|heic|heif)$/);
  return match ? `.${match[1]}` : ".jpg";
}

function contentTypeFromInput(contentType: unknown, fileName: string) {
  if (typeof contentType === "string" && contentType.startsWith("image/")) {
    return contentType;
  }

  const ext = extensionFromFileName(fileName);
  return (
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".avif": "image/avif",
      ".heic": "image/heic",
      ".heif": "image/heif",
    }[ext] ?? "application/octet-stream"
  );
}

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

async function availableAlbumSlug(baseValue: string) {
  const baseSlug = slugify(baseValue);
  const existing = await queryOne<{ id: string }>(
    `
    SELECT id
    FROM albums
    WHERE slug = $1
    LIMIT 1
    `,
    [baseSlug]
  );

  if (!existing) return baseSlug;
  return `${baseSlug}-${randomUUID().slice(0, 8)}`;
}

export async function GET(request: Request) {
  try {
    await ensureCustomerAccessSchema();

    const customerSlug = getCustomerSlugFromRequest(request);
    const access = customerSlug ? null : await getAuthAccess();
    if (!customerSlug && !access) return unauthorizedResponse();

    const rows = await query<AlbumSummaryRow>(
      `
      WITH active_albums AS (
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
        WHERE COALESCE(a.is_deleted, false) = false
          AND (
            $1::text IS NOT NULL
            OR $2::boolean = true
            OR a.customer_id = ANY($3::uuid[])
          )
      ),

      event_counts AS (
        SELECT
          e.album_id,
          COUNT(*)::int AS event_count
        FROM album_events e
        WHERE COALESCE(e.is_deleted, false) = false
        GROUP BY e.album_id
      ),

      photo_counts AS (
        SELECT
          p.album_id,
          COUNT(*)::int AS photo_count
        FROM photos p
        WHERE COALESCE(p.is_deleted, false) = false
          AND p.upload_status = 'completed'
        GROUP BY p.album_id
      ),

      people_counts AS (
        SELECT
          pe.album_id,
          COUNT(*)::int AS people_count
        FROM people pe
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

      FROM active_albums a

      LEFT JOIN event_counts ec
        ON ec.album_id = a.id

      LEFT JOIN photo_counts pc
        ON pc.album_id = a.id

      LEFT JOIN people_counts pec
        ON pec.album_id = a.id

      LEFT JOIN customers c
        ON c.id = a.customer_id
       AND COALESCE(c.is_deleted, false) = false

      WHERE (
        $1::text IS NULL
        OR (
          c.slug = $1
          AND (a.expires_at IS NULL OR a.expires_at >= CURRENT_DATE)
        )
      )

      ORDER BY a.created_at DESC NULLS LAST, a.name ASC
      `,
      [customerSlug, Boolean(access?.isAdmin), access?.customerIds ?? []]
    );

    const albums: AlbumSummary[] = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        slug: row.slug,

        // Show customer name on album cards when available.
        // Example: "Nikhith & Vasavi" instead of internal album name "Nikhith".
        name: row.customer_name || row.name,
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

        customer: row.customer_id
          ? {
              id: row.customer_id,
              slug: row.customer_slug,
              name: row.customer_name ?? "",
              email: row.customer_email,
              phone: row.customer_phone,
              coverPhotoUrl: await signedUrl(row.customer_cover_photo_s3_key),
              passwordRequired: Boolean(row.customer_password_required),
            }
          : null,
      }))
    );

    return NextResponse.json({ albums });
  } catch (error) {
    console.error("Error fetching albums:", error);

    return NextResponse.json(
      { error: "Failed to fetch albums" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureCustomerAccessSchema();
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();

    const body = (await request.json()) as {
      customerName?: unknown;
      albumName?: unknown;
      description?: unknown;
      albumDate?: unknown;
      expiresAt?: unknown;
      events?: unknown;
      cover?: {
        fileName?: unknown;
        size?: unknown;
        contentType?: unknown;
      };
    };

    const customerName =
      typeof body.customerName === "string" ? body.customerName.trim() : "";
    const albumName = typeof body.albumName === "string" ? body.albumName.trim() : "";
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
    const albumDate = parseDate(body.albumDate);
    const expiresAt = parseDate(body.expiresAt);
    const eventNames = Array.isArray(body.events)
      ? body.events
          .filter((event): event is string => typeof event === "string")
          .map((event) => event.trim())
          .filter(Boolean)
          .slice(0, 30)
      : [];

    if (!customerName) {
      return NextResponse.json(
        { error: "customerName is required" },
        { status: 400 }
      );
    }

    if (!albumName) {
      return NextResponse.json(
        { error: "albumName is required" },
        { status: 400 }
      );
    }

    if (!albumDate || !expiresAt) {
      return NextResponse.json(
        { error: "albumDate and expiresAt are required" },
        { status: 400 }
      );
    }

    if (expiresAt < albumDate) {
      return NextResponse.json(
        { error: "expiresAt must be on or after albumDate" },
        { status: 400 }
      );
    }

    const customerSlug = slugify(customerName);
    const existingCustomer = await queryOne<{
      id: string;
      slug: string;
      name: string;
    }>(
      `
      SELECT id, slug, name
      FROM customers
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      `,
      [customerSlug],
    );
    const customer = existingCustomer
      ? access.isAdmin
        ? await queryOne<{ id: string; slug: string; name: string }>(
            `
            UPDATE customers
            SET name = $2,
                company_name = $2,
                created_by_email = COALESCE(created_by_email, $3),
                updated_at = now()
            WHERE id = $1::uuid
            RETURNING id, slug, name
            `,
            [existingCustomer.id, customerName, access.email],
          )
        : existingCustomer
      : await queryOne<{ id: string; slug: string; name: string }>(
          `
          INSERT INTO customers(
            name,
            company_name,
            slug,
            email,
            created_by_email,
            created_at,
            updated_at
          )
          VALUES($1, $1, $2, $3, $4, now(), now())
          RETURNING id, slug, name
          `,
          [
            customerName,
            customerSlug,
            access.isAdmin ? null : access.email,
            access.email,
          ],
        );

    if (!customer) {
      return NextResponse.json(
        { error: "Could not create customer" },
        { status: 500 }
      );
    }

    if (!access.isAdmin && existingCustomer && !access.customerIds.includes(customer.id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!access.isAdmin) {
      await queryOne<{ id: string }>(
        `
        INSERT INTO customer_users(id, customer_id, email, role, added_by, created_at)
        VALUES($1::uuid, $2::uuid, lower($3), 'owner', $3, now())
        ON CONFLICT DO NOTHING
        RETURNING id
        `,
        [randomUUID(), customer.id, access.email],
      );
    }

    const albumSlug = await availableAlbumSlug(albumName);
    const album = await queryOne<{
      id: string;
      slug: string;
      name: string;
      description: string | null;
      album_date: Date | string | null;
      expires_at: Date | string | null;
      cover_photo_s3_key: string | null;
    }>(
      `
      INSERT INTO albums(
        name,
        slug,
        description,
        album_date,
        expires_at,
        customer_id,
        password_hash,
        password_required,
        created_by,
        watermark_enabled,
        created_at,
        updated_at
      )
      VALUES(
        $1,
        $2,
        $3,
        $4::date,
        $5::date,
        $6::uuid,
        NULL,
        false,
        'web-album-create',
        false,
        now(),
        now()
      )
      RETURNING id, slug, name, description, album_date, expires_at, cover_photo_s3_key
      `,
      [albumName, albumSlug, description, albumDate, expiresAt, customer.id]
    );

    if (!album) {
      return NextResponse.json(
        { error: "Could not create album" },
        { status: 500 }
      );
    }

    await Promise.all(
      eventNames.map((eventName, index) =>
        queryOne<{ id: string }>(
          `
          INSERT INTO album_events(album_id, customer_id, name, slug, sort_order, created_at, updated_at)
          VALUES($1::uuid, $2::uuid, $3, $4, $5, now(), now())
          ON CONFLICT(album_id, slug) DO UPDATE SET
            name = EXCLUDED.name,
            customer_id = EXCLUDED.customer_id,
            sort_order = EXCLUDED.sort_order,
            updated_at = now()
          RETURNING id
          `,
          [album.id, customer.id, eventName, slugify(eventName), index + 1]
        )
      )
    );

    let coverUpload:
      | {
          key: string;
          contentType: string;
          uploadUrl: string;
        }
      | null = null;

    const coverFileName =
      typeof body.cover?.fileName === "string" ? body.cover.fileName.trim() : "";

    if (
      coverFileName &&
      typeof body.cover?.size === "number" &&
      body.cover.size > 0
    ) {
      const contentType = contentTypeFromInput(
        body.cover.contentType,
        coverFileName
      );
      const key = `albums/${album.slug}/cover/${randomUUID()}${extensionFromFileName(
        coverFileName
      )}`;

      await queryOne<{ id: string }>(
        `
        UPDATE albums
        SET cover_photo_s3_key = $2,
            updated_at = now()
        WHERE id = $1::uuid
        RETURNING id
        `,
        [album.id, key]
      );

      coverUpload = {
        key,
        contentType,
        uploadUrl: await signedUploadUrl(key, contentType),
      };
    }

    return NextResponse.json({
      album: {
        id: album.id,
        slug: album.slug,
        name: album.name,
        description: album.description,
        albumDate: dateValue(album.album_date),
        expiresAt: dateValue(album.expires_at),
        customer,
      },
      coverUpload,
    });
  } catch (error) {
    console.error("Error creating album:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create album" },
      { status: 500 }
    );
  }
}

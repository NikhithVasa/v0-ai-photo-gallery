import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { signedUrl } from "@/lib/s3";
import { ensureCustomerAccessSchema } from "@/lib/customer-schema";
import {
  getAuthAccess,
  unauthorizedResponse,
} from "@/lib/auth-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CustomerRow {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  phone: string | null;
  cover_photo_s3_key: string | null;
  password_required: boolean | null;
  album_count: number | string | null;
  created_at: Date | string | null;
}

function countValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
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

async function availableCustomerSlug(name: string) {
  const baseSlug = slugify(name);
  const existing = await queryOne<{ id: string }>(
    `
    SELECT id
    FROM customers
    WHERE slug = $1
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
    `,
    [baseSlug]
  );

  if (!existing) return baseSlug;
  return `${baseSlug}-${randomUUID().slice(0, 8)}`;
}

export async function GET() {
  try {
    await ensureCustomerAccessSchema();
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();

    const rows = await query<CustomerRow>(
      `
      SELECT
        c.id,
        c.slug,
        c.name,
        c.email,
        c.phone,
        c.cover_photo_s3_key,
        c.password_required,
        COUNT(a.id)::int AS album_count,
        c.created_at
      FROM customers c
      LEFT JOIN albums a
        ON a.customer_id = c.id
       AND COALESCE(a.is_deleted, false) = false
      WHERE COALESCE(c.is_deleted, false) = false
        AND (
          $1::boolean = true
          OR c.id = ANY($2::uuid[])
        )
      GROUP BY c.id
      ORDER BY c.created_at DESC NULLS LAST, c.name ASC
      `,
      [access.isAdmin, access.customerIds],
    );

    const customers = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        email: row.email,
        phone: row.phone,
        coverPhotoUrl: await signedUrl(row.cover_photo_s3_key),
        passwordRequired: Boolean(row.password_required),
        albumCount: countValue(row.album_count),
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at ?? "",
      }))
    );

    return NextResponse.json(
      { customers },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching customers:", error);

    return NextResponse.json(
      { error: "Failed to fetch customers" },
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
      name?: unknown;
      email?: unknown;
      phone?: unknown;
      notes?: unknown;
    };

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" && body.email.trim()
        ? body.email.trim()
        : null;
    const phone =
      typeof body.phone === "string" && body.phone.trim()
        ? body.phone.trim()
        : null;
    const notes =
      typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim()
        : null;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const slug = await availableCustomerSlug(name);
    const customer = await queryOne<CustomerRow>(
      `
      INSERT INTO customers(
        name,
        company_name,
        slug,
        email,
        phone,
        notes,
        created_by_email,
        created_at,
        updated_at
      )
      VALUES($1, $1, $2, $3, $4, $5, $6, now(), now())
      RETURNING
        id,
        slug,
        name,
        email,
        phone,
        cover_photo_s3_key,
        password_required,
        0::int AS album_count,
        created_at
      `,
      [name, slug, email, phone, notes, access.email]
    );

    if (!customer) {
      return NextResponse.json(
        { error: "Could not create customer" },
        { status: 500 }
      );
    }

    const ownerEmail = access.isAdmin ? email : access.email;
    if (ownerEmail) {
      await queryOne<{ id: string }>(
        `
        INSERT INTO customer_users(id, customer_id, email, role, added_by, created_at)
        VALUES($1::uuid, $2::uuid, lower($3), 'owner', $4, now())
        ON CONFLICT DO NOTHING
        RETURNING id
        `,
        [randomUUID(), customer.id, ownerEmail, access.email],
      );
    }

    return NextResponse.json({
      customer: {
        id: customer.id,
        slug: customer.slug,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        coverPhotoUrl: await signedUrl(customer.cover_photo_s3_key),
        passwordRequired: Boolean(customer.password_required),
        albumCount: 0,
        createdAt:
          customer.created_at instanceof Date
            ? customer.created_at.toISOString()
            : customer.created_at ?? "",
      },
    });
  } catch (error) {
    console.error("Error creating customer:", error);

    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}

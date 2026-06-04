import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-access";

interface Props {
  params: Promise<{ customerSlug: string }>;
}

interface CustomerUserRow {
  id: string;
  email: string;
  role: string;
  added_by: string | null;
  created_at: Date | string | null;
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeRole(value: unknown) {
  return value === "owner" ? "owner" : "member";
}

function createdAtValue(value: Date | string | null) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : value;
}

export async function GET(_request: Request, { params }: Props) {
  try {
    const admin = await requireAdminAccess();
    if (admin.response) return admin.response;

    const { customerSlug } = await params;
    const rows = await query<CustomerUserRow>(
      `
      SELECT
        cu.id,
        cu.email,
        cu.role,
        cu.added_by,
        cu.created_at
      FROM customer_users cu
      JOIN customers c
        ON c.id = cu.customer_id
       AND COALESCE(c.is_deleted, false) = false
      WHERE c.slug = $1
      ORDER BY cu.created_at ASC, cu.email ASC
      `,
      [customerSlug],
    );

    return NextResponse.json({
      users: rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        addedBy: row.added_by,
        createdAt: createdAtValue(row.created_at),
      })),
    });
  } catch (error) {
    console.error("Error fetching customer users:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer users" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: Props) {
  try {
    const admin = await requireAdminAccess();
    if (admin.response) return admin.response;

    const { customerSlug } = await params;
    const body = (await request.json()) as {
      email?: unknown;
      role?: unknown;
    };
    const email = normalizeEmail(body.email);
    const role = normalizeRole(body.role);

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const customer = await queryOne<{ id: string }>(
      `
      SELECT id
      FROM customers
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      `,
      [customerSlug],
    );

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const user = await queryOne<CustomerUserRow>(
      `
      WITH updated AS (
        UPDATE customer_users
        SET role = $4,
            added_by = $5
        WHERE customer_id = $2::uuid
          AND lower(email) = lower($3)
        RETURNING id, email, role, added_by, created_at
      ),
      inserted AS (
        INSERT INTO customer_users(id, customer_id, email, role, added_by, created_at)
        SELECT $1::uuid, $2::uuid, lower($3), $4, $5, now()
        WHERE NOT EXISTS (SELECT 1 FROM updated)
        RETURNING id, email, role, added_by, created_at
      )
      SELECT id, email, role, added_by, created_at FROM updated
      UNION ALL
      SELECT id, email, role, added_by, created_at FROM inserted
      LIMIT 1
      `,
      [randomUUID(), customer.id, email, role, admin.access?.email ?? null],
    );

    if (!user) {
      return NextResponse.json(
        { error: "Could not add customer user" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        addedBy: user.added_by,
        createdAt: createdAtValue(user.created_at),
      },
    });
  } catch (error) {
    console.error("Error adding customer user:", error);
    return NextResponse.json(
      { error: "Failed to add customer user" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: Props) {
  try {
    const admin = await requireAdminAccess();
    if (admin.response) return admin.response;

    const { customerSlug } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      email?: unknown;
    };
    const email = normalizeEmail(body.email);

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const deleted = await queryOne<{ id: string }>(
      `
      DELETE FROM customer_users cu
      USING customers c
      WHERE c.id = cu.customer_id
        AND c.slug = $1
        AND lower(cu.email) = lower($2)
      RETURNING cu.id
      `,
      [customerSlug, email],
    );

    if (!deleted) {
      return NextResponse.json({ error: "Customer user not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error removing customer user:", error);
    return NextResponse.json(
      { error: "Failed to remove customer user" },
      { status: 500 },
    );
  }
}

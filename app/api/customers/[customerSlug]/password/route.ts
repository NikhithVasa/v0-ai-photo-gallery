import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { generateRandomAccessCode, hashAccessCode } from "@/lib/access-code";
import { ensureCustomerAccessSchema } from "@/lib/customer-schema";
import { requireAdminAccess } from "@/lib/auth-access";

interface Props {
  params: Promise<{ customerSlug: string }>;
}

interface CustomerPasswordRow {
  id: string;
  slug: string;
  password_required: boolean | null;
  password_hash: string | null;
}

export async function GET(_request: Request, { params }: Props) {
  try {
    const admin = await requireAdminAccess();
    if (admin.response) return admin.response;

    await ensureCustomerAccessSchema();

    const { customerSlug } = await params;

    const customer = await queryOne<CustomerPasswordRow>(
      `
      SELECT id, slug, password_required, password_hash
      FROM customers
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      `,
      [customerSlug]
    );

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({
      passwordRequired: Boolean(customer.password_required),
      hasPassword: Boolean(customer.password_hash),
    });
  } catch (error) {
    console.error("Error getting customer password status:", error);
    return NextResponse.json(
      { error: "Failed to get password status" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Props) {
  try {
    const admin = await requireAdminAccess();
    if (admin.response) return admin.response;

    await ensureCustomerAccessSchema();

    const { customerSlug } = await params;
    const body = (await request.json()) as {
      password?: unknown;
      generateNew?: unknown;
    };
    const providedPassword =
      typeof body.password === "string" ? body.password.trim() : "";
    const password =
      body.generateNew === true ? generateRandomAccessCode() : providedPassword;

    if (!password) {
      return NextResponse.json(
        { error: "Password or generateNew flag is required" },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters" },
        { status: 400 }
      );
    }

    const customer = await queryOne<CustomerPasswordRow>(
      `
      UPDATE customers
      SET password_required = true,
          password_hash = $2,
          updated_at = now()
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      RETURNING id, slug, password_required, password_hash
      `,
      [customerSlug, hashAccessCode(password)]
    );

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, password });
  } catch (error) {
    console.error("Error setting customer password:", error);
    return NextResponse.json(
      { error: "Failed to set password" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Props) {
  try {
    const admin = await requireAdminAccess();
    if (admin.response) return admin.response;

    await ensureCustomerAccessSchema();

    const { customerSlug } = await params;

    const customer = await queryOne<CustomerPasswordRow>(
      `
      UPDATE customers
      SET password_required = false,
          password_hash = null,
          updated_at = now()
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      RETURNING id, slug, password_required, password_hash
      `,
      [customerSlug]
    );

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing customer password:", error);
    return NextResponse.json(
      { error: "Failed to remove password" },
      { status: 500 }
    );
  }
}

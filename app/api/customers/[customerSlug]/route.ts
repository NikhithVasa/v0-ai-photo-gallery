import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { ensureCustomerAccessSchema } from "@/lib/customer-schema";
import { requireAdminAccess } from "@/lib/auth-access";

interface Props {
  params: Promise<{ customerSlug: string }>;
}

export async function DELETE(_request: Request, { params }: Props) {
  try {
    await ensureCustomerAccessSchema();
    const admin = await requireAdminAccess();
    if (admin.response) return admin.response;

    const { customerSlug } = await params;

    const customer = await queryOne<{ id: string; name: string }>(
      `
      UPDATE customers
      SET is_deleted = true,
          deleted_at = now(),
          updated_at = now()
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      RETURNING id, name
      `,
      [customerSlug]
    );

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    await queryOne<{ id: string }>(
      `
      UPDATE albums
      SET is_deleted = true,
          deleted_at = now(),
          updated_at = now()
      WHERE customer_id = $1::uuid
        AND COALESCE(is_deleted, false) = false
      RETURNING id
      `,
      [customer.id]
    );

    return NextResponse.json({ ok: true, customer });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}

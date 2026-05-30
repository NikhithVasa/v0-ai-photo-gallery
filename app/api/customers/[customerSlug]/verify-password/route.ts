import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { accessCodeMatches } from "@/lib/access-code";
import { ensureCustomerAccessSchema } from "@/lib/customer-schema";

interface Props {
  params: Promise<{ customerSlug: string }>;
}

interface CustomerPasswordRow {
  password_required: boolean | null;
  password_hash: string | null;
}

export async function POST(request: Request, { params }: Props) {
  try {
    await ensureCustomerAccessSchema();
    const { customerSlug } = await params;
    const body = (await request.json()) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";

    const customer = await queryOne<CustomerPasswordRow>(
      `
      SELECT password_required, password_hash
      FROM customers
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      `,
      [customerSlug]
    );

    if (!customer) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    if (!customer.password_required) {
      return NextResponse.json({ ok: true });
    }

    if (!password || !customer.password_hash) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const ok = accessCodeMatches(password, customer.password_hash);
    return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
  } catch (error) {
    console.error("Error verifying customer password:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to verify password" },
      { status: 500 }
    );
  }
}

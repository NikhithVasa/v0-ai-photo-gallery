import { redirect } from "next/navigation";
import { CustomersPage } from "@/components/customers-page";
import { ProtectedRoute } from "@/components/protected-route";
import { getAuthAccess } from "@/lib/auth-access";
import { ensureCustomerAccessSchema } from "@/lib/customer-schema";
import { queryOne } from "@/lib/db";

interface CustomerCountRow {
  customer_count: number | string | null;
}

function countValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

export default async function Customers() {
  const access = await getAuthAccess();

  if (access) {
    await ensureCustomerAccessSchema();

    const row = await queryOne<CustomerCountRow>(
      `
      SELECT COUNT(*)::int AS customer_count
      FROM customers
      WHERE COALESCE(is_deleted, false) = false
        AND (
          $1::boolean = true
          OR id = ANY($2::uuid[])
        )
      `,
      [access.isAdmin, access.customerIds],
    );

    if (countValue(row?.customer_count ?? null) === 0) {
      redirect("/customers/new");
    }
  }

  return (
    <ProtectedRoute>
      <CustomersPage />
    </ProtectedRoute>
  );
}

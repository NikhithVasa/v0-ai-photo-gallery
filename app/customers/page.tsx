import { CustomersPage } from "@/components/customers-page";
import { ProtectedRoute } from "@/components/protected-route";

export default function Customers() {
  return (
    <ProtectedRoute>
      <CustomersPage />
    </ProtectedRoute>
  );
}

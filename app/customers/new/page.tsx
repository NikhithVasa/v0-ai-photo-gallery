import { AddCustomerPage } from "@/components/add-customer-page";
import { ProtectedRoute } from "@/components/protected-route";

export default function NewCustomerPage() {
  return (
    <ProtectedRoute>
      <AddCustomerPage />
    </ProtectedRoute>
  );
}

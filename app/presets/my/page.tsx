import { MyPresetsPage } from "@/components/my-presets-page";
import { ProtectedRoute } from "@/components/protected-route";

export default function MyPresetsRoute() {
  return (
    <ProtectedRoute>
      <MyPresetsPage />
    </ProtectedRoute>
  );
}

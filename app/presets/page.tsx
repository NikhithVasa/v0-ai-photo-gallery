import { PresetMarketplacePage } from "@/components/preset-marketplace-page";
import { ProtectedRoute } from "@/components/protected-route";

export default function PresetsPage() {
  return (
    <ProtectedRoute>
      <PresetMarketplacePage />
    </ProtectedRoute>
  );
}

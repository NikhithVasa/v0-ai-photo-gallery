import { ProtectedRoute } from "@/components/protected-route";
import { UploadPresetPage } from "@/components/upload-preset-page";

export default function UploadPresetRoute() {
  return (
    <ProtectedRoute>
      <UploadPresetPage />
    </ProtectedRoute>
  );
}

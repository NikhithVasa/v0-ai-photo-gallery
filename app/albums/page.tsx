import { AlbumsPage } from "@/components/albums-page";
import { ProtectedRoute } from "@/components/protected-route";

export default function Albums() {
  return (
    <ProtectedRoute>
      <AlbumsPage />
    </ProtectedRoute>
  );
}

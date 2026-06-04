import { Suspense } from "react";
import { AddAlbumPage } from "@/components/add-album-page";
import { ProtectedRoute } from "@/components/protected-route";

export default function NewAlbumPage() {
  return (
    <ProtectedRoute>
      <Suspense>
        <AddAlbumPage />
      </Suspense>
    </ProtectedRoute>
  );
}

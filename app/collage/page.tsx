import { Suspense } from "react";
import { CollageBuilderPage } from "@/components/collage-builder-page";
import { ProtectedRoute } from "@/components/protected-route";

export default function CollagePage() {
  return (
    <ProtectedRoute>
      <Suspense>
        <CollageBuilderPage />
      </Suspense>
    </ProtectedRoute>
  );
}

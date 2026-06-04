import { Suspense } from "react";
import { UploadPage } from "@/components/upload-page";
import { ProtectedRoute } from "@/components/protected-route";

export default function Upload() {
  return (
    <ProtectedRoute>
      <Suspense>
        <UploadPage />
      </Suspense>
    </ProtectedRoute>
  );
}

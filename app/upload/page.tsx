import { Suspense } from "react";
import { UploadPage } from "@/components/upload-page";

export default function Upload() {
  return (
    <Suspense>
      <UploadPage />
    </Suspense>
  );
}

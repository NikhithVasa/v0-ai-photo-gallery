import { Suspense } from "react";
import { CollageBuilderPage } from "@/components/collage-builder-page";

export default function CollagePage() {
  return (
    <Suspense>
      <CollageBuilderPage />
    </Suspense>
  );
}

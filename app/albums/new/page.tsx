import { Suspense } from "react";
import { AddAlbumPage } from "@/components/add-album-page";

export default function NewAlbumPage() {
  return (
    <Suspense>
      <AddAlbumPage />
    </Suspense>
  );
}

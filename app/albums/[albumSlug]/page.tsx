import { Suspense } from "react";
import { AlbumGalleryPage } from "@/components/album-gallery-page";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

export default async function AlbumPage({ params }: Props) {
  const { albumSlug } = await params;

  return (
    <Suspense>
      <AlbumGalleryPage albumSlug={albumSlug} />
    </Suspense>
  );
}

import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AlbumGalleryPage } from "@/components/album-gallery-page";
import { ProtectedRoute } from "@/components/protected-route";
import { canAccessAlbumFromHost } from "@/lib/album-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

export default async function AlbumPage({ params }: Props) {
  const { albumSlug } = await params;
  const headersList = await headers();
  const canAccess = await canAccessAlbumFromHost(
    albumSlug,
    headersList.get("host") || ""
  );

  if (!canAccess) {
    redirect("/albums");
  }

  return (
    <ProtectedRoute allowShareToken>
      <Suspense>
        <AlbumGalleryPage albumSlug={albumSlug} />
      </Suspense>
    </ProtectedRoute>
  );
}

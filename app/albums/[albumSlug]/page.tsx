import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AlbumGalleryPage } from "@/components/album-gallery-page";
import { ProtectedRoute } from "@/components/protected-route";
import { canAccessAlbumFromHost } from "@/lib/album-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
  searchParams: Promise<{ share?: string }>;
}

export default async function AlbumPage({ params, searchParams }: Props) {
  const { albumSlug } = await params;
  const { share } = await searchParams;
  const hasShareToken = typeof share === "string" && share.length > 0;

  if (!hasShareToken) {
    const headersList = await headers();
    const canAccess = await canAccessAlbumFromHost(
      albumSlug,
      headersList.get("host") || ""
    );

    if (!canAccess) {
      redirect("/albums");
    }
  }

  return (
    <ProtectedRoute allowShareToken>
      <Suspense>
        <AlbumGalleryPage albumSlug={albumSlug} />
      </Suspense>
    </ProtectedRoute>
  );
}

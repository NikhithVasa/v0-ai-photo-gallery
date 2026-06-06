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

  console.info("[share-debug] album page render start", {
    albumSlug,
    hasShareToken,
    shareToken: hasShareToken ? `${share.slice(0, 6)}...${share.slice(-4)}` : "",
  });

  if (!hasShareToken) {
    const headersList = await headers();
    const host = headersList.get("host") || "";
    const canAccess = await canAccessAlbumFromHost(
      albumSlug,
      host
    );

    console.info("[share-debug] album page host gate result", {
      albumSlug,
      host,
      canAccess,
    });

    if (!canAccess) {
      console.warn("[share-debug] album page redirecting after host gate denial", {
        albumSlug,
        host,
      });
      redirect("/albums");
    }
  } else {
    console.info("[share-debug] album page skipping host gate for share token", {
      albumSlug,
    });
  }

  return (
    <ProtectedRoute allowShareToken>
      <Suspense>
        <AlbumGalleryPage albumSlug={albumSlug} />
      </Suspense>
    </ProtectedRoute>
  );
}

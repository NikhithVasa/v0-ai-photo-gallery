import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AlbumVideosPage } from "@/components/album-videos-page";
import { ProtectedRoute } from "@/components/protected-route";
import { canAccessAlbumFromHost } from "@/lib/album-access";

interface Props {
  params: Promise<{ albumSlug: string; videoId: string }>;
  searchParams: Promise<{ share?: string | string[] }>;
}

export default async function AlbumVideoTimelineRoute({ params, searchParams }: Props) {
  const { albumSlug, videoId } = await params;
  const { share } = await searchParams;
  const shareToken = Array.isArray(share) ? share[0] : share;
  const hasShareToken = typeof shareToken === "string" && shareToken.length > 0;

  if (!hasShareToken) {
    const headersList = await headers();
    const canAccess = await canAccessAlbumFromHost(
      albumSlug,
      headersList.get("host") || "",
    );

    if (!canAccess) {
      redirect("/albums");
    }
  }

  return (
    <ProtectedRoute allowShareToken={hasShareToken}>
      <Suspense>
        <AlbumVideosPage albumSlug={albumSlug} timelineVideoId={videoId} shareToken={hasShareToken ? shareToken : ""} />
      </Suspense>
    </ProtectedRoute>
  );
}

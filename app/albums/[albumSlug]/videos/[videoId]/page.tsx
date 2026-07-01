import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AlbumVideosPage } from "@/components/album-videos-page";
import { ProtectedRoute } from "@/components/protected-route";
import { canAccessAlbumFromHost } from "@/lib/album-access";
import { canAccessAlbumByShareToken } from "@/lib/auth-access";

interface Props {
  params: Promise<{ albumSlug: string; videoId: string }>;
  searchParams: Promise<{ share?: string }>;
}

export default async function AlbumVideoTimelineRoute({ params, searchParams }: Props) {
  const { albumSlug, videoId } = await params;
  const { share } = await searchParams;
  const hasShareToken = typeof share === "string" && share.length > 0;
  let hasValidShareToken = false;

  const headersList = await headers();

  if (hasShareToken) {
    const protocol = headersList.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost";
    const requestUrl = new URL(
      `/albums/${encodeURIComponent(albumSlug)}/videos/${encodeURIComponent(videoId)}`,
      `${protocol}://${host}`,
    );
    requestUrl.searchParams.set("share", share);

    hasValidShareToken = await canAccessAlbumByShareToken(
      new Request(requestUrl, { headers: new Headers(headersList) }),
      albumSlug,
    );

    if (!hasValidShareToken) {
      const next = `${requestUrl.pathname}${requestUrl.search}`;
      redirect(`/login?next=${encodeURIComponent(next)}`);
    }
  } else {
    const canAccess = await canAccessAlbumFromHost(
      albumSlug,
      headersList.get("host") || "",
    );

    if (!canAccess) {
      redirect("/albums");
    }
  }

  return (
    <ProtectedRoute allowShareToken={hasValidShareToken}>
      <Suspense>
        <AlbumVideosPage albumSlug={albumSlug} timelineVideoId={videoId} shareToken={hasValidShareToken ? share : ""} />
      </Suspense>
    </ProtectedRoute>
  );
}

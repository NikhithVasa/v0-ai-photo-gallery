import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AlbumGalleryPage } from "@/components/album-gallery-page";
import { ProtectedRoute } from "@/components/protected-route";
import {
  albumAllowsPublicPasscode,
  canAccessAlbumFromHost,
} from "@/lib/album-access";
import { canAccessAlbumByShareToken } from "@/lib/auth-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
  searchParams: Promise<{ share?: string }>;
}

export default async function AlbumPage({ params, searchParams }: Props) {
  const { albumSlug } = await params;
  const { share } = await searchParams;
  const hasShareToken = typeof share === "string" && share.length > 0;
  let hasValidShareToken = false;

  console.info("[share-debug] album page render start", {
    albumSlug,
    hasShareToken,
    shareToken: hasShareToken ? `${share.slice(0, 6)}...${share.slice(-4)}` : "",
  });

  const headersList = await headers();

  if (hasShareToken) {
    const protocol =
      headersList.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    const host =
      headersList.get("x-forwarded-host") ||
      headersList.get("host") ||
      "localhost";
    const requestUrl = new URL(
      `/albums/${encodeURIComponent(albumSlug)}`,
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
  }

  const allowPublicAlbumPasscode =
    !hasShareToken && (await albumAllowsPublicPasscode(albumSlug));

  return (
    <ProtectedRoute
      allowShareToken={hasValidShareToken}
      allowPublicAlbumPasscode={allowPublicAlbumPasscode}
    >
      <Suspense>
        <AlbumGalleryPage albumSlug={albumSlug} />
      </Suspense>
    </ProtectedRoute>
  );
}

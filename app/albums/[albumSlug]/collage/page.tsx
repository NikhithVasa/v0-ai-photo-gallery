import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CollageBuilderPage } from "@/components/collage-builder-page";
import { canAccessAlbumFromHost } from "@/lib/album-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

export default async function AlbumCollagePage({ params }: Props) {
  const { albumSlug } = await params;
  const headersList = await headers();
  const canAccess = await canAccessAlbumFromHost(
    albumSlug,
    headersList.get("host") || "",
  );

  if (!canAccess) {
    redirect("/albums");
  }

  return (
    <Suspense>
      <CollageBuilderPage initialAlbumSlug={albumSlug} />
    </Suspense>
  );
}

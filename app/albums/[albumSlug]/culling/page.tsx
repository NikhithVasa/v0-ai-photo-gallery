import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AiCullingPage } from "@/components/ai-culling-page";
import { ProtectedRoute } from "@/components/protected-route";
import { canAccessAlbumFromHost } from "@/lib/album-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

export default async function AlbumCullingPage({ params }: Props) {
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
    <ProtectedRoute>
      <Suspense>
        <AiCullingPage albumSlug={albumSlug} />
      </Suspense>
    </ProtectedRoute>
  );
}

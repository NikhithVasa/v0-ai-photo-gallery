import { Suspense } from "react";
import { AlbumDesignerPage } from "@/components/album-designer-page";
import { ProtectedRoute } from "@/components/protected-route";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

export default async function AlbumDesignRoute({ params }: Props) {
  const { albumSlug } = await params;

  return (
    <ProtectedRoute>
      <Suspense>
        <AlbumDesignerPage albumSlug={albumSlug} />
      </Suspense>
    </ProtectedRoute>
  );
}
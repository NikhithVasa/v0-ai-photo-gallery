import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AddEventPage } from "@/components/add-event-page";
import { ProtectedRoute } from "@/components/protected-route";
import { canAccessAlbumFromHost } from "@/lib/album-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
  searchParams: Promise<{ event?: string }>;
}

export default async function AlbumUploadPage({ params, searchParams }: Props) {
  const { albumSlug } = await params;
  const { event } = await searchParams;
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
        <AddEventPage
          albumSlug={albumSlug}
          initialEventSlug={typeof event === "string" ? event : null}
        />
      </Suspense>
    </ProtectedRoute>
  );
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessAlbumFromHost } from "@/lib/album-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

export default async function NewEventPage({ params }: Props) {
  const { albumSlug } = await params;
  const headersList = await headers();
  const canAccess = await canAccessAlbumFromHost(
    albumSlug,
    headersList.get("host") || "",
  );

  if (!canAccess) {
    redirect("/albums");
  }

  redirect(`/albums/${encodeURIComponent(albumSlug)}/upload`);
}

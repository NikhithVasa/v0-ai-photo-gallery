import { NextResponse } from "next/server";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import {
  fetchClusterAccess,
  fetchCullingClusterItems,
  setCullingClusterBest,
} from "@/lib/culling-queries";

interface Props {
  params: Promise<{ clusterId: string }>;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    value,
  );
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { clusterId } = await params;
    if (!isUuid(clusterId)) {
      return NextResponse.json({ error: "Invalid cluster id" }, { status: 400 });
    }

    const cluster = await fetchClusterAccess(clusterId);
    if (!cluster) {
      return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
    }

    const accessDenied = await requireAlbumCustomerAccess(cluster.album_slug);
    if (accessDenied) return accessDenied;

    const body = (await request.json()) as { photo_id?: unknown };
    const photoId = typeof body.photo_id === "string" ? body.photo_id : "";
    if (!isUuid(photoId)) {
      return NextResponse.json({ error: "Invalid photo id" }, { status: 400 });
    }

    await setCullingClusterBest({ clusterId, photoId });
    const items = await fetchCullingClusterItems(clusterId);

    return NextResponse.json({
      ok: true,
      cluster_id: clusterId,
      best_photo_id: photoId,
      items,
    });
  } catch (error) {
    console.error("Error setting culling cluster best photo:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to set best photo",
      },
      { status: 500 },
    );
  }
}

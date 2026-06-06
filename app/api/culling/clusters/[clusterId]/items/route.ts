import { NextResponse } from "next/server";
import { requireAlbumAccess } from "@/lib/album-access";
import {
  fetchClusterAccess,
  fetchCullingClusterItems,
} from "@/lib/culling-queries";

interface Props {
  params: Promise<{ clusterId: string }>;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    value,
  );
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { clusterId } = await params;
    if (!isUuid(clusterId)) {
      return NextResponse.json({ error: "Invalid cluster id" }, { status: 400 });
    }

    const cluster = await fetchClusterAccess(clusterId);
    if (!cluster) {
      return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
    }

    const accessDenied = await requireAlbumAccess(request, cluster.album_slug);
    if (accessDenied) return accessDenied;

    const items = await fetchCullingClusterItems(clusterId);

    return NextResponse.json(
      {
        cluster_id: clusterId,
        items,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching culling cluster items:", error);
    return NextResponse.json(
      { error: "Failed to fetch culling cluster items" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { requireAlbumAccess } from "@/lib/album-access";
import { fetchCullingClusters } from "@/lib/culling-queries";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

function limitValue(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : 200;
  if (!Number.isFinite(parsed) || parsed <= 0) return 200;
  return Math.min(parsed, 500);
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) return accessDenied;

    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get("event") || null;
    const mode = searchParams.get("mode") || "best";
    const clusters = await fetchCullingClusters({
      albumSlug,
      eventSlug,
      mode,
      limit: limitValue(searchParams.get("limit")),
    });

    return NextResponse.json(
      {
        album_slug: albumSlug,
        event_slug: eventSlug,
        clusters,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching culling clusters:", error);
    return NextResponse.json(
      { error: "Failed to fetch culling clusters" },
      { status: 500 },
    );
  }
}

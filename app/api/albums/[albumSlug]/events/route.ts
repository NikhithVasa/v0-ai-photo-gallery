import { NextResponse } from "next/server";
import { fetchAlbumEvents } from "@/lib/gallery-data";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

export async function GET(_request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const events = await fetchAlbumEvents(albumSlug);
    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error fetching album events:", error);
    return NextResponse.json(
      { error: "Failed to fetch album events" },
      { status: 500 }
    );
  }
}

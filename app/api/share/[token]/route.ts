import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ token: string }>;
}

interface ShareTokenRow {
  token: string;
  album_slug: string;
  album_name: string;
  customer_name: string | null;
  allow_downloads: boolean;
  watermark_enabled: boolean;
  watermark_text: string | null;
  watermark_mode: "full" | "corners";
  watermark_positions: string[] | null;
}

function serialize(row: ShareTokenRow) {
  return {
    token: row.token,
    albumSlug: row.album_slug,
    albumName: row.album_name,
    customerName: row.customer_name,
    allowDownloads: row.allow_downloads,
    watermarkEnabled: row.watermark_enabled,
    watermarkText: row.watermark_text,
    watermarkMode: row.watermark_mode,
    watermarkPositions: row.watermark_positions ?? [],
  };
}

export async function GET(_request: Request, { params }: Props) {
  try {
    await ensureAlbumShareLinkSchema();

    const { token } = await params;
    const share = await queryOne<ShareTokenRow>(
      `
      SELECT
        s.token,
        a.slug AS album_slug,
        s.album_name,
        s.customer_name,
        s.allow_downloads,
        s.watermark_enabled,
        s.watermark_text,
        s.watermark_mode,
        s.watermark_positions
      FROM album_share_links s
      JOIN albums a
        ON a.id = s.album_id
       AND COALESCE(a.is_deleted, false) = false
      WHERE s.token = $1
      LIMIT 1
      `,
      [token],
    );

    if (!share) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    return NextResponse.json({ share: serialize(share) });
  } catch (error) {
    console.error("Error fetching public share link:", error);
    return NextResponse.json(
      { error: "Failed to fetch share link" },
      { status: 500 },
    );
  }
}

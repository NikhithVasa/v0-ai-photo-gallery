import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ albumSlug: string }>;
}

type WatermarkMode = "full" | "corners";
type WatermarkPosition =
  | "top_left"
  | "top_right"
  | "bottom_left"
  | "bottom_right";

interface AlbumRow {
  id: string;
  name: string;
  slug: string;
  customer_id: string | null;
  customer_name: string | null;
}

interface ShareLinkRow {
  id: string;
  token: string;
  album_id: string;
  customer_id: string | null;
  album_name: string;
  customer_name: string | null;
  allow_downloads: boolean;
  watermark_enabled: boolean;
  watermark_text: string | null;
  watermark_mode: WatermarkMode;
  watermark_positions: WatermarkPosition[] | null;
  updated_at: Date | string;
}

const watermarkModes = new Set<WatermarkMode>(["full", "corners"]);
const watermarkPositions = new Set<WatermarkPosition>([
  "top_left",
  "top_right",
  "bottom_left",
  "bottom_right",
]);

function shareUrl(request: Request, token: string) {
  const origin = new URL(request.url).origin;
  return `${origin}/share/${encodeURIComponent(token)}`;
}

function sanitizeSettings(body: unknown, fallbackText: string) {
  const source = typeof body === "object" && body ? body as Record<string, unknown> : {};
  const mode = watermarkModes.has(source.watermarkMode as WatermarkMode)
    ? (source.watermarkMode as WatermarkMode)
    : "corners";
  const positions = Array.isArray(source.watermarkPositions)
    ? source.watermarkPositions.filter((position): position is WatermarkPosition =>
        watermarkPositions.has(position as WatermarkPosition),
      )
    : [];

  return {
    allowDownloads: Boolean(source.allowDownloads),
    watermarkEnabled: Boolean(source.watermarkEnabled),
    watermarkText:
      typeof source.watermarkText === "string" && source.watermarkText.trim()
        ? source.watermarkText.trim().slice(0, 120)
        : fallbackText,
    watermarkMode: mode,
    watermarkPositions:
      mode === "full"
        ? []
        : positions.length
          ? positions
          : ["bottom_right"] as WatermarkPosition[],
  };
}

function serialize(row: ShareLinkRow, request: Request) {
  return {
    id: row.id,
    token: row.token,
    url: shareUrl(request, row.token),
    albumId: row.album_id,
    customerId: row.customer_id,
    albumName: row.album_name,
    customerName: row.customer_name,
    allowDownloads: row.allow_downloads,
    watermarkEnabled: row.watermark_enabled,
    watermarkText: row.watermark_text,
    watermarkMode: row.watermark_mode,
    watermarkPositions: row.watermark_positions ?? [],
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at,
  };
}

async function fetchAlbum(albumSlug: string) {
  return queryOne<AlbumRow>(
    `
    SELECT
      a.id,
      a.name,
      a.slug,
      a.customer_id,
      c.name AS customer_name
    FROM albums a
    LEFT JOIN customers c
      ON c.id = a.customer_id
     AND COALESCE(c.is_deleted, false) = false
    WHERE lower(a.slug) = lower($1)
      AND COALESCE(a.is_deleted, false) = false
    LIMIT 1
    `,
    [albumSlug],
  );
}

async function fetchShareLink(albumId: string) {
  return queryOne<ShareLinkRow>(
    `
    SELECT
      id,
      token,
      album_id,
      customer_id,
      album_name,
      customer_name,
      allow_downloads,
      watermark_enabled,
      watermark_text,
      watermark_mode,
      watermark_positions,
      updated_at
    FROM album_share_links
    WHERE album_id = $1
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [albumId],
  );
}

export async function GET(request: Request, { params }: Props) {
  try {
    await ensureAlbumShareLinkSchema();

    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const album = await fetchAlbum(albumSlug);
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const share = await fetchShareLink(album.id);

    return NextResponse.json({
      share: share
        ? serialize(share, request)
        : null,
      defaults: {
        albumName: album.name,
        customerName: album.customer_name,
        watermarkText: album.customer_name || album.name,
        allowDownloads: false,
        watermarkEnabled: false,
        watermarkMode: "corners",
        watermarkPositions: ["bottom_right"],
      },
    });
  } catch (error) {
    console.error("Error fetching album share link:", error);
    return NextResponse.json(
      { error: "Failed to fetch share link" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: Props) {
  try {
    await ensureAlbumShareLinkSchema();

    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const album = await fetchAlbum(albumSlug);
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const existing = await fetchShareLink(album.id);
    const body = await request.json().catch(() => ({}));
    const settings = sanitizeSettings(body, album.customer_name || album.name);
    const token = existing?.token ?? randomUUID().replace(/-/g, "");
    const id = existing?.id ?? randomUUID();

    const share = await queryOne<ShareLinkRow>(
      `
      INSERT INTO album_share_links (
        id,
        token,
        album_id,
        customer_id,
        album_name,
        customer_name,
        allow_downloads,
        watermark_enabled,
        watermark_text,
        watermark_mode,
        watermark_positions,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11::text[],
        now(),
        now()
      )
      ON CONFLICT (token) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        album_name = EXCLUDED.album_name,
        customer_name = EXCLUDED.customer_name,
        allow_downloads = EXCLUDED.allow_downloads,
        watermark_enabled = EXCLUDED.watermark_enabled,
        watermark_text = EXCLUDED.watermark_text,
        watermark_mode = EXCLUDED.watermark_mode,
        watermark_positions = EXCLUDED.watermark_positions,
        updated_at = now()
      RETURNING
        id,
        token,
        album_id,
        customer_id,
        album_name,
        customer_name,
        allow_downloads,
        watermark_enabled,
        watermark_text,
        watermark_mode,
        watermark_positions,
        updated_at
      `,
      [
        id,
        token,
        album.id,
        album.customer_id,
        album.name,
        album.customer_name,
        settings.allowDownloads,
        settings.watermarkEnabled,
        settings.watermarkText,
        settings.watermarkMode,
        settings.watermarkPositions,
      ],
    );

    if (!share) {
      return NextResponse.json(
        { error: "Failed to save share link" },
        { status: 500 },
      );
    }

    return NextResponse.json({ share: serialize(share, request) });
  } catch (error) {
    console.error("Error saving album share link:", error);
    return NextResponse.json(
      { error: "Failed to save share link" },
      { status: 500 },
    );
  }
}

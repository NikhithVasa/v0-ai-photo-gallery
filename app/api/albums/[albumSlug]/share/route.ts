import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { customerPublicUrl } from "@/lib/customer-host";
import {
  DEFAULT_SHARE_BACKGROUND_COLOR,
  isShareBackgroundColor,
  normalizeShareBackgroundColor,
} from "@/lib/share-theme";

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
  customer_slug: string | null;
}

interface ShareLinkRow {
  id: string;
  token: string;
  album_id: string;
  customer_id: string | null;
  album_name: string;
  customer_name: string | null;
  allow_downloads: boolean;
  hide_ai: boolean;
  watermark_enabled: boolean;
  watermark_text: string | null;
  watermark_mode: WatermarkMode;
  watermark_positions: WatermarkPosition[] | null;
  expires_at: Date | string | null;
  background_color: string | null;
  passcode: string | null;
  updated_at: Date | string;
}

const watermarkModes = new Set<WatermarkMode>(["full", "corners"]);
const watermarkPositions = new Set<WatermarkPosition>([
  "top_left",
  "top_right",
  "bottom_left",
  "bottom_right",
]);

function shareUrl(
  request: Request,
  token: string,
  customerSlug: string | null,
) {
  if (customerSlug) {
    return `${customerPublicUrl(customerSlug)}/share/${encodeURIComponent(token)}`;
  }

  const origin = new URL(request.url).origin;
  return `${origin}/share/${encodeURIComponent(token)}`;
}

function dateValue(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function parseExpirationDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Expiration date must be a YYYY-MM-DD date");
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Expiration date is invalid");
  }

  return value;
}

function parseBackgroundColor(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_SHARE_BACKGROUND_COLOR;
  }
  if (!isShareBackgroundColor(value)) {
    throw new Error("Background color must be one of the allowed share colors");
  }

  return normalizeShareBackgroundColor(value);
}

function parsePasscode(value: unknown, fallback: string | null) {
  if (value === undefined) return fallback;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Passcode must be text");
  }

  const passcode = value.trim();
  if (!passcode) return null;
  if (passcode.length < 4) {
    throw new Error("Passcode must be at least 4 characters");
  }
  if (passcode.length > 64) {
    throw new Error("Passcode must be 64 characters or fewer");
  }

  return passcode;
}

function sanitizeSettings(
  body: unknown,
  fallbackText: string,
  fallbackPasscode: string | null,
) {
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
    hideAi: Boolean(source.hideAi),
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
    expiresAt: parseExpirationDate(source.expiresAt),
    backgroundColor: parseBackgroundColor(source.backgroundColor),
    passcode: parsePasscode(source.passcode, fallbackPasscode),
  };
}

function serialize(row: ShareLinkRow, request: Request, customerSlug: string | null) {
  return {
    id: row.id,
    token: row.token,
    url: shareUrl(request, row.token, customerSlug),
    albumId: row.album_id,
    customerId: row.customer_id,
    albumName: row.album_name,
    customerName: row.customer_name,
    expiresAt: dateValue(row.expires_at),
    backgroundColor: normalizeShareBackgroundColor(row.background_color),
    passcode: row.passcode,
    allowDownloads: row.allow_downloads,
    hideAi: row.hide_ai,
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
      c.name AS customer_name,
      c.slug AS customer_slug
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
      hide_ai,
      watermark_enabled,
      watermark_text,
      watermark_mode,
      watermark_positions,
      expires_at,
      background_color,
      passcode,
      updated_at
    FROM album_share_links
    WHERE album_id = $1
      AND person_id IS NULL
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
        ? serialize(share, request, album.customer_slug)
        : null,
      defaults: {
        albumName: album.name,
        customerName: album.customer_name,
        watermarkText: album.customer_name || album.name,
        expiresAt: null,
        backgroundColor: DEFAULT_SHARE_BACKGROUND_COLOR,
        allowDownloads: false,
        hideAi: false,
        watermarkEnabled: false,
        watermarkMode: "corners",
        watermarkPositions: ["bottom_right"],
        passcode: null,
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
    const settings = sanitizeSettings(
      body,
      album.customer_name || album.name,
      existing?.passcode ?? null,
    );
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
        hide_ai,
        watermark_enabled,
        watermark_text,
        watermark_mode,
        watermark_positions,
        expires_at,
        background_color,
        passcode,
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
        $11,
        $12::text[],
        $13::date,
        $14,
        $15,
        now(),
        now()
      )
      ON CONFLICT (token) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        album_name = EXCLUDED.album_name,
        customer_name = EXCLUDED.customer_name,
        allow_downloads = EXCLUDED.allow_downloads,
        hide_ai = EXCLUDED.hide_ai,
        watermark_enabled = EXCLUDED.watermark_enabled,
        watermark_text = EXCLUDED.watermark_text,
        watermark_mode = EXCLUDED.watermark_mode,
        watermark_positions = EXCLUDED.watermark_positions,
        expires_at = EXCLUDED.expires_at,
        background_color = EXCLUDED.background_color,
        passcode = EXCLUDED.passcode,
        updated_at = now()
      RETURNING
        id,
        token,
        album_id,
        customer_id,
        album_name,
        customer_name,
        allow_downloads,
        hide_ai,
        watermark_enabled,
        watermark_text,
        watermark_mode,
        watermark_positions,
        expires_at,
        background_color,
        passcode,
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
        settings.hideAi,
        settings.watermarkEnabled,
        settings.watermarkText,
        settings.watermarkMode,
        settings.watermarkPositions,
        settings.expiresAt,
        settings.backgroundColor,
        settings.passcode,
      ],
    );

    if (!share) {
      return NextResponse.json(
        { error: "Failed to save share link" },
        { status: 500 },
      );
    }

    return NextResponse.json({ share: serialize(share, request, album.customer_slug) });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("Expiration date") ||
        error.message.startsWith("Background color") ||
        error.message.startsWith("Passcode"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Error saving album share link:", error);
    return NextResponse.json(
      { error: "Failed to save share link" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Props) {
  try {
    await ensureAlbumShareLinkSchema();

    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const album = await fetchAlbum(albumSlug);
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    await query(
      `
      DELETE FROM album_share_links
      WHERE album_id = $1
        AND person_id IS NULL
      `,
      [album.id],
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting album share link:", error);
    return NextResponse.json(
      { error: "Failed to delete share link" },
      { status: 500 },
    );
  }
}

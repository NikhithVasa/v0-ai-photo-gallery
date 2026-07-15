import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { customerPublicUrl } from "@/lib/customer-host";
import {
  isShareBackgroundColor,
  normalizeShareBackgroundColor,
} from "@/lib/share-theme";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface AlbumRow {
  id: string;
  name: string;
  customer_slug: string | null;
}

interface ShareLinkRow {
  token: string;
  album_name: string;
  link_name: string | null;
  person_id: string | null;
  person_ids: string[] | null;
  person_name: string | null;
  only_person: boolean;
  allow_downloads: boolean;
  hide_ai: boolean;
  watermark_enabled: boolean;
  watermark_text: string | null;
  watermark_mode: "full" | "corners";
  watermark_positions: string[] | null;
  allow_event_tabs: boolean;
  background_color: string | null;
  expires_at: Date | string | null;
  passcode: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function dateValue(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function isoValue(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function expirationDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Expiration date is invalid");
  }
  return value;
}

function updatedPasscode(
  value: unknown,
  clearPasscode: unknown,
  fallback: string | null,
) {
  if (clearPasscode === true) return null;
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || value.trim().length < 4) {
    throw new Error("Passcode must be at least 4 characters");
  }
  return value.trim().slice(0, 64);
}

function serializeLink(
  row: ShareLinkRow,
  request: Request,
  customerSlug: string | null,
) {
  const personIds =
    row.person_ids && row.person_ids.length
      ? row.person_ids
      : row.person_id
        ? [row.person_id]
        : [];
  const isPerson = personIds.length > 0;

  return {
    token: row.token,
    url: shareUrl(request, row.token, customerSlug),
    type: isPerson ? "person" : "album",
    name:
      row.link_name ||
      (isPerson ? row.person_name || "People" : row.album_name),
    personName: row.person_name,
    personIds,
    peopleCount: personIds.length,
    onlyPerson: row.only_person,
    allowDownloads: row.allow_downloads,
    hideAi: row.hide_ai,
    watermarkEnabled: row.watermark_enabled,
    watermarkText: row.watermark_text,
    watermarkMode: row.watermark_mode,
    watermarkPositions: row.watermark_positions ?? [],
    allowEventTabs: row.allow_event_tabs,
    backgroundColor: normalizeShareBackgroundColor(row.background_color),
    expiresAt: dateValue(row.expires_at),
    hasPasscode: Boolean(row.passcode),
    createdAt: isoValue(row.created_at),
    updatedAt: isoValue(row.updated_at),
  };
}

function shareUrl(request: Request, token: string, customerSlug: string | null) {
  if (customerSlug) {
    return `${customerPublicUrl(customerSlug)}/share/${encodeURIComponent(token)}`;
  }
  return `${new URL(request.url).origin}/share/${encodeURIComponent(token)}`;
}

async function fetchAlbum(albumSlug: string) {
  return queryOne<AlbumRow>(
    `
    SELECT
      a.id,
      a.name,
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

    const rows = await query<ShareLinkRow>(
      `
      SELECT
        token,
        album_name,
        link_name,
        person_id,
        person_ids,
        person_name,
        only_person,
        allow_downloads,
        hide_ai,
        watermark_enabled,
        watermark_text,
        watermark_mode,
        watermark_positions,
        allow_event_tabs,
        background_color,
        expires_at,
        passcode,
        created_at,
        updated_at
      FROM album_share_links
      WHERE album_id = $1
      ORDER BY created_at DESC
      `,
      [album.id],
    );

    const links = rows.map((row) =>
      serializeLink(row, request, album.customer_slug),
    );

    return NextResponse.json({ links });
  } catch (error) {
    console.error("Error listing share links:", error);
    return NextResponse.json(
      { error: "Failed to list share links" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    await ensureAlbumShareLinkSchema();

    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const album = await fetchAlbum(albumSlug);
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const existing = await queryOne<ShareLinkRow>(
      `
      SELECT *
      FROM album_share_links
      WHERE album_id = $1
        AND token = $2
      LIMIT 1
      `,
      [album.id, token],
    );
    if (!existing) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, 120)
        : existing.link_name || existing.album_name;
    const backgroundColor = isShareBackgroundColor(body.backgroundColor)
      ? normalizeShareBackgroundColor(body.backgroundColor)
      : normalizeShareBackgroundColor(existing.background_color);
    const watermarkMode = body.watermarkMode === "full" ? "full" : "corners";
    const allowedPositions = new Set([
      "top_left",
      "top_right",
      "bottom_left",
      "bottom_right",
    ]);
    const positions = Array.isArray(body.watermarkPositions)
      ? body.watermarkPositions.filter(
          (position): position is string =>
            typeof position === "string" && allowedPositions.has(position),
        )
      : existing.watermark_positions ?? [];
    const passcode = updatedPasscode(
      body.passcode,
      body.clearPasscode,
      existing.passcode,
    );

    const updated = await queryOne<ShareLinkRow>(
      `
      UPDATE album_share_links
      SET
        link_name = $3,
        only_person = CASE
          WHEN person_id IS NOT NULL OR cardinality(COALESCE(person_ids, ARRAY[]::uuid[])) > 0
            THEN $4
          ELSE false
        END,
        allow_downloads = $5,
        hide_ai = $6,
        watermark_enabled = $7,
        watermark_text = $8,
        watermark_mode = $9,
        watermark_positions = $10::text[],
        allow_event_tabs = $11,
        background_color = $12,
        expires_at = $13::date,
        passcode = $14,
        updated_at = now()
      WHERE album_id = $1
        AND token = $2
      RETURNING *
      `,
      [
        album.id,
        token,
        name,
        Boolean(body.onlyPerson),
        Boolean(body.allowDownloads),
        Boolean(body.hideAi),
        Boolean(body.watermarkEnabled),
        typeof body.watermarkText === "string" && body.watermarkText.trim()
          ? body.watermarkText.trim().slice(0, 120)
          : existing.watermark_text,
        watermarkMode,
        watermarkMode === "full"
          ? []
          : positions.length
            ? positions
            : ["bottom_right"],
        Boolean(body.allowEventTabs),
        backgroundColor,
        expirationDate(body.expiresAt),
        passcode,
      ],
    );

    return NextResponse.json({
      link: serializeLink(updated!, request, album.customer_slug),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update share link";
    const status = message.startsWith("Passcode") || message.startsWith("Expiration") ? 400 : 500;
    console.error("Error updating share link:", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, { params }: Props) {
  try {
    await ensureAlbumShareLinkSchema();

    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const album = await fetchAlbum(albumSlug);
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    await query(
      `
      DELETE FROM album_share_links
      WHERE album_id = $1
        AND token = $2
      `,
      [album.id, token],
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting share link:", error);
    return NextResponse.json(
      { error: "Failed to delete share link" },
      { status: 500 },
    );
  }
}

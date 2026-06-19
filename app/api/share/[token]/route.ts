import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";
import { normalizeShareBackgroundColor } from "@/lib/share-theme";
import { hasValidSharePasscodeAccess } from "@/lib/share-passcode";

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
  expires_at: Date | string | null;
  background_color: string | null;
  passcode: string | null;
  person_id: string | null;
  person_name: string | null;
  link_name: string | null;
  only_person: boolean;
  allow_event_tabs: boolean;
}

function dateValue(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function serialize(row: ShareTokenRow) {
  return {
    token: row.token,
    albumSlug: row.album_slug,
    albumName: row.album_name,
    customerName: row.customer_name,
    expiresAt: dateValue(row.expires_at),
    backgroundColor: normalizeShareBackgroundColor(row.background_color),
    passcodeRequired: Boolean(row.passcode),
    personId: row.person_id,
    personName: row.person_name,
    linkName: row.link_name,
    onlyPerson: row.only_person,
    allowEventTabs: row.allow_event_tabs,
    allowDownloads: row.allow_downloads,
    watermarkEnabled: row.watermark_enabled,
    watermarkText: row.watermark_text,
    watermarkMode: row.watermark_mode,
    watermarkPositions: row.watermark_positions ?? [],
  };
}

function shortToken(value: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}

export async function GET(_request: Request, { params }: Props) {
  try {
    const { token } = await params;
    console.info("[share-debug] public share API start", {
      token: shortToken(token),
    });

    await ensureAlbumShareLinkSchema();

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
        s.watermark_positions,
        s.expires_at,
        s.background_color,
        s.passcode,
        s.person_id,
        s.person_name,
        s.link_name,
        s.only_person,
        s.allow_event_tabs
      FROM album_share_links s
      JOIN albums a
        ON a.id = s.album_id
       AND COALESCE(a.is_deleted, false) = false
      WHERE s.token = $1
        AND (s.expires_at IS NULL OR s.expires_at >= CURRENT_DATE)
      LIMIT 1
      `,
      [token],
    );

    if (!share) {
      console.warn("[share-debug] public share API token not found", {
        token: shortToken(token),
      });
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    if (!hasValidSharePasscodeAccess(_request, token, share.passcode)) {
      return NextResponse.json(
        {
          error: "Share passcode required",
          code: "SHARE_PASSCODE_REQUIRED",
          passcodeRequired: true,
        },
        { status: 401 },
      );
    }

    console.info("[share-debug] public share API token found", {
      token: shortToken(token),
      albumSlug: share.album_slug,
      allowDownloads: share.allow_downloads,
      watermarkEnabled: share.watermark_enabled,
    });

    return NextResponse.json({ share: serialize(share) });
  } catch (error) {
    console.error("[share-debug] public share API failed", {
      error,
    });
    return NextResponse.json(
      { error: "Failed to fetch share link" },
      { status: 500 },
    );
  }
}

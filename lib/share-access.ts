import { queryOne } from "@/lib/db";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";
import { shareTokenFromRequest } from "@/lib/auth-access";
import { hasValidSharePasscodeAccess } from "@/lib/share-passcode";

export interface ShareLinkAccess {
  token: string;
  albumSlug: string;
  expiresAt: string | null;
  backgroundColor: string | null;
  allowDownloads: boolean;
  watermarkEnabled: boolean;
  watermarkText: string | null;
  watermarkMode: "full" | "corners";
  watermarkPositions: string[];
  personId: string | null;
  personIds: string[];
  personName: string | null;
  linkName: string | null;
  onlyPerson: boolean;
  allowEventTabs: boolean;
}

interface ShareAccessRow {
  token: string;
  album_slug: string;
  expires_at: Date | string | null;
  background_color: string | null;
  allow_downloads: boolean;
  watermark_enabled: boolean;
  watermark_text: string | null;
  watermark_mode: "full" | "corners";
  watermark_positions: string[] | null;
  passcode: string | null;
  person_id: string | null;
  person_ids: string[] | null;
  person_name: string | null;
  link_name: string | null;
  only_person: boolean;
  allow_event_tabs: boolean;
}

export async function getShareLinkAccess(
  request: Request,
  albumSlug: string,
): Promise<ShareLinkAccess | null> {
  const token = shareTokenFromRequest(request);
  if (!token) return null;

  await ensureAlbumShareLinkSchema().catch(() => undefined);

  const row = await queryOne<ShareAccessRow>(
    `
    SELECT
      s.token,
      a.slug AS album_slug,
      s.expires_at,
      s.background_color,
      s.allow_downloads,
      s.watermark_enabled,
      s.watermark_text,
      s.watermark_mode,
      s.watermark_positions,
      s.passcode,
      s.person_id,
      s.person_ids,
      s.person_name,
      s.link_name,
      s.only_person,
      s.allow_event_tabs
    FROM album_share_links s
    JOIN albums a
      ON a.id = s.album_id
     AND COALESCE(a.is_deleted, false) = false
    WHERE s.token = $1
      AND lower(a.slug) = lower($2)
      AND (s.expires_at IS NULL OR s.expires_at >= CURRENT_DATE)
    LIMIT 1
    `,
    [token, albumSlug],
  ).catch(() => null);

  if (!row) return null;
  // A matching token is not enough: passcode-protected links need the verified
  // access cookie before album photo APIs can return restricted data.
  if (!hasValidSharePasscodeAccess(request, token, row.passcode)) return null;

  const personIds =
    row.person_ids && row.person_ids.length
      ? row.person_ids
      : row.person_id
        ? [row.person_id]
        : [];

  return {
    token: row.token,
    albumSlug: row.album_slug,
    expiresAt:
      row.expires_at instanceof Date
        ? row.expires_at.toISOString().slice(0, 10)
        : row.expires_at,
    backgroundColor: row.background_color,
    allowDownloads: row.allow_downloads,
    watermarkEnabled: row.watermark_enabled,
    watermarkText: row.watermark_text,
    watermarkMode: row.watermark_mode,
    watermarkPositions: row.watermark_positions ?? [],
    personId: personIds[0] ?? null,
    personIds,
    personName: row.person_name,
    linkName: row.link_name,
    onlyPerson: row.only_person,
    allowEventTabs: row.allow_event_tabs,
  };
}

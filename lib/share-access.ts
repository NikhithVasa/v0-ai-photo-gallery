import { queryOne } from "@/lib/db";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";
import { shareTokenFromRequest } from "@/lib/auth-access";

export interface ShareLinkAccess {
  token: string;
  albumSlug: string;
  allowDownloads: boolean;
  watermarkEnabled: boolean;
  watermarkText: string | null;
  watermarkMode: "full" | "corners";
  watermarkPositions: string[];
}

interface ShareAccessRow {
  token: string;
  album_slug: string;
  allow_downloads: boolean;
  watermark_enabled: boolean;
  watermark_text: string | null;
  watermark_mode: "full" | "corners";
  watermark_positions: string[] | null;
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
      AND lower(a.slug) = lower($2)
      AND (s.expires_at IS NULL OR s.expires_at >= CURRENT_DATE)
    LIMIT 1
    `,
    [token, albumSlug],
  ).catch(() => null);

  if (!row) return null;

  return {
    token: row.token,
    albumSlug: row.album_slug,
    allowDownloads: row.allow_downloads,
    watermarkEnabled: row.watermark_enabled,
    watermarkText: row.watermark_text,
    watermarkMode: row.watermark_mode,
    watermarkPositions: row.watermark_positions ?? [],
  };
}

import { queryOne } from "@/lib/db";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";
import { signedObjectUrl } from "@/lib/s3";

export interface SharePreviewLink {
  album_slug: string;
  album_name: string;
  link_name: string | null;
  customer_name: string | null;
  customer_slug: string | null;
  passcode: string | null;
  cover_photo_s3_key: string | null;
}

export async function fetchSharePreviewLink(token: string) {
  await ensureAlbumShareLinkSchema();

  return queryOne<SharePreviewLink>(
    `
    SELECT
      a.slug AS album_slug,
      s.album_name,
      s.link_name,
      COALESCE(s.customer_name, c.name) AS customer_name,
      c.slug AS customer_slug,
      s.passcode,
      a.cover_photo_s3_key
    FROM album_share_links s
    JOIN albums a
      ON a.id = s.album_id
     AND COALESCE(a.is_deleted, false) = false
    LEFT JOIN customers c
      ON c.id = a.customer_id
     AND COALESCE(c.is_deleted, false) = false
    WHERE s.token = $1
      AND (s.expires_at IS NULL OR s.expires_at >= CURRENT_DATE)
    LIMIT 1
    `,
    [token],
  );
}

export async function shareCoverPhotoUrl(key: string | null) {
  return signedObjectUrl(key);
}

export function sharePreviewText(share: SharePreviewLink) {
  const albumName = share.link_name || share.album_name;
  const customerName = share.customer_name?.trim() || "";
  const description = [customerName, albumName].filter(Boolean).join(", ");

  return {
    title: customerName ? `${customerName} - ${albumName}` : albumName,
    description: description || "Private photo gallery",
    albumName,
    customerName,
  };
}
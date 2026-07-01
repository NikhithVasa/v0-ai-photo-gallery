import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";
import { queryOne } from "@/lib/db";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { DEFAULT_SHARE_BACKGROUND_COLOR } from "@/lib/share-theme";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ albumSlug: string; videoId: string }>;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function POST(_request: Request, { params }: Props) {
  try {
    await ensureAlbumShareLinkSchema();

    const { albumSlug, videoId } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    if (!isUuid(videoId)) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const token = randomUUID().replace(/-/g, "");
    const share = await queryOne<{ token: string }>(
      `
      WITH selected_video AS (
        SELECT
          v.file_name,
          a.id AS album_id,
          a.name AS album_name,
          a.customer_id,
          c.name AS customer_name
        FROM videos v
        JOIN albums a
          ON a.id = v.album_id
         AND COALESCE(a.is_deleted, false) = false
        LEFT JOIN customers c
          ON c.id = a.customer_id
         AND COALESCE(c.is_deleted, false) = false
        WHERE v.id = $1::uuid
          AND lower(a.slug) = lower($2)
          AND COALESCE(v.is_deleted, false) = false
        LIMIT 1
      )
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
        background_color,
        passcode,
        link_name,
        created_at,
        updated_at
      )
      SELECT
        $3,
        $4,
        album_id,
        customer_id,
        album_name,
        customer_name,
        false,
        false,
        false,
        COALESCE(customer_name, album_name),
        'corners',
        ARRAY['bottom_right']::text[],
        $5,
        NULL,
        'Video: ' || COALESCE(NULLIF(file_name, ''), 'Video'),
        now(),
        now()
      FROM selected_video
      RETURNING token
      `,
      [videoId, albumSlug, randomUUID(), token, DEFAULT_SHARE_BACKGROUND_COLOR],
    );

    if (!share) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({ share: { token: share.token } });
  } catch (error) {
    console.error("Error creating video share link:", error);
    return NextResponse.json(
      { error: "Failed to create video share link" },
      { status: 500 },
    );
  }
}
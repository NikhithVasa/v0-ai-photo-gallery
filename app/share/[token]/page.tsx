import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ token: string }>;
}

interface ShareLinkRow {
  album_slug: string;
}

function shortToken(value: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}

export default async function SharedAlbumPage({ params }: PageProps) {
  const { token } = await params;
  let share: ShareLinkRow | null = null;

  console.info("[share-debug] /share page resolving token", {
    token: shortToken(token),
  });

  try {
    share = await queryOne<ShareLinkRow>(
      `
      SELECT a.slug AS album_slug
      FROM album_share_links s
      JOIN albums a
        ON a.id = s.album_id
       AND COALESCE(a.is_deleted, false) = false
      WHERE s.token = $1
      LIMIT 1
      `,
      [token],
    );
  } catch (error) {
    console.error("[share-debug] /share page query failed", {
      token: shortToken(token),
      error,
    });
  }

  if (!share) {
    console.warn("[share-debug] /share page token not found", {
      token: shortToken(token),
    });
    redirect("/albums");
  }

  console.info("[share-debug] /share page redirecting to album", {
    token: shortToken(token),
    albumSlug: share.album_slug,
  });

  redirect(
    `/albums/${encodeURIComponent(share.album_slug)}?share=${encodeURIComponent(token)}`,
  );
}

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

export default async function SharedAlbumPage({ params }: PageProps) {
  const { token } = await params;
  let share: ShareLinkRow | null = null;

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
    console.error("Error resolving share link:", error);
  }

  if (!share) redirect("/albums");

  redirect(
    `/albums/${encodeURIComponent(share.album_slug)}?share=${encodeURIComponent(token)}`,
  );
}

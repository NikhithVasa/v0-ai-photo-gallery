import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import {
  getCustomerSlugFromHost,
  getCustomerSlugFromRequest,
} from "@/lib/customer-host";

interface AlbumAccessRow {
  id: string;
}

export async function canAccessAlbumFromCustomerSlug(
  albumSlug: string,
  customerSlug: string | null
) {
  if (!customerSlug) return true;

  const album = await queryOne<AlbumAccessRow>(
    `
    SELECT a.id
    FROM albums a
    JOIN customers c
      ON c.id = a.customer_id
     AND COALESCE(c.is_deleted, false) = false
    WHERE a.slug = $1
      AND c.slug = $2
      AND COALESCE(a.is_deleted, false) = false
    LIMIT 1
    `,
    [albumSlug, customerSlug]
  );

  return Boolean(album);
}

export async function canAccessAlbumFromHost(albumSlug: string, host: string) {
  return canAccessAlbumFromCustomerSlug(
    albumSlug,
    getCustomerSlugFromHost(host)
  );
}

export async function requireAlbumAccess(request: Request, albumSlug: string) {
  const canAccess = await canAccessAlbumFromCustomerSlug(
    albumSlug,
    getCustomerSlugFromRequest(request)
  );

  if (canAccess) return null;

  return NextResponse.json({ error: "Album not found" }, { status: 404 });
}

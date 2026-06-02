import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import {
  canAccessAlbumByShareToken,
  getAuthAccess,
  unauthorizedResponse,
} from "@/lib/auth-access";
import {
  getCustomerSlugFromHost,
  getCustomerSlugFromRequest,
} from "@/lib/customer-host";

interface AlbumAccessRow {
  id: string;
  customer_id: string | null;
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
      AND (a.expires_at IS NULL OR a.expires_at >= CURRENT_DATE)
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
  const canAccessFromHost = await canAccessAlbumFromCustomerSlug(
    albumSlug,
    getCustomerSlugFromRequest(request)
  );

  if (canAccessFromHost) return null;

  if (await canAccessAlbumByShareToken(request, albumSlug)) {
    return null;
  }

  const access = await getAuthAccess();
  if (!access) return unauthorizedResponse();
  if (access.isAdmin) return null;

  const album = await queryOne<AlbumAccessRow>(
    `
    SELECT a.id, a.customer_id
    FROM albums a
    JOIN customers c
      ON c.id = a.customer_id
     AND COALESCE(c.is_deleted, false) = false
    WHERE a.slug = $1
      AND a.customer_id = ANY($2::uuid[])
      AND COALESCE(a.is_deleted, false) = false
    LIMIT 1
    `,
    [albumSlug, access.customerIds]
  );

  if (album) return null;

  return NextResponse.json({ error: "Album not found" }, { status: 404 });
}

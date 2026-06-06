import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import {
  canAccessAlbumByShareToken,
  getAuthAccess,
  unauthorizedResponse,
} from "@/lib/auth-access";
import { getCustomerSlugFromHost } from "@/lib/customer-host";

interface AlbumAccessRow {
  id: string;
  customer_id: string | null;
}

export async function canAccessAlbumFromCustomerSlug(
  albumSlug: string,
  customerSlug: string | null
) {
  if (!customerSlug) {
    console.info("[share-debug] host album access allowed on root host", {
      albumSlug,
    });
    return true;
  }

  console.info("[share-debug] checking host album access", {
    albumSlug,
    customerSlug,
  });

  const album = await queryOne<AlbumAccessRow>(
    `
    SELECT a.id
    FROM albums a
    JOIN customers c
      ON c.id = a.customer_id
     AND COALESCE(c.is_deleted, false) = false
    WHERE lower(a.slug) = lower($1)
      AND c.slug = $2
      AND COALESCE(a.is_deleted, false) = false
      AND (a.expires_at IS NULL OR a.expires_at >= CURRENT_DATE)
    LIMIT 1
    `,
    [albumSlug, customerSlug]
  );

  console.info("[share-debug] host album access result", {
    albumSlug,
    customerSlug,
    allowed: Boolean(album),
  });

  return Boolean(album);
}

export async function canAccessAlbumFromHost(albumSlug: string, host: string) {
  console.info("[share-debug] resolving album access from host", {
    albumSlug,
    host,
    customerSlug: getCustomerSlugFromHost(host),
  });

  return canAccessAlbumFromCustomerSlug(
    albumSlug,
    getCustomerSlugFromHost(host)
  );
}

export async function requireAlbumAccess(request: Request, albumSlug: string) {
  if (await canAccessAlbumByShareToken(request, albumSlug)) {
    console.info("[share-debug] requireAlbumAccess allowed by share token", {
      albumSlug,
    });
    return null;
  }

  const access = await getAuthAccess();
  if (!access) {
    console.warn("[share-debug] requireAlbumAccess denied: no auth", {
      albumSlug,
    });
    return unauthorizedResponse();
  }
  if (access.isAdmin) {
    console.info("[share-debug] requireAlbumAccess allowed: admin", {
      albumSlug,
      email: access.email,
    });
    return null;
  }

  console.info("[share-debug] checking authenticated album access", {
    albumSlug,
    email: access.email,
    customerIds: access.customerIds.length,
  });

  const album = await queryOne<AlbumAccessRow>(
    `
    SELECT a.id, a.customer_id
    FROM albums a
    JOIN customers c
      ON c.id = a.customer_id
     AND COALESCE(c.is_deleted, false) = false
    WHERE lower(a.slug) = lower($1)
      AND a.customer_id = ANY($2::uuid[])
      AND COALESCE(a.is_deleted, false) = false
    LIMIT 1
    `,
    [albumSlug, access.customerIds]
  );

  if (album) {
    console.info("[share-debug] requireAlbumAccess allowed: customer match", {
      albumSlug,
      email: access.email,
    });
    return null;
  }

  console.warn("[share-debug] requireAlbumAccess denied: album/customer miss", {
    albumSlug,
    email: access.email,
    customerIds: access.customerIds.length,
  });
  return NextResponse.json({ error: "Album not found" }, { status: 404 });
}

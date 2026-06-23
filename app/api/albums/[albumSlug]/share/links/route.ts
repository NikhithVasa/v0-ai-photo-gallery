import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { customerPublicUrl } from "@/lib/customer-host";
import { normalizeShareBackgroundColor } from "@/lib/share-theme";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface AlbumRow {
  id: string;
  name: string;
  customer_slug: string | null;
}

interface ShareLinkRow {
  token: string;
  album_name: string;
  link_name: string | null;
  person_id: string | null;
  person_ids: string[] | null;
  person_name: string | null;
  only_person: boolean;
  allow_downloads: boolean;
  background_color: string | null;
  expires_at: Date | string | null;
  passcode: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function dateValue(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function isoValue(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function shareUrl(request: Request, token: string, customerSlug: string | null) {
  if (customerSlug) {
    return `${customerPublicUrl(customerSlug)}/share/${encodeURIComponent(token)}`;
  }
  return `${new URL(request.url).origin}/share/${encodeURIComponent(token)}`;
}

async function fetchAlbum(albumSlug: string) {
  return queryOne<AlbumRow>(
    `
    SELECT
      a.id,
      a.name,
      c.slug AS customer_slug
    FROM albums a
    LEFT JOIN customers c
      ON c.id = a.customer_id
     AND COALESCE(c.is_deleted, false) = false
    WHERE lower(a.slug) = lower($1)
      AND COALESCE(a.is_deleted, false) = false
    LIMIT 1
    `,
    [albumSlug],
  );
}

export async function GET(request: Request, { params }: Props) {
  try {
    await ensureAlbumShareLinkSchema();

    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const album = await fetchAlbum(albumSlug);
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const rows = await query<ShareLinkRow>(
      `
      SELECT
        token,
        album_name,
        link_name,
        person_id,
        person_ids,
        person_name,
        only_person,
        allow_downloads,
        background_color,
        expires_at,
        passcode,
        created_at,
        updated_at
      FROM album_share_links
      WHERE album_id = $1
      ORDER BY created_at DESC
      `,
      [album.id],
    );

    const links = rows.map((row) => {
      const personIds =
        row.person_ids && row.person_ids.length
          ? row.person_ids
          : row.person_id
            ? [row.person_id]
            : [];
      const isPerson = personIds.length > 0;

      return {
        token: row.token,
        url: shareUrl(request, row.token, album.customer_slug),
        type: isPerson ? "person" : "album",
        name:
          row.link_name ||
          (isPerson ? row.person_name || "People" : row.album_name),
        personName: row.person_name,
        personIds,
        peopleCount: personIds.length,
        onlyPerson: row.only_person,
        allowDownloads: row.allow_downloads,
        backgroundColor: normalizeShareBackgroundColor(row.background_color),
        expiresAt: dateValue(row.expires_at),
        hasPasscode: Boolean(row.passcode),
        createdAt: isoValue(row.created_at),
        updatedAt: isoValue(row.updated_at),
      };
    });

    return NextResponse.json({ links });
  } catch (error) {
    console.error("Error listing share links:", error);
    return NextResponse.json(
      { error: "Failed to list share links" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: Props) {
  try {
    await ensureAlbumShareLinkSchema();

    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const album = await fetchAlbum(albumSlug);
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    await query(
      `
      DELETE FROM album_share_links
      WHERE album_id = $1
        AND token = $2
      `,
      [album.id, token],
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting share link:", error);
    return NextResponse.json(
      { error: "Failed to delete share link" },
      { status: 500 },
    );
  }
}

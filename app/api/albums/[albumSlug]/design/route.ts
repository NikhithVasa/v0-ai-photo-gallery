import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import {
  ensureAlbumDesignSchema,
  normalizeAlbumDesignSettings,
} from "@/lib/album-design";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface AlbumDesignRow {
  id: string;
  design_settings: unknown;
}

async function fetchAlbumDesign(albumSlug: string) {
  return queryOne<AlbumDesignRow>(
    `
    SELECT id, design_settings
    FROM albums
    WHERE lower(slug) = lower($1)
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
    `,
    [albumSlug],
  );
}

export async function GET(_request: Request, { params }: Props) {
  try {
    await ensureAlbumDesignSchema();

    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const album = await fetchAlbumDesign(albumSlug);
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    return NextResponse.json({ designSettings: normalizeAlbumDesignSettings(album.design_settings) });
  } catch (error) {
    console.error("Error fetching album design settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch design settings" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    await ensureAlbumDesignSchema();

    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = await request.json().catch(() => ({}));
    const settings = normalizeAlbumDesignSettings(body);
    const album = await queryOne<AlbumDesignRow>(
      `
      UPDATE albums
      SET design_settings = $2::jsonb,
          updated_at = now()
      WHERE lower(slug) = lower($1)
        AND COALESCE(is_deleted, false) = false
      RETURNING id, design_settings
      `,
      [albumSlug, JSON.stringify(settings)],
    );

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    return NextResponse.json({ designSettings: normalizeAlbumDesignSettings(album.design_settings) });
  } catch (error) {
    console.error("Error saving album design settings:", error);
    return NextResponse.json(
      { error: "Failed to save design settings" },
      { status: 500 },
    );
  }
}
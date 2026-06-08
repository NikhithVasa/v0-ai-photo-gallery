import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { canAccessAlbumFromHost } from "@/lib/album-access";
import { accessCodeMatches } from "@/lib/access-code";
import { setPasscodeAccessCookie } from "@/lib/passcode-access-cookie";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface AlbumPasswordRow {
  password_required: boolean | null;
  password_hash: string | null;
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const canAccessFromHost = await canAccessAlbumFromHost(
      albumSlug,
      request.headers.get("host") || "",
    );

    if (!canAccessFromHost) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const body = (await request.json()) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";

    const album = await queryOne<AlbumPasswordRow>(
      `
      SELECT password_required, password_hash
      FROM albums
      WHERE lower(slug) = lower($1)
        AND COALESCE(is_deleted, false) = false
        AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
      LIMIT 1
      `,
      [albumSlug]
    );

    if (!album) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    if (!album.password_required) {
      return NextResponse.json({ ok: true });
    }

    if (!password || !album.password_hash) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const ok = accessCodeMatches(password, album.password_hash);
    const response = NextResponse.json({ ok }, { status: ok ? 200 : 401 });

    if (ok) {
      setPasscodeAccessCookie(
        response,
        "album",
        albumSlug,
        album.password_hash,
      );
    }

    return response;
  } catch (error) {
    console.error("Error verifying album password:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to verify password" },
      { status: 500 }
    );
  }
}

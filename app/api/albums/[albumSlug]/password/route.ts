import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAlbumAccess } from "@/lib/album-access";
import { generateRandomAccessCode, hashAccessCode } from "@/lib/access-code";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface SetPasswordBody {
  password?: unknown;
  generateNew?: unknown;
}

interface AlbumPasswordRow {
  id: string;
  slug: string;
  password_required: boolean | null;
  password_hash: string | null;
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) return accessDenied;

    const album = await queryOne<AlbumPasswordRow>(
      `
      SELECT id, slug, password_required, password_hash
      FROM albums
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      `,
      [albumSlug]
    );

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    return NextResponse.json({
      passwordRequired: album.password_required || false,
      hasPassword: Boolean(album.password_hash),
    });
  } catch (error) {
    console.error("Error getting album password status:", error);
    return NextResponse.json(
      { error: "Failed to get password status" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json()) as SetPasswordBody;
    const generateNew = body.generateNew === true;
    const providedPassword =
      typeof body.password === "string" ? body.password.trim() : "";

    if (!generateNew && !providedPassword) {
      return NextResponse.json(
        { error: "Password or generateNew flag is required" },
        { status: 400 }
      );
    }

    const password = generateNew ? generateRandomAccessCode() : providedPassword;

    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters" },
        { status: 400 }
      );
    }

    const passwordHash = hashAccessCode(password);

    const album = await queryOne<AlbumPasswordRow>(
      `
      UPDATE albums
      SET password_required = true,
          password_hash = $2,
          updated_at = now()
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      RETURNING id, slug, password_required, password_hash
      `,
      [albumSlug, passwordHash]
    );

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      password,
      message: `Passcode set to: ${password}`,
    });
  } catch (error) {
    console.error("Error setting album password:", error);
    return NextResponse.json(
      { error: "Failed to set password" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) return accessDenied;

    await queryOne<AlbumPasswordRow>(
      `
      UPDATE albums
      SET password_required = false,
          password_hash = null,
          updated_at = now()
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      `,
      [albumSlug]
    );

    return NextResponse.json({
      success: true,
      message: "Passcode removed",
    });
  } catch (error) {
    console.error("Error removing album password:", error);
    return NextResponse.json(
      { error: "Failed to remove password" },
      { status: 500 }
    );
  }
}

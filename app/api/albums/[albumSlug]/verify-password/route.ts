import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface AlbumPasswordRow {
  password_required: boolean | null;
  password_hash: string | null;
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function passwordMatches(password: string, storedHash: string) {
  if (storedHash.startsWith("sha256:")) {
    const digest = createHash("sha256").update(password).digest("hex");
    return safeCompare(`sha256:${digest}`, storedHash);
  }

  return safeCompare(password, storedHash);
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const body = (await request.json()) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";

    const album = await queryOne<AlbumPasswordRow>(
      `
      SELECT password_required, password_hash
      FROM albums
      WHERE slug = $1
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

    const ok = passwordMatches(password, album.password_hash);
    return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
  } catch (error) {
    console.error("Error verifying album password:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to verify password" },
      { status: 500 }
    );
  }
}

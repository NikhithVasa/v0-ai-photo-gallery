import { NextResponse } from "next/server";
import { accessCodeMatches } from "@/lib/access-code";
import { queryOne } from "@/lib/db";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";
import { setPasscodeAccessCookie } from "@/lib/passcode-access-cookie";
import { sharePasscodeHash } from "@/lib/share-passcode";

interface Props {
  params: Promise<{ token: string }>;
}

interface SharePasscodeRow {
  passcode: string | null;
}

export async function POST(request: Request, { params }: Props) {
  try {
    await ensureAlbumShareLinkSchema();

    const { token } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      passcode?: unknown;
    };
    const passcode =
      typeof body.passcode === "string" ? body.passcode.trim() : "";

    const share = await queryOne<SharePasscodeRow>(
      `
      SELECT s.passcode
      FROM album_share_links s
      JOIN albums a
        ON a.id = s.album_id
       AND COALESCE(a.is_deleted, false) = false
      WHERE s.token = $1
        AND (s.expires_at IS NULL OR s.expires_at >= CURRENT_DATE)
      LIMIT 1
      `,
      [token],
    );

    if (!share) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }
    if (!share.passcode) {
      return NextResponse.json({ ok: true });
    }
    if (!passcode || !accessCodeMatches(passcode, share.passcode)) {
      return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    setPasscodeAccessCookie(
      response,
      "share",
      token,
      sharePasscodeHash(share.passcode),
    );
    return response;
  } catch (error) {
    console.error("Error verifying share passcode:", error);
    return NextResponse.json(
      { error: "Failed to verify passcode" },
      { status: 500 },
    );
  }
}

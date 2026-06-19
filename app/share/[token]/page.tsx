import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SharePasscodeGate } from "@/components/share-passcode-gate";
import { queryOne } from "@/lib/db";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";
import { customerPublicUrl, getCustomerSlugFromHost } from "@/lib/customer-host";
import { passcodeAccessCookieName } from "@/lib/passcode-access-cookie";
import { verifySharePasscodeAccessToken } from "@/lib/share-passcode";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ token: string }>;
}

interface ShareLinkRow {
  album_slug: string;
  album_name: string;
  customer_slug: string | null;
  passcode: string | null;
}

function shortToken(value: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}

export default async function SharedAlbumPage({ params }: PageProps) {
  const { token } = await params;
  let share: ShareLinkRow | null = null;

  console.info("[share-debug] /share page resolving token", {
    token: shortToken(token),
  });

  try {
    await ensureAlbumShareLinkSchema();

    share = await queryOne<ShareLinkRow>(
      `
      SELECT
        a.slug AS album_slug,
        s.album_name,
        c.slug AS customer_slug,
        s.passcode
      FROM album_share_links s
      JOIN albums a
        ON a.id = s.album_id
       AND COALESCE(a.is_deleted, false) = false
      LEFT JOIN customers c
        ON c.id = a.customer_id
       AND COALESCE(c.is_deleted, false) = false
      WHERE s.token = $1
        AND (s.expires_at IS NULL OR s.expires_at >= CURRENT_DATE)
      LIMIT 1
      `,
      [token],
    );
  } catch (error) {
    console.error("[share-debug] /share page query failed", {
      token: shortToken(token),
      error,
    });
  }

  if (!share) {
    console.warn("[share-debug] /share page token not found", {
      token: shortToken(token),
    });

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-6 text-center text-[#1d1d1f]">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-semibold tracking-normal">
            Share link unavailable
          </h1>
          <p className="text-sm leading-6 text-zinc-500">
            This gallery link is invalid or has expired. Ask the photographer for
            a new link.
          </p>
        </div>
      </main>
    );
  }

  const host = (await headers()).get("host") || "";
  const customerSlugFromHost = getCustomerSlugFromHost(host);

  if (share.customer_slug && !customerSlugFromHost) {
    redirect(
      `${customerPublicUrl(share.customer_slug)}/share/${encodeURIComponent(token)}`,
    );
  }

  if (share.passcode) {
    const cookieStore = await cookies();
    const accessToken =
      cookieStore.get(passcodeAccessCookieName("share", token))?.value || "";

    if (
      !verifySharePasscodeAccessToken(
        accessToken,
        token,
        share.passcode,
      )
    ) {
      return <SharePasscodeGate token={token} albumName={share.album_name} />;
    }
  }

  console.info("[share-debug] /share page redirecting to album", {
    token: shortToken(token),
    albumSlug: share.album_slug,
    customerSlug: share.customer_slug,
  });

  const albumPath = `/albums/${encodeURIComponent(share.album_slug)}?share=${encodeURIComponent(token)}`;

  redirect(albumPath);
}

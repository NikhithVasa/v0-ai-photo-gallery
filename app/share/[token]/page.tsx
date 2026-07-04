import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SharePasscodeGate } from "@/components/share-passcode-gate";
import { customerPublicUrl, getCustomerSlugFromHost } from "@/lib/customer-host";
import { passcodeAccessCookieName } from "@/lib/passcode-access-cookie";
import { verifySharePasscodeAccessToken } from "@/lib/share-passcode";
import { signedUrl } from "@/lib/s3";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import {
  fetchSharePreviewLink,
  sharePreviewText,
  type SharePreviewLink,
} from "@/lib/share-preview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ token: string }>;
}

type ShareLinkRow = SharePreviewLink;

function shortToken(value: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}

async function currentOrigin() {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ||
    headerStore.get("host") ||
    new URL(SITE_URL).host;
  const protocol = headerStore.get("x-forwarded-proto") || "https";
  return `${protocol}://${host}`;
}

function isLinkPreviewCrawler(userAgent: string) {
  return /whatsapp|facebookexternalhit|facebot|twitterbot|slackbot|linkedinbot|telegrambot|discordbot|skypeuripreview|pinterest|crawler|spider/i.test(
    userAgent,
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;

  try {
    const share = await fetchSharePreviewLink(token);
    if (!share) return {};

    const origin = await currentOrigin();
    const preview = sharePreviewText(share);
    const url = `${origin}/share/${encodeURIComponent(token)}`;
    const imageUrl = `${url}/opengraph-image`;

    return {
      metadataBase: new URL(origin),
      title: preview.title,
      description: preview.description,
      alternates: {
        canonical: url,
      },
      openGraph: {
        title: preview.title,
        description: preview.description,
        url,
        siteName: SITE_NAME,
        type: "website",
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: `${preview.albumName} cover photo`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: preview.title,
        description: preview.description,
        images: [imageUrl],
      },
    };
  } catch (error) {
    console.error("[share-debug] /share metadata failed", {
      token: shortToken(token),
      error,
    });
    return {};
  }
}

export default async function SharedAlbumPage({ params }: PageProps) {
  const { token } = await params;
  let share: ShareLinkRow | null = null;

  console.info("[share-debug] /share page resolving token", {
    token: shortToken(token),
  });

  try {
    share = await fetchSharePreviewLink(token);
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

  const headerStore = await headers();
  const host = headerStore.get("host") || "";
  const userAgent = headerStore.get("user-agent") || "";
  const customerSlugFromHost = getCustomerSlugFromHost(host);

  if (isLinkPreviewCrawler(userAgent)) {
    const preview = sharePreviewText(share);
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-6 text-center text-[#1d1d1f]">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-semibold tracking-normal">
            {preview.title}
          </h1>
          <p className="text-sm leading-6 text-zinc-500">
            {preview.description}
          </p>
        </div>
      </main>
    );
  }

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
      const coverPhotoUrl = await signedUrl(share.cover_photo_s3_key);
      return (
        <SharePasscodeGate
          token={token}
          albumName={share.link_name || share.album_name}
          coverPhotoUrl={coverPhotoUrl}
        />
      );
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

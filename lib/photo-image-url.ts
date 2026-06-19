import { cloudFrontImageUrl } from "@/lib/cloudfront-url";

const MEDIA_PROXY_FALLBACK_ENABLED =
  process.env.NEXT_PUBLIC_ALLOW_MEDIA_PROXY_FALLBACK === "true";

function mediaProxyUrlForS3Key(key: string, shareToken = "") {
  if (!MEDIA_PROXY_FALLBACK_ENABLED) return null;

  const params = new URLSearchParams({ key });
  if (shareToken) params.set("share", shareToken);
  return `/api/media?${params.toString()}`;
}

export function mediaUrlForS3KeyWithShare(
  key?: string | null,
  shareToken = "",
) {
  if (!key) return null;

  const cloudFrontUrl = cloudFrontImageUrl(key);
  if (cloudFrontUrl) return cloudFrontUrl;

  return mediaProxyUrlForS3Key(key, shareToken);
}

export function imageUrlWithShare(url?: string | null, shareToken = "") {
  if (!url) return null;

  try {
    const parsed = new URL(url, "https://saathidesk.local");
    if (parsed.pathname !== "/api/media") return url;

    const key = parsed.searchParams.get("key");
    const cloudFrontUrl = cloudFrontImageUrl(key);
    if (cloudFrontUrl) return cloudFrontUrl;

    if (!MEDIA_PROXY_FALLBACK_ENABLED) return null;

    if (shareToken) parsed.searchParams.set("share", shareToken);
    return url.startsWith("/")
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : parsed.toString();
  } catch {
    return url;
  }
}

export function photoPreviewImageUrl(
  photo: {
    previewUrl?: string | null;
    thumbnailUrl?: string | null;
    cleanPreviewS3Key?: string | null;
    watermarkedPreviewS3Key?: string | null;
    thumbnailS3Key?: string | null;
    aiInputS3Key?: string | null;
  },
  shareToken = "",
) {
  return (
    mediaUrlForS3KeyWithShare(photo.cleanPreviewS3Key, shareToken) ||
    mediaUrlForS3KeyWithShare(photo.watermarkedPreviewS3Key, shareToken) ||
    mediaUrlForS3KeyWithShare(photo.thumbnailS3Key, shareToken) ||
    mediaUrlForS3KeyWithShare(photo.aiInputS3Key, shareToken) ||
    imageUrlWithShare(photo.previewUrl, shareToken) ||
    imageUrlWithShare(photo.thumbnailUrl, shareToken) ||
    null
  );
}

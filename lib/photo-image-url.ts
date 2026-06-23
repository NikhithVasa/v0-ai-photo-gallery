import { cloudFrontImageUrl } from "@/lib/cloudfront-url";

export function mediaProxyUrlForS3Key(
  key?: string | null,
  shareToken = "",
) {
  if (!key) return null;

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
  if (cloudFrontUrl && process.env.NEXT_PUBLIC_FORCE_CLOUDFRONT_IMAGES === "true") {
    return cloudFrontUrl;
  }

  return mediaProxyUrlForS3Key(key, shareToken);
}

export function imageUrlWithShare(url?: string | null, shareToken = "") {
  if (!url || !shareToken) return url ?? null;

  try {
    const parsed = new URL(url, "https://saathidesk.local");
    if (parsed.pathname !== "/api/media") return url;

    parsed.searchParams.set("share", shareToken);
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
    originalS3Key?: string | null;
  },
  shareToken = "",
) {
  return (
    mediaUrlForS3KeyWithShare(photo.aiInputS3Key, shareToken) ||
    mediaUrlForS3KeyWithShare(photo.originalS3Key, shareToken) ||
    imageUrlWithShare(photo.previewUrl, shareToken) ||
    imageUrlWithShare(photo.thumbnailUrl, shareToken) ||
    mediaUrlForS3KeyWithShare(photo.cleanPreviewS3Key, shareToken) ||
    mediaUrlForS3KeyWithShare(photo.watermarkedPreviewS3Key, shareToken) ||
    mediaUrlForS3KeyWithShare(photo.thumbnailS3Key, shareToken) ||
    null
  );
}

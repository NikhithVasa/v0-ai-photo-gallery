export function mediaUrlForS3KeyWithShare(
  key?: string | null,
  shareToken = "",
) {
  if (!key) return null;

  const params = new URLSearchParams({ key });
  if (shareToken) params.set("share", shareToken);
  return `/api/media?${params.toString()}`;
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
  photo: { previewUrl?: string | null; thumbnailUrl?: string | null },
  shareToken = "",
) {
  return (
    imageUrlWithShare(photo.previewUrl, shareToken) ||
    imageUrlWithShare(photo.thumbnailUrl, shareToken) ||
    null
  );
}

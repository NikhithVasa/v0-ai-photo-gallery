import type { Photo } from "@/lib/types";

export interface CachedPhotoImage {
  imageUrl?: string | null;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  updatedAt: number;
}

export type CachedPhotoImageMap = Record<string, CachedPhotoImage>;

const CACHE_PREFIX = "saathidesk:photo-image-cache:v1";

function cacheKey(albumSlug: string, shareToken = "") {
  return `${CACHE_PREFIX}:${albumSlug}:${shareToken}`;
}

function readRawCache(albumSlug: string, shareToken = ""): CachedPhotoImageMap {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.sessionStorage.getItem(cacheKey(albumSlug, shareToken));
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as CachedPhotoImageMap)
      : {};
  } catch {
    return {};
  }
}

function writeRawCache(
  albumSlug: string,
  shareToken: string,
  cache: CachedPhotoImageMap,
) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      cacheKey(albumSlug, shareToken),
      JSON.stringify(cache),
    );
  } catch {
    // Best-effort cache only.
  }
}

export function readCachedPhotoImages(albumSlug: string, shareToken = "") {
  return readRawCache(albumSlug, shareToken);
}

export function rememberPhotoImages(
  albumSlug: string,
  shareToken: string,
  photos: Photo[],
) {
  if (!photos.length) return;

  const current = readRawCache(albumSlug, shareToken);
  const updatedAt = Date.now();

  for (const photo of photos) {
    current[photo.id] = {
      ...current[photo.id],
      previewUrl: photo.previewUrl,
      thumbnailUrl: photo.thumbnailUrl,
      updatedAt,
    };
  }

  writeRawCache(albumSlug, shareToken, current);
}

export function rememberLoadedPhotoImage(
  albumSlug: string,
  shareToken: string,
  photoId: string,
  imageUrl: string | null | undefined,
) {
  if (!imageUrl) return;

  const current = readRawCache(albumSlug, shareToken);
  current[photoId] = {
    ...current[photoId],
    imageUrl,
    updatedAt: Date.now(),
  };

  writeRawCache(albumSlug, shareToken, current);
}

export function cachedPhotoImageUrl(
  photo: { id: string; previewUrl?: string | null; thumbnailUrl?: string | null },
  cache: CachedPhotoImageMap,
) {
  const cached = cache[photo.id];
  return (
    cached?.imageUrl ||
    cached?.thumbnailUrl ||
    cached?.previewUrl ||
    photo.thumbnailUrl ||
    photo.previewUrl ||
    null
  );
}

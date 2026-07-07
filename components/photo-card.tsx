"use client";

import {
  memo,
  type CSSProperties,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  GitMerge,
  Heart,
  ImagePlus,
  Loader2,
  Mail,
  Palette,
  Pause,
  Pencil,
  Play,
  Share2,
  SlidersHorizontal,
  Sparkles,
  User,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { useSWRConfig } from "swr";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PhotoPresetPanel } from "@/components/photo-preset-panel";
import { RetryableAvatarImage } from "@/components/retryable-avatar-image";
import { RetryingImage } from "@/components/retrying-image";
import { Skeleton } from "@/components/ui/skeleton";
import { cloudFrontImageUrl } from "@/lib/cloudfront-url";
import {
  imageUrlWithShare,
  mediaUrlForS3KeyWithShare,
} from "@/lib/photo-image-url";
import { photoAspectRatio } from "@/lib/photo-layout";
import type {
  AlbumEvent,
  AlbumShareSettings,
  Person,
  Photo,
  PhotoPerson,
} from "@/lib/types";

interface SignedPhotoUrls {
  previewUrl: string | null;
  downloadUrl: string | null;
  thumbnailUrl?: string | null;
  originalUrl?: string | null;
}

const signedPhotoUrlCache = new Map<string, SignedPhotoUrls | null>();

function signedPhotoUrlCacheKey(albumSlug: string, shareToken: string, photoId: string) {
  return `${albumSlug}:${shareToken}:${photoId}`;
}

async function fetchSignedPhotoUrls(
  albumSlug: string,
  ids: string[],
  shareToken = "",
) {
  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.length) return {};

  const url = `/api/albums/${encodeURIComponent(
    albumSlug,
  )}/photos/signed-urls${shareToken ? `?share=${encodeURIComponent(shareToken)}` : ""}`;

  const response = await fetch(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds: uniqueIds }),
    },
  );

  if (!response.ok) return {};

  const data = (await response.json()) as {
    urls?: Record<string, SignedPhotoUrls>;
    photos?: Array<{ id: string } & SignedPhotoUrls>;
  };

  if (data.urls) return data.urls;

  return Object.fromEntries(
    (data.photos ?? []).map((photo) => [
      photo.id,
      {
        previewUrl: photo.previewUrl,
        downloadUrl: photo.downloadUrl,
        thumbnailUrl: photo.thumbnailUrl,
        originalUrl: photo.originalUrl,
      },
    ]),
  ) as Record<string, SignedPhotoUrls>;
}

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function uniqueUrls(urls: Array<string | null | undefined>) {
  return Array.from(new Set(urls.filter((url): url is string => Boolean(url))));
}

function previewUrlsForPhoto(
  photo: Photo,
  options: {
    includeCloudFront?: boolean;
    includeMediaFallback?: boolean;
    preferMediaFallback?: boolean;
    shareToken?: string;
  } = {},
) {
  const includeCloudFront = options.includeCloudFront ?? false;
  const includeMediaFallback = options.includeMediaFallback ?? true;
  const preferMediaFallback = options.preferMediaFallback ?? true;
  const mediaFallbackUrls = includeMediaFallback
    ? [
        mediaUrlForS3KeyWithShare(photo.cleanPreviewS3Key, options.shareToken),
        mediaUrlForS3KeyWithShare(photo.watermarkedPreviewS3Key, options.shareToken),
        mediaUrlForS3KeyWithShare(photo.thumbnailS3Key, options.shareToken),
        mediaUrlForS3KeyWithShare(photo.aiInputS3Key, options.shareToken),
      ]
    : [];
  const cloudFrontUrls = includeCloudFront
    ? [
        cloudFrontImageUrl(photo.cleanPreviewS3Key),
        cloudFrontImageUrl(photo.watermarkedPreviewS3Key),
        cloudFrontImageUrl(photo.thumbnailS3Key),
        cloudFrontImageUrl(photo.aiInputS3Key),
      ]
    : [];
  const providedUrls = [
    imageUrlWithShare(photo.previewUrl, options.shareToken),
    imageUrlWithShare(photo.thumbnailUrl, options.shareToken),
  ];

  return uniqueUrls([
    ...(preferMediaFallback ? mediaFallbackUrls : providedUrls),
    ...(preferMediaFallback ? providedUrls : mediaFallbackUrls),
    ...cloudFrontUrls,
  ]);
}

const LIGHTBOX_PRELOAD_RADIUS = 3;
const DEFAULT_SWIPE_ANIMATION_MS = 240;
const MIN_SWIPE_ANIMATION_MS = 120;

function lightboxPreloadIndices(
  currentIndex: number,
  total: number,
  radius = LIGHTBOX_PRELOAD_RADIUS,
) {
  if (total <= 0) return [];

  const indices: number[] = [];
  const seen = new Set<number>();
  const addIndex = (rawIndex: number) => {
    const index = ((rawIndex % total) + total) % total;
    if (seen.has(index)) return;
    seen.add(index);
    indices.push(index);
  };

  addIndex(currentIndex);
  for (let offset = 1; offset <= radius; offset += 1) {
    addIndex(currentIndex + offset);
    addIndex(currentIndex - offset);
  }

  return indices;
}

const AI_EDIT_PRESETS = [
  {
    key: "remove_background",
    label: "Remove background",
    prompt: "Remove the background cleanly and keep the main subject sharp. Use a clean transparent or simple studio-style background.",
  },
  {
    key: "blur_background",
    label: "Blur background",
    prompt: "Blur the background naturally while keeping the main subject sharp and realistic.",
  },
  {
    key: "enhance_lighting",
    label: "Enhance lighting",
    prompt: "Improve the lighting, color balance, and sharpness while keeping the photo natural and realistic.",
  },
  {
    key: "remove_object",
    label: "Remove object",
    prompt: "Remove distracting objects from the background and fill the area naturally.",
  },
  {
    key: "add_dog",
    label: "Add dog next to it",
    prompt: "Add a realistic friendly dog next to the main subject. Match the lighting, shadows, perspective, and photo style naturally.",
  },
  {
    key: "studio_portrait",
    label: "Studio portrait",
    prompt: "Convert this into a clean professional studio portrait while preserving the person's identity and outfit.",
  },
  {
    key: "animate_demonslayer",
    label: "Animate image demonslayer",
    prompt: "Animate the image in a dynamic, high-energy Demon Slayer anime style with flowing elemental effects, dynamic motion lines, and dramatic atmospheric lighting.",
  },
  {
    key: "make_cinematic",
    label: "Cinematic look",
    prompt: "Give this photo a cinematic look with rich contrast, beautiful lighting, and natural colors.",
  },
  {
    key: "remove_people_background",
    label: "Remove background people",
    prompt: "Remove extra people in the background while keeping the main subject unchanged.",
  },
];

const INSTAGRAM_FILTERS = [
  {
    key: "normal",
    label: "Original / Normal",
    cssFilter: "none",
  },
  {
    key: "clarendon",
    label: "Clarendon",
    cssFilter: "sepia(.15) contrast(1.25) brightness(1.25) hue-rotate(5deg)",
    overlay: {
      background: "rgba(127, 187, 227, .4)",
      mixBlendMode: "overlay",
    },
  },
  {
    key: "gingham",
    label: "Gingham",
    cssFilter: "contrast(1.1) brightness(1.1)",
    overlay: {
      background: "#e6e6e6",
      mixBlendMode: "soft-light",
    },
  },
  {
    key: "moon",
    label: "Moon",
    cssFilter: "brightness(1.4) contrast(.95) saturate(0) sepia(.35)",
  },
  {
    key: "lark",
    label: "Lark",
    cssFilter: "sepia(.25) contrast(1.2) brightness(1.3) saturate(1.25)",
  },
  {
    key: "reyes",
    label: "Reyes",
    cssFilter: "sepia(.75) contrast(.75) brightness(1.25) saturate(1.4)",
  },
  {
    key: "juno",
    label: "Juno",
    cssFilter: "sepia(.35) contrast(1.15) brightness(1.15) saturate(1.8)",
    overlay: {
      background: "rgba(127, 187, 227, .2)",
      mixBlendMode: "overlay",
    },
  },
  {
    key: "slumber",
    label: "Slumber",
    cssFilter: "sepia(.35) contrast(1.25) saturate(1.25)",
    overlay: {
      background: "rgba(125, 105, 24, .2)",
      mixBlendMode: "darken",
    },
  },
  {
    key: "crema",
    label: "Crema",
    cssFilter: "sepia(.5) contrast(1.25) brightness(1.15) saturate(.9) hue-rotate(-2deg)",
    overlay: {
      background: "rgba(125, 105, 24, .2)",
      mixBlendMode: "multiply",
    },
  },
  {
    key: "ludwig",
    label: "Ludwig",
    cssFilter: "sepia(.25) contrast(1.05) brightness(1.05) saturate(2)",
    overlay: {
      background: "rgba(125, 105, 24, .1)",
      mixBlendMode: "overlay",
    },
  },
  {
    key: "aden",
    label: "Aden",
    cssFilter: "sepia(.2) brightness(1.15) saturate(1.4)",
    overlay: {
      background: "rgba(125, 105, 24, .1)",
      mixBlendMode: "multiply",
    },
  },
  {
    key: "perpetua",
    label: "Perpetua",
    cssFilter: "contrast(1.1) brightness(1.25) saturate(1.1)",
    overlay: {
      background: "linear-gradient(to bottom, rgba(0, 91, 154, .25), rgba(230, 193, 61, .25))",
      mixBlendMode: "multiply",
    },
  },
  {
    key: "amaro",
    label: "Amaro",
    cssFilter: "sepia(.35) contrast(1.1) brightness(1.2) saturate(1.3)",
    overlay: {
      background: "rgba(125, 105, 24, .2)",
      mixBlendMode: "overlay",
    },
  },
  {
    key: "mayfair",
    label: "Mayfair",
    cssFilter: "contrast(1.1) brightness(1.15) saturate(1.1)",
    overlay: {
      background: "radial-gradient(circle closest-corner, transparent 0, rgba(175, 105, 24, .4) 100%)",
      mixBlendMode: "multiply",
    },
  },
  {
    key: "rise",
    label: "Rise",
    cssFilter: "sepia(.25) contrast(1.25) brightness(1.2) saturate(.9)",
    overlay: {
      background: "radial-gradient(circle closest-corner, transparent 0, rgba(230, 193, 61, .25) 100%)",
      mixBlendMode: "lighten",
    },
  },
  {
    key: "hudson",
    label: "Hudson",
    cssFilter: "sepia(.25) contrast(1.2) brightness(1.2) saturate(1.05) hue-rotate(-15deg)",
    overlay: {
      background: "radial-gradient(circle closest-corner, transparent 25%, rgba(25, 62, 167, .25) 100%)",
      mixBlendMode: "multiply",
    },
  },
  {
    key: "valencia",
    label: "Valencia",
    cssFilter: "sepia(.25) contrast(1.1) brightness(1.1)",
    overlay: {
      background: "rgba(230, 193, 61, .1)",
      mixBlendMode: "lighten",
    },
  },
  {
    key: "xpro2",
    label: "X-Pro II",
    cssFilter: "sepia(.45) contrast(1.25) brightness(1.75) saturate(1.3) hue-rotate(-5deg)",
    overlay: {
      background: "radial-gradient(circle closest-corner, rgba(0, 91, 154, .35) 0, rgba(0, 0, 0, .65) 100%)",
      mixBlendMode: "multiply",
    },
  },
  {
    key: "sierra",
    label: "Sierra",
    cssFilter: "sepia(.25) contrast(1.5) brightness(.9) hue-rotate(-15deg)",
    overlay: {
      background: "radial-gradient(circle closest-corner, rgba(128, 78, 15, .5) 0, rgba(0, 0, 0, .65) 100%)",
      mixBlendMode: "screen",
    },
  },
  {
    key: "willow",
    label: "Willow",
    cssFilter: "brightness(1.2) contrast(.85) saturate(.05) sepia(.2)",
  },
  {
    key: "lofi",
    label: "Lo-Fi",
    cssFilter: "saturate(1.1) contrast(1.5)",
  },
  {
    key: "inkwell",
    label: "Inkwell",
    cssFilter: "brightness(1.25) contrast(.85) grayscale(1)",
  },
  {
    key: "hefe",
    label: "Hefe",
    cssFilter: "sepia(.4) contrast(1.5) brightness(1.2) saturate(1.4) hue-rotate(-10deg)",
    overlay: {
      background: "radial-gradient(circle closest-corner, transparent 0, rgba(0, 0, 0, .25) 100%)",
      mixBlendMode: "multiply",
    },
  },
  {
    key: "nashville",
    label: "Nashville",
    cssFilter: "sepia(.25) contrast(1.5) brightness(.9) hue-rotate(-15deg)",
    overlay: {
      background: "radial-gradient(circle closest-corner, rgba(128, 78, 15, .5) 0, rgba(128, 78, 15, .65) 100%)",
      mixBlendMode: "screen",
    },
  },
  {
    key: "stinson",
    label: "Stinson",
    cssFilter: "sepia(.35) contrast(1.25) brightness(1.1) saturate(1.25)",
    overlay: {
      background: "rgba(125, 105, 24, .45)",
      mixBlendMode: "lighten",
    },
  },
  {
    key: "vesper",
    label: "Vesper",
    cssFilter: "sepia(.35) contrast(1.15) brightness(1.2) saturate(1.3)",
    overlay: {
      background: "rgba(125, 105, 24, .25)",
      mixBlendMode: "overlay",
    },
  },
  {
    key: "earlybird",
    label: "Earlybird",
    cssFilter: "sepia(.25) contrast(1.25) brightness(1.15) saturate(.9) hue-rotate(-5deg)",
    overlay: {
      background: "radial-gradient(circle closest-corner, transparent 0, rgba(125, 105, 24, .2) 100%)",
      mixBlendMode: "multiply",
    },
  },
  {
    key: "brannan",
    label: "Brannan",
    cssFilter: "sepia(.4) contrast(1.25) brightness(1.1) saturate(.9) hue-rotate(-2deg)",
  },
  {
    key: "sutro",
    label: "Sutro",
    cssFilter: "sepia(.4) contrast(1.2) brightness(.9) saturate(1.4) hue-rotate(-10deg)",
    overlay: {
      background: "radial-gradient(circle closest-corner, transparent 50%, rgba(0, 0, 0, .5) 90%)",
      mixBlendMode: "darken",
    },
  },
  {
    key: "toaster",
    label: "Toaster",
    cssFilter: "sepia(.25) contrast(1.5) brightness(.95) hue-rotate(-15deg)",
    overlay: {
      background: "radial-gradient(circle, #804e0f, rgba(0, 0, 0, .25))",
      mixBlendMode: "screen",
    },
  },
  {
    key: "walden",
    label: "Walden",
    cssFilter: "sepia(.35) contrast(.8) brightness(1.25) saturate(1.4)",
    overlay: {
      background: "rgba(229, 240, 128, .5)",
      mixBlendMode: "darken",
    },
  },
  {
    key: "1977",
    label: "1977",
    cssFilter: "sepia(.5) hue-rotate(-30deg) saturate(1.4)",
  },
  {
    key: "kelvin",
    label: "Kelvin",
    cssFilter: "sepia(.15) contrast(1.5) brightness(1.1) hue-rotate(-10deg)",
    overlay: {
      background: "radial-gradient(circle closest-corner, rgba(128, 78, 15, .25) 0, rgba(128, 78, 15, .5) 100%)",
      mixBlendMode: "overlay",
    },
  },
  {
    key: "maven",
    label: "Maven",
    cssFilter: "sepia(.35) contrast(1.05) brightness(1.05) saturate(1.75)",
    overlay: {
      background: "rgba(158, 175, 30, .25)",
      mixBlendMode: "darken",
    },
  },
  {
    key: "ginza",
    label: "Ginza",
    cssFilter: "sepia(.25) contrast(1.15) brightness(1.2) saturate(1.35) hue-rotate(-5deg)",
    overlay: {
      background: "rgba(125, 105, 24, .15)",
      mixBlendMode: "darken",
    },
  },
  {
    key: "skyline",
    label: "Skyline",
    cssFilter: "sepia(.15) contrast(1.25) brightness(1.25) saturate(1.2)",
  },
  {
    key: "dogpatch",
    label: "Dogpatch",
    cssFilter: "sepia(.35) saturate(1.1) contrast(1.5)",
  },
  {
    key: "brooklyn",
    label: "Brooklyn",
    cssFilter: "sepia(.25) contrast(1.25) brightness(1.25) hue-rotate(5deg)",
    overlay: {
      background: "rgba(127, 187, 227, .2)",
      mixBlendMode: "overlay",
    },
  },
  {
    key: "helena",
    label: "Helena",
    cssFilter: "sepia(.5) contrast(1.05) brightness(1.05) saturate(1.35)",
    overlay: {
      background: "rgba(158, 175, 30, .25)",
      mixBlendMode: "overlay",
    },
  },
  {
    key: "ashby",
    label: "Ashby",
    cssFilter: "sepia(.5) contrast(1.2) saturate(1.8)",
    overlay: {
      background: "rgba(125, 105, 24, .35)",
      mixBlendMode: "lighten",
    },
  },
  {
    key: "charmes",
    label: "Charmes",
    cssFilter: "sepia(.25) contrast(1.25) brightness(1.25) saturate(1.35) hue-rotate(-5deg)",
    overlay: {
      background: "rgba(125, 105, 24, .25)",
      mixBlendMode: "darken",
    },
  },
] as const;

type InstagramFilter = (typeof INSTAGRAM_FILTERS)[number];
type InstagramFilterKey = InstagramFilter["key"];

function instagramFilterByKey(key: InstagramFilterKey) {
  return (
    INSTAGRAM_FILTERS.find((filter) => filter.key === key) ??
    INSTAGRAM_FILTERS[0]
  );
}

function instagramFilterImageStyle(filter: InstagramFilter): CSSProperties | undefined {
  return filter.cssFilter === "none" ? undefined : { filter: filter.cssFilter };
}

function instagramFilterOverlayStyle(filter: InstagramFilter): CSSProperties | undefined {
  if (!("overlay" in filter)) return undefined;

  return {
    background: filter.overlay.background,
    mixBlendMode: filter.overlay.mixBlendMode,
  };
}

function InstagramFilterOverlay({
  filter,
}: {
  filter: InstagramFilter;
}) {
  const style = instagramFilterOverlayStyle(filter);
  if (!style) return null;

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10"
      style={style}
    />
  );
}

function filteredDownloadFileName(photo: Photo, filter: InstagramFilter) {
  const originalName = photo.fileName?.trim() || `photo-${photo.id}.jpg`;
  const stem = originalName.replace(/\.[^.]+$/, "") || `photo-${photo.id}`;
  return `${stem}-${filter.key}.jpg`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not create filtered image"));
        },
        type,
        quality,
      );
    } catch (error) {
      reject(error);
    }
  });
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image for export"));
    image.src = src;
  });
}

function closestCornerRadius(width: number, height: number) {
  return Math.hypot(width / 2, height / 2);
}

function radialOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stops: Array<[number, string]>,
) {
  const radius = closestCornerRadius(width, height);
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    radius,
  );

  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }

  return gradient;
}

function instagramCanvasOverlayFill(
  ctx: CanvasRenderingContext2D,
  filter: InstagramFilter,
  width: number,
  height: number,
) {
  switch (filter.key) {
    case "earlybird":
      return radialOverlay(ctx, width, height, [
        [0, "rgba(0, 0, 0, 0)"],
        [1, "rgba(125, 105, 24, .2)"],
      ]);
    case "hefe":
      return radialOverlay(ctx, width, height, [
        [0, "rgba(0, 0, 0, 0)"],
        [1, "rgba(0, 0, 0, .25)"],
      ]);
    case "hudson":
      return radialOverlay(ctx, width, height, [
        [0.25, "rgba(0, 0, 0, 0)"],
        [1, "rgba(25, 62, 167, .25)"],
      ]);
    case "kelvin":
      return radialOverlay(ctx, width, height, [
        [0, "rgba(128, 78, 15, .25)"],
        [1, "rgba(128, 78, 15, .5)"],
      ]);
    case "mayfair":
      return radialOverlay(ctx, width, height, [
        [0, "rgba(0, 0, 0, 0)"],
        [1, "rgba(175, 105, 24, .4)"],
      ]);
    case "nashville":
      return radialOverlay(ctx, width, height, [
        [0, "rgba(128, 78, 15, .5)"],
        [1, "rgba(128, 78, 15, .65)"],
      ]);
    case "perpetua": {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "rgba(0, 91, 154, .25)");
      gradient.addColorStop(1, "rgba(230, 193, 61, .25)");
      return gradient;
    }
    case "rise":
      return radialOverlay(ctx, width, height, [
        [0, "rgba(0, 0, 0, 0)"],
        [1, "rgba(230, 193, 61, .25)"],
      ]);
    case "sierra":
      return radialOverlay(ctx, width, height, [
        [0, "rgba(128, 78, 15, .5)"],
        [1, "rgba(0, 0, 0, .65)"],
      ]);
    case "sutro":
      return radialOverlay(ctx, width, height, [
        [0.5, "rgba(0, 0, 0, 0)"],
        [0.9, "rgba(0, 0, 0, .5)"],
      ]);
    case "toaster":
      return radialOverlay(ctx, width, height, [
        [0, "#804e0f"],
        [1, "rgba(0, 0, 0, .25)"],
      ]);
    case "xpro2":
      return radialOverlay(ctx, width, height, [
        [0, "rgba(0, 91, 154, .35)"],
        [1, "rgba(0, 0, 0, .65)"],
      ]);
    default:
      if (!("overlay" in filter)) return null;
      return filter.overlay.background;
  }
}

function drawInstagramCanvasOverlay(
  ctx: CanvasRenderingContext2D,
  filter: InstagramFilter,
  width: number,
  height: number,
) {
  if (!("overlay" in filter)) return;

  const fillStyle = instagramCanvasOverlayFill(ctx, filter, width, height);
  if (!fillStyle) return;

  ctx.save();
  ctx.globalCompositeOperation =
    filter.overlay.mixBlendMode as GlobalCompositeOperation;
  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

async function downloadFilteredImage(
  sourceUrl: string,
  filter: InstagramFilter,
  fileName: string,
) {
  const image = await loadCanvasImage(sourceUrl);
  const width = image.naturalWidth;
  const height = image.naturalHeight;

  if (!width || !height) {
    throw new Error("Image dimensions are unavailable");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  ctx.filter = filter.cssFilter;
  ctx.drawImage(image, 0, 0, width, height);
  ctx.filter = "none";
  drawInstagramCanvasOverlay(ctx, filter, width, height);

  const blob = await canvasToBlob(canvas, "image/jpeg", 0.95);
  const objectUrl = URL.createObjectURL(blob);

  try {
    triggerDownload(objectUrl, fileName);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

function absoluteBrowserUrl(url: string) {
  if (typeof window === "undefined") return url;
  return url.startsWith("/") ? `${window.location.origin}${url}` : url;
}

interface PhotoCardProps {
  albumSlug: string;
  shareToken?: string;
  photo: Photo;
  index: number;
  onOpen: (index: number, originRect: PhotoOpenRect) => void;
  cornerRadius?: number;
  forceFill?: boolean;
  forceMobileSquare?: boolean;
  imageFit?: "contain" | "cover";
  shareSettings?: AlbumShareSettings | null;
  debugScroll?: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (photoId: string) => void;
}

export interface PhotoOpenRect {
  top: number;
  left: number;
  width: number;
  height: number;
  imageUrl?: string;
}

function drawImageToRect(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  fit: "cover" | "contain",
) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const rectRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;

  if (fit === "cover") {
    if (imageRatio > rectRatio) drawHeight = height;
    else drawWidth = width;
    if (imageRatio > rectRatio) drawWidth = height * imageRatio;
    else drawHeight = width / imageRatio;
  } else {
    if (imageRatio > rectRatio) {
      drawWidth = width;
      drawHeight = width / imageRatio;
    } else {
      drawHeight = height;
      drawWidth = height * imageRatio;
    }
  }

  ctx.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  settings: AlbumShareSettings,
  width: number,
  height: number,
) {
  if (!settings.watermarkText) return;

  const text = settings.watermarkText.toUpperCase();
  const fontSize = Math.max(13, Math.round(Math.min(width, height) * 0.035));

  ctx.save();
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = Math.max(2, fontSize * 0.12);

  if (settings.watermarkMode === "full") {
    const stepX = Math.max(180, ctx.measureText(text).width + 70);
    const stepY = Math.max(90, fontSize * 4.8);

    ctx.translate(width / 2, height / 2);
    ctx.rotate((-24 * Math.PI) / 180);
    ctx.translate(-width / 2, -height / 2);

    for (let y = -height; y < height * 2; y += stepY) {
      for (let x = -width; x < width * 2; x += stepX) {
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
      }
    }

    ctx.restore();
    return;
  }

  const padding = Math.max(14, Math.round(Math.min(width, height) * 0.035));
  const positions = settings.watermarkPositions.length
    ? settings.watermarkPositions
    : ["bottom_right"];

  for (const position of positions) {
    let x = padding;
    let y = padding + fontSize / 2;
    ctx.textAlign = "left";

    if (position.endsWith("right")) {
      x = width - padding;
      ctx.textAlign = "right";
    }

    if (position.startsWith("bottom")) {
      y = height - padding - fontSize / 2;
    }

    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  ctx.restore();
}

type WatermarkedImageProps = {
  src: string;
  alt: string;
  className?: string;
  fit?: "cover" | "contain";
  settings?: AlbumShareSettings | null;
  loading?: "eager" | "lazy";
  decoding?: "async" | "auto" | "sync";
  fetchPriority?: "high" | "low" | "auto";
  draggable?: boolean;
  onLoad?: () => void;
  style?: CSSProperties;
};

function WatermarkedImage({
  src,
  alt,
  className,
  fit = "cover",
  settings,
  loading,
  decoding,
  fetchPriority,
  draggable,
  onLoad,
  style,
}: WatermarkedImageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasLoadedRef = useRef(false);
  const [fallback, setFallback] = useState(false);
  const watermarkEnabled = Boolean(settings?.watermarkEnabled && settings.watermarkText);

  useEffect(() => {
    hasLoadedRef.current = false;
    setFallback(false);
  }, [src]);

  useEffect(() => {
    if (!watermarkEnabled || !settings) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let isCancelled = false;
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.decoding = decoding ?? "async";

    const draw = () => {
      if (isCancelled) return;
      if (!image.complete || !image.naturalWidth || !image.naturalHeight) return;

      const rect = canvas.getBoundingClientRect();
      const cssWidth = Math.max(1, rect.width);
      const cssHeight = Math.max(1, rect.height);
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssWidth * ratio);
      canvas.height = Math.round(cssHeight * ratio);
      canvas.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      drawImageToRect(ctx, image, cssWidth, cssHeight, fit);
      drawWatermark(ctx, settings, cssWidth, cssHeight);

      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        onLoad?.();
      }
    };

    image.onload = draw;
    image.onerror = () => {
      setFallback(true);
    };
    image.src = src;

    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);

    return () => {
      isCancelled = true;
      resizeObserver.disconnect();
    };
  }, [
    decoding,
    fit,
    onLoad,
    settings,
    src,
    watermarkEnabled,
  ]);

  if (!watermarkEnabled || fallback) {
    return (
      <RetryingImage
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        draggable={draggable}
        onLoad={onLoad}
        style={style}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label={alt}
      role="img"
      className={className}
      draggable={draggable}
      style={style}
    />
  );
}

function FadingWatermarkedImage({
  className,
  src,
  onLoad,
  ...props
}: WatermarkedImageProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(false);
  }, [src]);

  const handleLoad = useCallback(() => {
    onLoad?.();

    window.requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, [onLoad]);

  return (
    <WatermarkedImage
      {...props}
      src={src}
      onLoad={handleLoad}
      className={`${className ?? ""} transition-opacity duration-500 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}

export const PhotoCard = memo(function PhotoCard({
  albumSlug,
  shareToken = "",
  photo,
  index,
  onOpen,
  cornerRadius,
  forceFill = false,
  forceMobileSquare = false,
  imageFit = "contain",
  shareSettings,
  debugScroll = false,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: PhotoCardProps) {
  const signedUrlCacheKey = signedPhotoUrlCacheKey(
    albumSlug,
    shareToken,
    photo.id,
  );
  const [signedPreviewUrls, setSignedPreviewUrls] =
    useState<SignedPhotoUrls | null>(
      () => signedPhotoUrlCache.get(signedUrlCacheKey) ?? null,
    );
  const [hasFetchedSignedPreviewUrls, setHasFetchedSignedPreviewUrls] =
    useState(() => signedPhotoUrlCache.has(signedUrlCacheKey));
  const isShareView = Boolean(shareToken);
  const imageCandidates = useMemo(
    () =>
      uniqueUrls([
        ...previewUrlsForPhoto(photo, {
          includeCloudFront: false,
          includeMediaFallback: true,
          preferMediaFallback: true,
          shareToken,
        }),
        ...(isShareView
          ? []
          : [signedPreviewUrls?.previewUrl, signedPreviewUrls?.thumbnailUrl]),
      ]),
    [isShareView, photo, shareToken, signedPreviewUrls],
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const imageUrl = imageCandidates[activeImageIndex] ?? null;
  const aspectRatio = photoAspectRatio(photo);
  const imageFitClass = imageFit === "cover" ? "object-cover" : "object-contain";
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoadImage, setShouldLoadImage] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadHovering, setIsDownloadHovering] = useState(false);
  const canDownload = isShareView
    ? Boolean(shareSettings?.allowDownloads)
    : shareSettings?.allowDownloads ?? true;

  useEffect(() => {
    setShouldLoadImage(false);
    setSignedPreviewUrls(signedPhotoUrlCache.get(signedUrlCacheKey) ?? null);
    setHasFetchedSignedPreviewUrls(signedPhotoUrlCache.has(signedUrlCacheKey));
    setIsImageLoaded(false);
    setActiveImageIndex(0);
  }, [photo.id, signedUrlCacheKey]);

  useEffect(() => {
    setIsImageLoaded(false);
  }, [imageUrl]);

  const handleImageLoad = useCallback(() => {
    setIsImageLoaded(true);
  }, []);

  useEffect(() => {
    if (shouldLoadImage) return;
    const card = cardRef.current;
    if (!card) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          if (debugScroll) {
            console.log("[photos-scroll-debug] photo-card entered view", {
              photoId: photo.id,
              index,
            });
          }
          setShouldLoadImage(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px", threshold: 0.01 },
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, [debugScroll, index, photo.id, shouldLoadImage]);

  useEffect(() => {
    if (!shouldLoadImage || hasFetchedSignedPreviewUrls || isShareView) return;

    let isCancelled = false;

    if (debugScroll) {
      console.log("[photos-scroll-debug] photo-card signing URLs", {
        photoId: photo.id,
        index,
      });
    }

    fetchSignedPhotoUrls(albumSlug, [photo.id], shareToken)
      .then((urls) => {
        if (isCancelled) return;

        const signedUrls = urls[photo.id] ?? null;
        signedPhotoUrlCache.set(signedUrlCacheKey, signedUrls);
        setSignedPreviewUrls(signedUrls);
        setActiveImageIndex(0);

        if (debugScroll) {
          console.log("[photos-scroll-debug] photo-card signed URLs loaded", {
            photoId: photo.id,
            index,
            hasPreviewUrl: Boolean(signedUrls?.previewUrl),
            hasThumbnailUrl: Boolean(signedUrls?.thumbnailUrl),
          });
        }
      })
      .catch((error) => {
        if (debugScroll) {
          console.error("[photos-scroll-debug] photo-card signed URLs failed", {
            photoId: photo.id,
            index,
            error,
          });
        }
      })
      .finally(() => {
        if (!isCancelled) setHasFetchedSignedPreviewUrls(true);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    albumSlug,
    debugScroll,
    hasFetchedSignedPreviewUrls,
    index,
    isShareView,
    photo.id,
    shareToken,
    shouldLoadImage,
    signedUrlCacheKey,
  ]);

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      let downloadUrl = photo.downloadUrl;

      if (!downloadUrl) {
        const signedUrls = await fetchSignedPhotoUrls(albumSlug, [photo.id], shareToken);
        downloadUrl = signedUrls?.[photo.id]?.downloadUrl;
      }

      if (!downloadUrl) return;

      triggerDownload(downloadUrl, photo.fileName || `photo-${photo.id}.jpg`);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    const url = imageUrl || photo.downloadUrl;
    if (!url) return;

    const shareUrl = absoluteBrowserUrl(url);

    if (navigator.share) {
      try {
        await navigator.share({
          title: photo.fileName || photo.caption || "Photo",
          url: shareUrl,
        });
      } catch {
        // Ignore cancelled shares.
      }

      return;
    }

    await navigator.clipboard?.writeText(shareUrl);
  };

  const cardStyle = forceFill
    ? cornerRadius !== undefined
      ? { borderRadius: cornerRadius }
      : undefined
    : forceMobileSquare
      ? ({
          "--photo-card-aspect-ratio": aspectRatio,
          ...(cornerRadius !== undefined ? { borderRadius: cornerRadius } : {}),
        } as CSSProperties)
      : {
          aspectRatio,
          ...(cornerRadius !== undefined ? { borderRadius: cornerRadius } : {}),
        };

  return (
    <div
      ref={cardRef}
      className={`group relative w-full overflow-hidden rounded-md bg-muted text-left shadow-sm ring-1 transition-shadow duration-200 hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background ${
        isSelectionMode && isSelected
          ? "ring-2 ring-zinc-950"
          : "ring-border"
      } ${forceFill ? "h-full" : ""} ${
        forceMobileSquare && !forceFill
          ? "aspect-square sm:[aspect-ratio:var(--photo-card-aspect-ratio)]"
          : ""
      }`}
      style={cardStyle}
    >
      <button
        type="button"
        data-click-loading-skip="true"
        onClick={(event) => {
          if (isSelectionMode) {
            onToggleSelect?.(photo.id);
            return;
          }

          const rect = event.currentTarget.getBoundingClientRect();

          onOpen(index, {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            imageUrl: imageUrl ?? undefined,
          });
        }}
        aria-pressed={isSelectionMode ? isSelected : undefined}
        className="absolute inset-0 cursor-pointer focus:outline-none"
        aria-label={
          isSelectionMode
            ? isSelected
              ? "Deselect photo"
              : "Select photo"
            : photo.caption
              ? `Open ${photo.caption}`
              : "Open photo"
        }
      >
        {imageUrl && shouldLoadImage ? (
          <WatermarkedImage
            src={imageUrl}
            alt={photo.caption || "Photo"}
            className={`absolute inset-0 h-full w-full ${imageFitClass} transition-opacity duration-300 ${
              isImageLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading="lazy"
            decoding="async"
            fetchPriority={index < 4 ? "high" : "auto"}
            settings={shareSettings}
            fit={imageFit}
            onLoad={handleImageLoad}
          />
        ) : !shouldLoadImage || !hasFetchedSignedPreviewUrls ? (
          <Skeleton className="absolute inset-0 rounded-md bg-zinc-200/80" />
        ) : imageUrl ? (
          <Skeleton className="absolute inset-0 rounded-md bg-zinc-200/80" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary">
            <span className="text-sm text-muted-foreground">No preview</span>
          </div>
        )}

        {imageUrl && shouldLoadImage && !isImageLoaded && (
          <Skeleton className="absolute inset-0 rounded-md bg-zinc-200/80" />
        )}
      </button>

      <div
        className={`pointer-events-none absolute inset-0 z-10 bg-black/55 transition-opacity duration-200 ${
          isDownloadHovering ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-black/80 via-black/35 to-transparent transition-opacity duration-200 ${
          isDownloadHovering
            ? "opacity-0"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        }`}
      />

      {isSelectionMode && (
        <span
          className={`pointer-events-none absolute right-2 top-2 z-40 flex h-7 w-7 items-center justify-center rounded-full shadow-sm ${
            isSelected ? "bg-zinc-950 text-white" : "bg-white/90 text-zinc-400"
          }`}
        >
          <Check className="h-4 w-4" />
        </span>
      )}

      {!isSelectionMode && (
        <div className="pointer-events-none absolute bottom-2 left-2 z-40 flex items-center gap-1 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 sm:bottom-3 sm:left-3">
          <button
            type="button"
            className="pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white drop-shadow-md transition hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-white/80 sm:h-7 sm:w-7"
            aria-label="Favorite photo"
          >
            <Heart className="h-4 w-4" strokeWidth={1.5} />
          </button>

          <a
            href={`mailto:?subject=Photo&body=${encodeURIComponent(
              imageUrl ? absoluteBrowserUrl(imageUrl) : "",
            )}`}
            className="pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white drop-shadow-md transition hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-white/80 sm:h-7 sm:w-7"
            aria-label="Email photo"
            onClick={(event) => event.stopPropagation()}
          >
            <Mail className="h-4 w-4" strokeWidth={1.5} />
          </a>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleShare();
            }}
            className="pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white drop-shadow-md transition hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-white/80 sm:h-7 sm:w-7"
            aria-label="Share photo"
          >
            <Share2 className="h-4 w-4" strokeWidth={1.5} />
          </button>

          {canDownload && (
            <button
              type="button"
              onMouseEnter={() => setIsDownloadHovering(true)}
              onMouseLeave={() => setIsDownloadHovering(false)}
              onFocus={() => setIsDownloadHovering(true)}
              onBlur={() => setIsDownloadHovering(false)}
              onClick={(event) => {
                event.stopPropagation();
                handleDownload();
              }}
              disabled={isDownloading}
              className="pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white drop-shadow-md transition hover:bg-white/15 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/80 disabled:cursor-not-allowed disabled:opacity-45 sm:h-7 sm:w-7"
              aria-label="Download photo"
            >
              <Download className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

    </div>
  );
});

interface PhotoLightboxProps {
  albumSlug: string;
  shareToken?: string;
  photos: Photo[];
  currentIndex: number;
  events?: AlbumEvent[];
  allPeople?: Person[];
  canManagePeople?: boolean;
  originRect?: PhotoOpenRect;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onPersonClick?: (person: PhotoPerson) => void;
  onPeopleChanged?: () => void | Promise<void>;
  shareSettings?: AlbumShareSettings | null;
  hidePeople?: boolean;
}

export function PhotoLightbox({
  albumSlug,
  shareToken = "",
  photos,
  currentIndex,
  events,
  allPeople = [],
  canManagePeople = false,
  originRect,
  onClose,
  onNavigate,
  onPersonClick,
  onPeopleChanged,
  shareSettings,
  hidePeople = false,
}: PhotoLightboxProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPeopleOpen, setIsPeopleOpen] = useState(false);
  const [isAiEditOpen, setIsAiEditOpen] = useState(false);
  const [isPresetPanelOpen, setIsPresetPanelOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedInstagramFilterKey, setSelectedInstagramFilterKey] =
    useState<InstagramFilterKey>("normal");
  const [filterDownloadError, setFilterDownloadError] = useState("");
  const [selectedAiPreset, setSelectedAiPreset] = useState("");
  const [aiEditPrompt, setAiEditPrompt] = useState("");
  const [isSubmittingAiEdit, setIsSubmittingAiEdit] = useState(false);
  const [aiEditError, setAiEditError] = useState("");
  const [aiEditResult, setAiEditResult] = useState<{
    id?: string | null;
    editedUrl?: string | null;
    editedS3Key?: string | null;
    taskId?: string | null;
    status?: string;
  } | null>(null);
  const [isAddingAiEditToAlbum, setIsAddingAiEditToAlbum] = useState(false);
  const [aiEditAddStatus, setAiEditAddStatus] = useState("");
  const [areControlsVisible, setAreControlsVisible] = useState(false);
  const [areControlsReady, setAreControlsReady] = useState(false);
  const [isBackdropVisible, setIsBackdropVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isMobilePointer, setIsMobilePointer] = useState(false);
  const [isDownloadHovering, setIsDownloadHovering] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [entryStyle, setEntryStyle] = useState<CSSProperties>({
    opacity: 0,
    transform: "translate3d(0, 10px, 0) scale(0.985)",
    transformOrigin: "center center",
  });
  const [signedUrlsByPhotoId, setSignedUrlsByPhotoId] = useState<
    Record<string, SignedPhotoUrls>
  >({});
  const [loadedOriginalUrlsByPhotoId, setLoadedOriginalUrlsByPhotoId] =
    useState<Record<string, string>>({});
  const [failedOriginalUrlsByPhotoId, setFailedOriginalUrlsByPhotoId] =
    useState<Record<string, string>>({});
  const [personNameOverrides, setPersonNameOverrides] = useState<
    Record<string, string>
  >({});
  const [editingPersonId, setEditingPersonId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [isRenamingPerson, setIsRenamingPerson] = useState(false);
  const [renameError, setRenameError] = useState("");
  const [mergeTargetPerson, setMergeTargetPerson] =
    useState<PhotoPerson | null>(null);
  const [selectedMergePersonIds, setSelectedMergePersonIds] = useState<string[]>(
    [],
  );
  const [mergeQuery, setMergeQuery] = useState("");
  const [isMergingPeople, setIsMergingPeople] = useState(false);
  const [mergeError, setMergeError] = useState("");

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingSwipe, setIsAnimatingSwipe] = useState(false);
  const [swipeAnimationDurationMs, setSwipeAnimationDurationMs] = useState(
    DEFAULT_SWIPE_ANIMATION_MS,
  );

  const photoFrameRef = useRef<HTMLDivElement>(null);
  const touchSurfaceRef = useRef<HTMLDivElement>(null);
  const aiEditScrollRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef(0);
  const touchStartRef = useRef<{
    x: number;
    y: number;
    time: number;
  } | null>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const swipeCommitTimerRef = useRef<number | null>(null);
  const isMobilePointerRef = useRef(isMobilePointer);
  const isPeopleOpenRef = useRef(isPeopleOpen);
  const isFilterPanelOpenRef = useRef(isFilterPanelOpen);
  const isDownloadHoveringRef = useRef(isDownloadHovering);
  const isAnimatingSwipeRef = useRef(isAnimatingSwipe);
  const isMountedRef = useRef(false);
  const hasPlayedEntryAnimationRef = useRef(false);
  const originalPreloadRef = useRef(new Map<string, string>());
  const preloadedPreviewUrlsRef = useRef(new Set<string>());
  const { mutate } = useSWRConfig();

  const photo = photos[currentIndex];

  const previousIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
  const nextIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;

  const previousPhoto = photos[previousIndex];
  const nextPhoto = photos[nextIndex];
  const preloadPhotos = useMemo(
    () =>
      lightboxPreloadIndices(currentIndex, photos.length)
        .map((index) => photos[index])
        .filter((item): item is Photo => Boolean(item)),
    [currentIndex, photos],
  );
  const preloadPhotoIds = useMemo(
    () => Array.from(new Set(preloadPhotos.map((item) => item.id))),
    [preloadPhotos],
  );

  const signedCurrentUrls = signedUrlsByPhotoId[photo.id];
  const previewImageCandidates = uniqueUrls([
    originRect?.imageUrl,
    ...previewUrlsForPhoto(photo, {
      includeCloudFront: false,
      preferMediaFallback: true,
      shareToken,
    }),
    ...(shareToken
      ? []
      : [signedCurrentUrls?.previewUrl, signedCurrentUrls?.thumbnailUrl]),
  ]);
  const imageUrl = previewImageCandidates[activeImageIndex] ?? null;
  const originalImageUrl = loadedOriginalUrlsByPhotoId[photo.id] ?? null;
  const upgradedImageUrl =
    originalImageUrl && originalImageUrl !== imageUrl ? originalImageUrl : null;
  const currentDisplayBaseUrl = imageUrl ?? upgradedImageUrl;
  const instagramFilterPreviewUrl = upgradedImageUrl || currentDisplayBaseUrl;
  const downloadUrl = signedUrlsByPhotoId[photo.id]?.downloadUrl ?? photo.downloadUrl;
  const isShareView = Boolean(shareToken);
  const canDownload = isShareView
    ? Boolean(shareSettings?.allowDownloads)
    : shareSettings?.allowDownloads ?? true;
  const canApplyPreset = !isShareView && !shareSettings;
  const canEditPhoto = true;
  const photoName = photo.fileName || `Photo ${currentIndex + 1}`;
  const allPeopleById = useMemo(
    () => new Map(allPeople.map((person) => [person.id, person])),
    [allPeople],
  );
  const photoPeople = useMemo(
    () =>
      (photo.people ?? []).map((person) => ({
        ...person,
        coverFaceUrl: imageUrlWithShare(
          person.coverFaceUrl ?? allPeopleById.get(person.id)?.coverFaceUrl,
          shareToken,
        ),
      })),
    [allPeopleById, photo.people, shareToken],
  );
  const canManageLightboxPeople = canManagePeople && !shareToken;
  const selectedInstagramFilter = useMemo(
    () => instagramFilterByKey(selectedInstagramFilterKey),
    [selectedInstagramFilterKey],
  );
  const selectedInstagramFilterImageStyle =
    instagramFilterImageStyle(selectedInstagramFilter);
  const hasAppliedInstagramFilter = selectedInstagramFilter.key !== "normal";
  const getPersonDisplayName = useCallback(
    (person: Person | PhotoPerson) =>
      personNameOverrides[person.id] || person.displayName || person.defaultName,
    [personNameOverrides],
  );
  const mergeCandidatePeople = useMemo(() => {
    if (!mergeTargetPerson) return [];

    const normalizedQuery = mergeQuery.trim().toLowerCase();

    return allPeople
      .filter((person) => person.id !== mergeTargetPerson.id)
      .filter((person) => {
        if (!normalizedQuery) return true;

        const name = `${getPersonDisplayName(person)} ${person.defaultName} Person ${
          person.personNumber
        }`.toLowerCase();

        return name.includes(normalizedQuery);
      });
  }, [allPeople, getPersonDisplayName, mergeQuery, mergeTargetPerson]);
  const selectedMergePeople = useMemo(() => {
    const selectedIds = new Set(selectedMergePersonIds);
    return allPeople.filter((person) => selectedIds.has(person.id));
  }, [allPeople, selectedMergePersonIds]);
  const aiEditDownloadName = `${(photo.fileName || `photo-${photo.id}`).replace(
    /\.[^.]+$/,
    "",
  )}-ai-edit.png`;
  const eventOptions = useMemo(() => {
    const byId = new Map<string, AlbumEvent>();

    for (const event of events ?? []) {
      byId.set(event.id, event);
    }

    for (const item of photos) {
      if (byId.has(item.eventId)) continue;

      byId.set(item.eventId, {
        id: item.eventId,
        slug: item.eventSlug,
        name: item.eventName,
        sortOrder: byId.size,
        photoSortMode: "added_oldest",
        photoCount: 0,
        peopleCount: 0,
      });
    }

    return Array.from(byId.values());
  }, [events, photos]);

  const getPreviewUrl = useCallback((targetPhoto: Photo | undefined) => {
    if (!targetPhoto) return null;
    return (
      previewUrlsForPhoto(targetPhoto, {
        includeCloudFront: false,
        preferMediaFallback: true,
        shareToken,
      })[0] ?? null
    );
  }, [shareToken]);

  const getLightboxUrl = useCallback(
    (targetPhoto: Photo | undefined) => {
      if (!targetPhoto) return null;
      return loadedOriginalUrlsByPhotoId[targetPhoto.id] || getPreviewUrl(targetPhoto);
    },
    [getPreviewUrl, loadedOriginalUrlsByPhotoId],
  );

  const previousImageUrl = useMemo(
    () => getLightboxUrl(previousPhoto),
    [getLightboxUrl, previousPhoto],
  );

  const currentImageUrl = imageUrl;

  const nextImageUrl = useMemo(
    () => getLightboxUrl(nextPhoto),
    [getLightboxUrl, nextPhoto],
  );

  isMobilePointerRef.current = isMobilePointer;
  isPeopleOpenRef.current = isPeopleOpen;
  isFilterPanelOpenRef.current = isFilterPanelOpen;
  isDownloadHoveringRef.current = isDownloadHovering;
  isAnimatingSwipeRef.current = isAnimatingSwipe;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const missingPhotoIds = preloadPhotoIds.filter((id) => {
      const urls = signedUrlsByPhotoId[id];
      return urls?.originalUrl === undefined || urls?.downloadUrl === undefined;
    });

    if (!missingPhotoIds.length) return;

    let isCancelled = false;

    fetchSignedPhotoUrls(albumSlug, missingPhotoIds, shareToken)
      .then((urls) => {
        if (isCancelled || !Object.keys(urls).length) return;

        setSignedUrlsByPhotoId((current) => ({
          ...current,
          ...urls,
        }));
      })
      .catch((error) => {
        console.error("Failed to preload original photo URLs:", error);
      });

    return () => {
      isCancelled = true;
    };
  }, [albumSlug, preloadPhotoIds, shareToken, signedUrlsByPhotoId]);

  useEffect(() => {
    for (const targetPhoto of preloadPhotos) {
      const signedUrls = signedUrlsByPhotoId[targetPhoto.id];
      const previewUrls = uniqueUrls([
        ...(shareToken ? [] : [signedUrls?.previewUrl, signedUrls?.thumbnailUrl]),
        ...previewUrlsForPhoto(targetPhoto, {
          includeCloudFront: false,
          preferMediaFallback: true,
          shareToken,
        }),
      ]);

      for (const previewUrl of previewUrls) {
        if (preloadedPreviewUrlsRef.current.has(previewUrl)) continue;

        preloadedPreviewUrlsRef.current.add(previewUrl);
        const image = new window.Image();
        image.decoding = "async";
        image.src = previewUrl;
      }
    }
  }, [preloadPhotos, shareToken, signedUrlsByPhotoId]);

  useEffect(() => {
    for (const targetPhoto of preloadPhotos) {
      const photoId = targetPhoto.id;
      if (loadedOriginalUrlsByPhotoId[photoId]) continue;

      const originalUrl = uniqueUrls([
        mediaUrlForS3KeyWithShare(targetPhoto?.originalS3Key, shareToken),
        shareToken ? null : signedUrlsByPhotoId[photoId]?.originalUrl,
        shareToken ? null : cloudFrontImageUrl(targetPhoto?.originalS3Key),
      ]).find((url) => {
        if (failedOriginalUrlsByPhotoId[photoId] === url) return false;
        return originalPreloadRef.current.get(photoId) !== url;
      });

      if (!originalUrl) continue;

      originalPreloadRef.current.set(photoId, originalUrl);

      const image = new window.Image();
      image.decoding = "async";
      image.onload = () => {
        if (!isMountedRef.current) return;

        setLoadedOriginalUrlsByPhotoId((current) => ({
          ...current,
          [photoId]: originalUrl,
        }));
      };
      image.onerror = () => {
        if (!isMountedRef.current) return;

        setFailedOriginalUrlsByPhotoId((current) => ({
          ...current,
          [photoId]: originalUrl,
        }));
      };
      image.src = originalUrl;
    }
  }, [
    failedOriginalUrlsByPhotoId,
    loadedOriginalUrlsByPhotoId,
    preloadPhotos,
    shareToken,
    signedUrlsByPhotoId,
  ]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: coarse)");

    const updatePointerMode = () => {
      const isMobile = mediaQuery.matches;
      setIsMobilePointer(isMobile);

      if (isMobile) {
        setAreControlsVisible(true);
      }
    };

    updatePointerMode();

    mediaQuery.addEventListener("change", updatePointerMode);
    return () => mediaQuery.removeEventListener("change", updatePointerMode);
  }, []);

  useEffect(() => {
    setSelectedAiPreset("");
    setAiEditPrompt("");
    setAiEditError("");
    setAiEditResult(null);
    setAiEditAddStatus("");
    setEditingPersonId("");
    setRenameDraft("");
    setRenameError("");
    setMergeTargetPerson(null);
    setSelectedMergePersonIds([]);
    setMergeQuery("");
    setMergeError("");
    setIsFilterPanelOpen(false);
    setSelectedInstagramFilterKey("normal");
    setFilterDownloadError("");
  }, [photo.id]);

  const startControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }

    controlsTimerRef.current = window.setTimeout(() => {
      controlsTimerRef.current = null;

      if (isMobilePointerRef.current) return;

      if (
        !isPeopleOpenRef.current &&
        !isFilterPanelOpenRef.current &&
        !isDownloadHoveringRef.current
      ) {
        setAreControlsVisible(false);
      }
    }, 2000);
  }, []);

  const showControlsBriefly = useCallback(() => {
    setAreControlsVisible(true);
    startControlsTimer();
  }, [startControlsTimer]);

  const navigateToIndex = useCallback(
    (index: number) => {
      showControlsBriefly();
      setIsPeopleOpen(false);
      setIsFilterPanelOpen(false);
      setIsDownloadHovering(false);
      onNavigate(index);
    },
    [onNavigate, showControlsBriefly],
  );

  const handlePrev = useCallback(() => {
    navigateToIndex(previousIndex);
  }, [navigateToIndex, previousIndex]);

  const handleNext = useCallback(() => {
    navigateToIndex(nextIndex);
  }, [navigateToIndex, nextIndex]);

  useEffect(() => {
    setAreControlsReady(false);
    const controlsTimer = window.setTimeout(() => {
      setAreControlsReady(true);
      if (isMobilePointerRef.current) setAreControlsVisible(true);
      else showControlsBriefly();
    }, 320);

    return () => {
      window.clearTimeout(controlsTimer);
    };
  }, [showControlsBriefly]);

  useEffect(() => {
    setActiveImageIndex(0);
    setIsPeopleOpen(false);
    setIsAiEditOpen(false);
    setIsPresetPanelOpen(false);
    setIsFilterPanelOpen(false);
    setSelectedInstagramFilterKey("normal");
    setFilterDownloadError("");
    setSelectedAiPreset("");
    setAiEditPrompt("");
    setAiEditError("");
    setAiEditResult(null);
    setIsDownloadHovering(false);
    dragOffsetRef.current = 0;
    setDragOffset(0);
    setIsDragging(false);
    setIsAnimatingSwipe(false);
    setSwipeAnimationDurationMs(DEFAULT_SWIPE_ANIMATION_MS);

    if (isMobilePointer && areControlsReady) {
      setAreControlsVisible(true);
    }
  }, [areControlsReady, photo.id, isMobilePointer]);

  useEffect(() => {
    return () => {
      if (swipeCommitTimerRef.current) {
        window.clearTimeout(swipeCommitTimerRef.current);
      }

      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const scrollY = window.scrollY;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useLayoutEffect(() => {
    const frame = photoFrameRef.current;
    const visibleEntryStyle: CSSProperties = {
      opacity: 1,
      transform: "translate3d(0, 0, 0) scale(1)",
      transformOrigin: "center center",
    };
    const revealFrame = () => {
      const animationFrame = window.requestAnimationFrame(() => {
        setIsBackdropVisible(true);
        hasPlayedEntryAnimationRef.current = true;
        setEntryStyle(visibleEntryStyle);
      });

      return () => window.cancelAnimationFrame(animationFrame);
    };

    if (hasPlayedEntryAnimationRef.current) {
      setEntryStyle(visibleEntryStyle);
      return;
    }

    if (!frame || !originRect) {
      setEntryStyle({
        opacity: 0,
        transform: "translate3d(0, 10px, 0) scale(0.985)",
        transformOrigin: "center center",
      });
      return revealFrame();
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      return revealFrame();
    }

    const targetRect = frame.getBoundingClientRect();
    if (!targetRect.width || !targetRect.height) {
      return revealFrame();
    }

    const originCenterX = originRect.left + originRect.width / 2;
    const originCenterY = originRect.top + originRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    const translateX = originCenterX - targetCenterX;
    const translateY = originCenterY - targetCenterY;
    const scale = originRect.width / targetRect.width;

    setEntryStyle({
      opacity: 0,
      transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
      transformOrigin: "center center",
    });

    return revealFrame();
  }, [originRect]);

  useEffect(() => {
    const touchSurface = touchSurfaceRef.current;
    if (!touchSurface) return;

    const handleNativeTouchMove = (event: globalThis.TouchEvent) => {
      const start = touchStartRef.current;
      if (!start || isAnimatingSwipeRef.current) {
        return;
      }

      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      if (Math.abs(deltaY) > Math.abs(deltaX) * 1.25) return;

      event.preventDefault();
    };

    touchSurface.addEventListener("touchmove", handleNativeTouchMove, {
      passive: false,
    });

    return () => {
      touchSurface.removeEventListener("touchmove", handleNativeTouchMove);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying || photos.length <= 1) return;

    const interval = window.setInterval(() => {
      showControlsBriefly();
      onNavigate(currentIndex < photos.length - 1 ? currentIndex + 1 : 0);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [currentIndex, isPlaying, onNavigate, photos.length, showControlsBriefly]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        handlePrev();
      }

      if (event.key === "ArrowRight") {
        handleNext();
      }

      if (event.key === "Escape") {
        if (isPresetPanelOpen) setIsPresetPanelOpen(false);
        else if (isFilterPanelOpen) setIsFilterPanelOpen(false);
        else if (isAiEditOpen) setIsAiEditOpen(false);
        else closeWithAnimation();
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [
    closeWithAnimation,
    handlePrev,
    handleNext,
    isAiEditOpen,
    isFilterPanelOpen,
    isPresetPanelOpen,
  ]);

  const resolveOriginalDownloadUrl = async () => {
    let url = downloadUrl;

    if (!url) {
      const urlsById = await fetchSignedPhotoUrls(albumSlug, [photo.id], shareToken);
      const urls = urlsById[photo.id];
      if (urls) {
        setSignedUrlsByPhotoId((current) => ({
          ...current,
          [photo.id]: urls,
        }));
      }
      url = urls?.downloadUrl;
    }

    return url ?? null;
  };

  const downloadOriginalPhoto = async () => {
    const url = await resolveOriginalDownloadUrl();
    if (!url) throw new Error("No downloadable original photo was found.");

    triggerDownload(url, photo.fileName || `photo-${photo.id}.jpg`);
  };

  const downloadInstagramFilteredPhoto = async () => {
    let fetchedUrls: SignedPhotoUrls | undefined;

    if (!signedCurrentUrls?.originalUrl && !downloadUrl) {
      const urlsById = await fetchSignedPhotoUrls(albumSlug, [photo.id], shareToken);
      const nextFetchedUrls = urlsById[photo.id];
      if (nextFetchedUrls) {
        fetchedUrls = nextFetchedUrls;
        setSignedUrlsByPhotoId((current) => ({
          ...current,
          [photo.id]: nextFetchedUrls,
        }));
      }
    }

    const sourceCandidates = uniqueUrls([
      mediaUrlForS3KeyWithShare(photo.originalS3Key, shareToken),
      signedCurrentUrls?.originalUrl,
      fetchedUrls?.originalUrl,
      originalImageUrl,
      downloadUrl,
      fetchedUrls?.downloadUrl,
      currentImageUrl,
    ]);

    if (!sourceCandidates.length) {
      throw new Error("No image source was found for filtered export.");
    }

    let lastError: unknown = null;

    for (const sourceUrl of sourceCandidates) {
      try {
        await downloadFilteredImage(
          sourceUrl,
          selectedInstagramFilter,
          filteredDownloadFileName(photo, selectedInstagramFilter),
        );
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Could not export the filtered photo.");
  };

  const handleDownload = async (mode: "selected" | "original" = "selected") => {
    setIsDownloading(true);
    setFilterDownloadError("");

    try {
      if (mode === "original" || !hasAppliedInstagramFilter) {
        await downloadOriginalPhoto();
      } else {
        await downloadInstagramFilteredPhoto();
      }
    } catch (error) {
      console.error("Download failed:", error);
      setFilterDownloadError(
        error instanceof Error
          ? error.message
          : "Could not download this photo.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    const url = upgradedImageUrl || currentImageUrl || photo.thumbnailUrl;
    if (!url) return;

    const shareUrl = absoluteBrowserUrl(url);

    if (navigator.share) {
      try {
        await navigator.share({
          title: photo.fileName || photo.caption || "Photo",
          url: shareUrl,
        });
      } catch {
        // Ignore cancelled shares.
      }

      return;
    }

    await navigator.clipboard?.writeText(shareUrl);
  };

  const scrollAiEditToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const scrollContainer = aiEditScrollRef.current;
      if (!scrollContainer) return;

      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior,
      });
    },
    [],
  );

  useEffect(() => {
    if (!isAiEditOpen || !aiEditResult) return;

    const timer = window.setTimeout(() => {
      scrollAiEditToBottom();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [aiEditResult, isAiEditOpen, scrollAiEditToBottom]);

  const submitAiEdit = async () => {
    if (isSubmittingAiEdit) return;

    const selectedPreset = AI_EDIT_PRESETS.find(
      (preset) => preset.key === selectedAiPreset,
    );
    const prompt = aiEditPrompt.trim();

    if (!selectedPreset && !prompt) {
      setAiEditError("Choose a preset or describe the edit.");
      return;
    }

    setIsSubmittingAiEdit(true);
    setAiEditError("");
    setAiEditResult(null);

    try {
      const aiEditUrl = `/api/albums/${encodeURIComponent(
        albumSlug,
      )}/photos/${encodeURIComponent(photo.id)}/ai-edit${
        shareToken ? `?share=${encodeURIComponent(shareToken)}` : ""
      }`;
      const response = await fetch(
        aiEditUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetPromptKey: selectedPreset?.key ?? null,
            prompt,
          }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        edit?: {
          id?: string | null;
          editedUrl?: string | null;
          editedS3Key?: string | null;
          taskId?: string | null;
          status?: string;
        };
      };

      if (response.status === 401 || response.status === 403) {
        throw new Error("Log in to use AI Image Edit for this photo.");
      }

      if (!response.ok || !payload.edit) {
        throw new Error(payload.error || "Could not submit AI edit");
      }

      setAiEditResult(payload.edit);
      setAiEditAddStatus("");
    } catch (error) {
      setAiEditError(
        error instanceof Error ? error.message : "Could not submit AI edit",
      );
    } finally {
      setIsSubmittingAiEdit(false);
    }
  };

  const handleDownloadAiEdit = () => {
    if (!aiEditResult?.editedUrl) return;
    triggerDownload(aiEditResult.editedUrl, aiEditDownloadName);
  };

  const addAiEditToAlbum = async (event: AlbumEvent) => {
    if (!aiEditResult?.id || !aiEditResult.editedUrl || isAddingAiEditToAlbum) {
      return;
    }

    setIsAddingAiEditToAlbum(true);
    setAiEditAddStatus("");

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/photos/${encodeURIComponent(
          photo.id,
        )}/ai-edit/${encodeURIComponent(aiEditResult.id)}/add-to-album`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: event.id }),
        },
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not add edit to album");
      }

      setAiEditAddStatus(`Added to ${event.name}.`);
      await mutate(
        (key) =>
          typeof key === "string" &&
          key.startsWith(`/api/albums/${encodeURIComponent(albumSlug)}/photos`),
      );
    } catch (error) {
      setAiEditAddStatus(
        error instanceof Error ? error.message : "Could not add edit to album.",
      );
    } finally {
      setIsAddingAiEditToAlbum(false);
    }
  };

  function closeWithAnimation() {
    if (isClosing) return;

    const frame = photoFrameRef.current;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!frame || !originRect || prefersReducedMotion) {
      onClose();
      return;
    }

    const targetRect = frame.getBoundingClientRect();
    if (!targetRect.width || !targetRect.height) {
      onClose();
      return;
    }

    const originCenterX = originRect.left + originRect.width / 2;
    const originCenterY = originRect.top + originRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const translateX = originCenterX - targetCenterX;
    const translateY = originCenterY - targetCenterY;
    const scale = originRect.width / targetRect.width;

    setIsClosing(true);
    setAreControlsVisible(false);
    setAreControlsReady(false);
    setIsPeopleOpen(false);
    setIsAiEditOpen(false);
    setIsPresetPanelOpen(false);
    setIsFilterPanelOpen(false);
    setEntryStyle({
      opacity: 0.78,
      transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
      transformOrigin: "center center",
    });

    window.setTimeout(onClose, 300);
  }

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (photos.length <= 1 || isAnimatingSwipe) return;

    const touch = event.touches[0];

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    if (swipeCommitTimerRef.current) {
      window.clearTimeout(swipeCommitTimerRef.current);
      swipeCommitTimerRef.current = null;
    }

    setIsDragging(true);
    setIsAnimatingSwipe(false);
    dragOffsetRef.current = 0;
    setDragOffset(0);
    setSwipeAnimationDurationMs(DEFAULT_SWIPE_ANIMATION_MS);
    setAreControlsVisible(true);
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    if (!start || isAnimatingSwipe) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.25) {
      return;
    }

    const frameWidth =
      photoFrameRef.current?.getBoundingClientRect().width ||
      window.innerWidth ||
      1;

    const resistanceLimit = frameWidth * 0.95;
    const clampedDelta =
      Math.sign(deltaX) * Math.min(Math.abs(deltaX), resistanceLimit);

    dragOffsetRef.current = clampedDelta;
    setDragOffset(clampedDelta);
  };

  const handleTouchEnd = () => {
    const start = touchStartRef.current;
    touchStartRef.current = null;

    if (!start || isAnimatingSwipe) {
      setIsDragging(false);
      dragOffsetRef.current = 0;
      setDragOffset(0);
      return;
    }

    const committedDragOffset = dragOffsetRef.current;
    const elapsed = Math.max(Date.now() - start.time, 1);
    const velocity = Math.abs(committedDragOffset) / elapsed;

    const frameWidth =
      photoFrameRef.current?.getBoundingClientRect().width ||
      window.innerWidth ||
      1;

    const threshold = Math.min(frameWidth * 0.24, 120);
    const shouldNavigate = Math.abs(committedDragOffset) > threshold || velocity > 0.55;
    const animationDuration = shouldNavigate
      ? Math.max(
          MIN_SWIPE_ANIMATION_MS,
          Math.round(DEFAULT_SWIPE_ANIMATION_MS - Math.min(velocity, 1.4) * 70),
        )
      : 180;

    setIsDragging(false);
    setIsAnimatingSwipe(true);
    setSwipeAnimationDurationMs(animationDuration);

    if (!shouldNavigate) {
      dragOffsetRef.current = 0;
      setDragOffset(0);

      swipeCommitTimerRef.current = window.setTimeout(() => {
        setIsAnimatingSwipe(false);
      }, animationDuration);

      return;
    }

    const direction = committedDragOffset < 0 ? "next" : "previous";
    const finalOffset = direction === "next" ? -frameWidth : frameWidth;

    dragOffsetRef.current = finalOffset;
    setDragOffset(finalOffset);

    swipeCommitTimerRef.current = window.setTimeout(() => {
      dragOffsetRef.current = 0;
      setDragOffset(0);
      setIsAnimatingSwipe(false);
      setIsPeopleOpen(false);
      setIsDownloadHovering(false);

      if (direction === "next") {
        onNavigate(nextIndex);
      } else {
        onNavigate(previousIndex);
      }
    }, animationDuration);
  };

  const handlePersonClick = (person: PhotoPerson) => {
    onPersonClick?.(person);
    onClose();
  };

  const startRenamePerson = (person: PhotoPerson) => {
    setEditingPersonId(person.id);
    setRenameDraft(getPersonDisplayName(person));
    setRenameError("");
  };

  const cancelRenamePerson = () => {
    setEditingPersonId("");
    setRenameDraft("");
    setRenameError("");
  };

  const savePersonName = async (person: PhotoPerson) => {
    const nextName = renameDraft.trim();
    if (!nextName || isRenamingPerson) return;

    setIsRenamingPerson(true);
    setRenameError("");
    setPersonNameOverrides((current) => ({
      ...current,
      [person.id]: nextName,
    }));

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/people/${encodeURIComponent(
          person.id,
        )}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: nextName }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not rename person");
      }

      setEditingPersonId("");
      setRenameDraft("");
      await onPeopleChanged?.();
    } catch (error) {
      setRenameError(
        error instanceof Error ? error.message : "Could not rename person",
      );
      await onPeopleChanged?.();
    } finally {
      setIsRenamingPerson(false);
    }
  };

  const openMergePeopleDialog = (person: PhotoPerson) => {
    setMergeTargetPerson(person);
    setSelectedMergePersonIds([]);
    setMergeQuery("");
    setMergeError("");
  };

  const closeMergePeopleDialog = () => {
    if (isMergingPeople) return;

    setMergeTargetPerson(null);
    setSelectedMergePersonIds([]);
    setMergeQuery("");
    setMergeError("");
  };

  const toggleMergePerson = (personId: string) => {
    setSelectedMergePersonIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId],
    );
  };

  const mergePeopleIntoTarget = async () => {
    if (!mergeTargetPerson || !selectedMergePersonIds.length || isMergingPeople) {
      return;
    }

    setIsMergingPeople(true);
    setMergeError("");

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/people/merge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetPersonId: mergeTargetPerson.id,
            sourcePersonIds: selectedMergePersonIds,
            coverPersonId: mergeTargetPerson.id,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not merge people");
      }

      setMergeTargetPerson(null);
      setSelectedMergePersonIds([]);
      setMergeQuery("");
      setMergeError("");
      setIsPeopleOpen(false);
      await onPeopleChanged?.();
    } catch (error) {
      setMergeError(
        error instanceof Error ? error.message : "Could not merge people",
      );
      await onPeopleChanged?.();
    } finally {
      setIsMergingPeople(false);
    }
  };

  const areOverlaysInteractive =
    isMobilePointer ||
    areControlsVisible ||
    isPeopleOpen ||
    isFilterPanelOpen ||
    Boolean(mergeTargetPerson) ||
    isDownloadHovering;

  const overlayOpacityClass = areControlsReady && areOverlaysInteractive
    ? "opacity-100"
    : "opacity-0";

  const displayAspectRatio =
    photo.width && photo.height ? photo.width / photo.height : 3 / 2;

  const photoFrameWidth = `min(calc(100vw - 1.5rem), 1200px, calc((100svh - 9.5rem) * ${displayAspectRatio}))`;
  const photoFrameMaxHeight = "calc(100svh - 9.5rem)";

  const overlayInteractionClass = areOverlaysInteractive
    ? "pointer-events-auto"
    : "pointer-events-none";

  const swipeTrackClass =
    isDragging || !isAnimatingSwipe
      ? ""
      : "transition-transform ease-out";

  const imageClassName =
    "pointer-events-none h-full w-full cursor-default select-none object-contain";
  const lightboxEnterDurationClass = isClosing ? "duration-300" : "duration-700";

  return (
    <div
      className={`fixed inset-0 z-50 flex cursor-default items-center justify-center text-white transition-colors ${lightboxEnterDurationClass} ease-in-out ${
        isBackdropVisible ? "bg-black" : "bg-black/0"
      }`}
      onMouseEnter={() => {
        if (!isMobilePointer) showControlsBriefly();
      }}
      onMouseMove={() => {
        if (!isMobilePointer) showControlsBriefly();
      }}
      onClick={() => {
        if (isPresetPanelOpen) setIsPresetPanelOpen(false);
        else if (isFilterPanelOpen) setIsFilterPanelOpen(false);
        else if (isAiEditOpen) setIsAiEditOpen(false);
        else if (isPeopleOpen) setIsPeopleOpen(false);
        else closeWithAnimation();
      }}
      tabIndex={0}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/75 via-black/40 to-transparent px-16 pb-12 pt-4 text-center transition-opacity duration-200 sm:pb-14 sm:pt-5 ${overlayOpacityClass}`}
      >
        <div className="mx-auto max-w-[70vw] truncate text-sm font-medium text-white drop-shadow">
          {photoName}
        </div>
      </div>

      <button
        type="button"
        onMouseEnter={showControlsBriefly}
        onClick={(event) => {
          event.stopPropagation();
          setAreControlsVisible(true);
          setIsPlaying((current) => !current);
        }}
        className={`absolute left-3 top-3 z-40 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/75 text-zinc-950 shadow-md ring-1 ring-zinc-900/10 transition-opacity duration-200 hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-zinc-900/30 sm:left-6 sm:top-5 ${overlayOpacityClass} ${overlayInteractionClass}`}
        aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
        aria-pressed={isPlaying}
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </button>

      <button
        type="button"
        onMouseEnter={showControlsBriefly}
        onClick={(event) => {
          event.stopPropagation();
          closeWithAnimation();
        }}
        className={`absolute right-3 top-3 z-40 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/75 text-zinc-950 shadow-md ring-1 ring-zinc-900/10 transition-opacity duration-200 hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-zinc-900/30 sm:right-6 sm:top-5 ${overlayOpacityClass} ${overlayInteractionClass}`}
        aria-label="Close photo"
      >
        <X className="h-4 w-4 stroke-[2.25]" />
      </button>

      <button
        type="button"
        onMouseEnter={showControlsBriefly}
        className={`absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/70 text-zinc-900 shadow-md ring-1 ring-zinc-900/10 transition-opacity duration-200 hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-zinc-900/30 sm:left-8 ${overlayOpacityClass} ${overlayInteractionClass}`}
        onClick={(event) => {
          event.stopPropagation();
          handlePrev();
        }}
        aria-label="Previous photo"
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
      </button>

      <button
        type="button"
        onMouseEnter={showControlsBriefly}
        className={`absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/70 text-zinc-900 shadow-md ring-1 ring-zinc-900/10 transition-opacity duration-200 hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-zinc-900/30 sm:right-8 ${overlayOpacityClass} ${overlayInteractionClass}`}
        onClick={(event) => {
          event.stopPropagation();
          handleNext();
        }}
        aria-label="Next photo"
      >
        <ChevronRight className="h-6 w-6" strokeWidth={1.5} />
      </button>

      <div
        ref={touchSurfaceRef}
        className="relative flex h-full w-full cursor-default items-center justify-center px-3 py-16 sm:px-6 sm:py-20"
        onClick={(event) => {
          event.stopPropagation();

          if (isPeopleOpen) {
            setIsPeopleOpen(false);
          }

          if (isFilterPanelOpen) {
            setIsFilterPanelOpen(false);
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {currentDisplayBaseUrl ? (
          <div
            ref={photoFrameRef}
            className={`flex cursor-default flex-col transition-[transform,opacity] ${lightboxEnterDurationClass} ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform`}
            style={{
              width: photoFrameWidth,
              ...entryStyle,
              touchAction: "pan-y",
            }}
            onMouseEnter={() => {
              if (!isMobilePointer) showControlsBriefly();
            }}
            onMouseMove={() => {
              if (!isMobilePointer) showControlsBriefly();
            }}
            onMouseLeave={() => {
              if (!isMobilePointer && !isPeopleOpen && !isDownloadHovering) {
                startControlsTimer();
              }
            }}
          >
            <div
              className="relative overflow-hidden"
              style={{
                aspectRatio: displayAspectRatio,
                maxHeight: photoFrameMaxHeight,
              }}
            >
              <WatermarkedImage
                src={currentDisplayBaseUrl}
                alt={photo.caption || "Photo"}
                className="pointer-events-none absolute inset-0 h-full w-full cursor-default select-none object-contain opacity-0"
                decoding="async"
                fetchPriority="high"
                draggable={false}
                settings={shareSettings}
                fit="contain"
                style={selectedInstagramFilterImageStyle}
              />

              <div className="absolute inset-0 overflow-hidden">
                <div
                  className={`flex h-full w-full ${swipeTrackClass}`}
                  style={{
                    transform: `translate3d(calc(-100% + ${dragOffset}px), 0, 0)`,
                    transitionDuration: isDragging || !isAnimatingSwipe
                      ? undefined
                      : `${swipeAnimationDurationMs}ms`,
                  }}
                >
                  <div className="flex h-full w-full shrink-0 cursor-default items-center justify-center">
                    {(isDragging || isAnimatingSwipe) && previousImageUrl ? (
                      <WatermarkedImage
                        src={previousImageUrl}
                        alt={previousPhoto?.caption || "Previous photo"}
                        className={imageClassName}
                        draggable={false}
                        settings={shareSettings}
                        fit="contain"
                      />
                    ) : null}
                  </div>

                  <div className="relative flex h-full w-full shrink-0 cursor-default items-center justify-center">
                    {currentImageUrl ? (
                      <WatermarkedImage
                        src={currentImageUrl}
                        alt={photo.caption || "Photo"}
                        className={`${imageClassName} absolute inset-0`}
                        decoding="async"
                        fetchPriority="high"
                        draggable={false}
                        settings={shareSettings}
                        fit="contain"
                        style={selectedInstagramFilterImageStyle}
                      />
                    ) : null}

                    {upgradedImageUrl ? (
                      <FadingWatermarkedImage
                        src={upgradedImageUrl}
                        alt={photo.caption || "Photo"}
                        className={`${imageClassName} absolute inset-0`}
                        decoding="async"
                        fetchPriority="high"
                        draggable={false}
                        settings={shareSettings}
                        fit="contain"
                        style={selectedInstagramFilterImageStyle}
                      />
                    ) : null}
                    <InstagramFilterOverlay filter={selectedInstagramFilter} />
                  </div>

                  <div className="flex h-full w-full shrink-0 cursor-default items-center justify-center">
                    {(isDragging || isAnimatingSwipe) && nextImageUrl ? (
                      <WatermarkedImage
                        src={nextImageUrl}
                        alt={nextPhoto?.caption || "Next photo"}
                        className={imageClassName}
                        draggable={false}
                        settings={shareSettings}
                        fit="contain"
                      />
                    ) : null}
                  </div>
                </div>
              </div>

              <div
                className={`pointer-events-none absolute inset-0 z-10 bg-black/55 transition-opacity duration-200 ${
                  isDownloadHovering ? "opacity-100" : "opacity-0"
                }`}
              />

            </div>

            <div
              onMouseEnter={showControlsBriefly}
              className={`relative z-30 mt-1 flex h-10 cursor-default items-center justify-between text-white transition-opacity duration-200 ${overlayOpacityClass} ${overlayInteractionClass}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAreControlsVisible(true)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
                  aria-label="Favorite photo"
                >
                  <Heart className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAreControlsVisible(true);
                    setIsPeopleOpen(false);
                    setIsAiEditOpen(false);
                    setIsPresetPanelOpen(false);
                    setFilterDownloadError("");
                    setIsFilterPanelOpen((current) => !current);
                  }}
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40 ${
                    isFilterPanelOpen || hasAppliedInstagramFilter
                      ? "bg-white/20"
                      : ""
                  }`}
                  aria-label="Apply Instagram filter"
                  aria-pressed={isFilterPanelOpen}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>

                {canApplyPreset && (
                  <button
                    type="button"
                    onClick={() => {
                      setAreControlsVisible(true);
                      setIsPeopleOpen(false);
                      setIsAiEditOpen(false);
                      setIsFilterPanelOpen(false);
                      setIsPresetPanelOpen(true);
                    }}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
                    aria-label="Apply a photo preset"
                  >
                    <Palette className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                )}

                {canEditPhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      setAreControlsVisible(true);
                      setIsPeopleOpen(false);
                      setIsPresetPanelOpen(false);
                      setIsFilterPanelOpen(false);
                      setIsAiEditOpen(true);
                    }}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
                    aria-label="Edit photo with AI"
                  >
                    <Wand2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setAreControlsVisible(true);
                    handleShare();
                  }}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
                  aria-label="Share photo"
                >
                  <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>

                {canDownload && (
                  <button
                    type="button"
                    onMouseEnter={() => {
                      setAreControlsVisible(true);
                      setIsDownloadHovering(true);
                    }}
                    onMouseLeave={() => {
                      setIsDownloadHovering(false);
                    }}
                    onFocus={() => {
                      setAreControlsVisible(true);
                      setIsDownloadHovering(true);
                    }}
                    onBlur={() => {
                      setIsDownloadHovering(false);
                    }}
                    onClick={() => {
                      setAreControlsVisible(true);
                      handleDownload();
                    }}
                    disabled={isDownloading}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label="Download photo"
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                )}
              </div>

              {!hidePeople && <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setAreControlsVisible(true);
                    setIsPeopleOpen((current) => !current);
                  }}
                  className="flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-full px-1 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
                  aria-expanded={isPeopleOpen}
                  aria-label="Show people in this photo"
                >
                  {photoPeople.length ? (
                    <span className="flex -space-x-1.5">
                      {photoPeople.slice(0, 4).map((person) => (
                        <span
                          key={person.id}
                          className="relative h-5 w-5 overflow-hidden rounded-full bg-zinc-800 ring-1 ring-white/80"
                        >
                          <span className="flex h-full w-full items-center justify-center">
                            <User className="h-3 w-3 text-white" />
                          </span>
                          {person.coverFaceUrl ? (
                            <RetryableAvatarImage
                              src={person.coverFaceUrl}
                              alt={person.displayName || person.defaultName}
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : null}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <Users className="h-3.5 w-3.5" />
                  )}
                </button>

                {isPeopleOpen && (
                  <div className="absolute bottom-full right-0 mb-2 max-h-[min(76svh,420px)] w-[min(78vw,280px)] cursor-default overflow-y-auto overscroll-contain rounded-xl border border-white/20 bg-white/95 p-2 text-zinc-950 shadow-lg">
                    {photoPeople.length ? (
                      <div className="space-y-1">
                        {photoPeople.map((person) => {
                          const displayName = getPersonDisplayName(person);

                          return (
                            <div
                              key={person.id}
                              className="rounded-lg px-2 py-1.5 transition hover:bg-zinc-950/[0.05]"
                            >
                              <div className="flex w-full items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handlePersonClick(person)}
                                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left focus:outline-none focus:ring-2 focus:ring-zinc-300"
                                >
                                  <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200">
                                    <span className="flex h-full w-full items-center justify-center text-zinc-400">
                                      <User className="h-4 w-4" />
                                    </span>
                                    {person.coverFaceUrl ? (
                                      <RetryableAvatarImage
                                        src={person.coverFaceUrl}
                                        alt={displayName}
                                        className="absolute inset-0 h-full w-full object-cover"
                                      />
                                    ) : null}
                                  </span>

                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                      {displayName}
                                    </span>
                                    <span className="block truncate text-xs text-zinc-500">
                                      {person.photoCount} photos
                                    </span>
                                  </span>
                                </button>

                                {canManageLightboxPeople && (
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => startRenamePerson(person)}
                                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                                      aria-label={`Rename ${displayName}`}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openMergePeopleDialog(person)}
                                      disabled={allPeople.length < 2}
                                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-35"
                                      aria-label={`Merge people into ${displayName}`}
                                    >
                                      <GitMerge className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {canManageLightboxPeople &&
                                editingPersonId === person.id && (
                                  <div className="mt-2 space-y-2">
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        value={renameDraft}
                                        onChange={(event) =>
                                          setRenameDraft(event.target.value)
                                        }
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter") {
                                            void savePersonName(person);
                                          }
                                          if (event.key === "Escape") {
                                            cancelRenamePerson();
                                          }
                                        }}
                                        disabled={isRenamingPerson}
                                        className="h-8 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-950 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                                        aria-label="Person name"
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() => savePersonName(person)}
                                        disabled={
                                          isRenamingPerson || !renameDraft.trim()
                                        }
                                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-35"
                                        aria-label="Save person name"
                                      >
                                        {isRenamingPerson ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Check className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelRenamePerson}
                                        disabled={isRenamingPerson}
                                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-35"
                                        aria-label="Cancel person rename"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                    {renameError && (
                                      <p className="text-xs font-medium text-rose-600">
                                        {renameError}
                                      </p>
                                    )}
                                  </div>
                                )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="px-2 py-2 text-sm text-zinc-500">
                        No people detected in this photo.
                      </p>
                    )}
                  </div>
                )}
              </div>}
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full cursor-default items-center justify-center bg-zinc-100 text-sm text-zinc-500">
            No preview available
          </div>
        )}
      </div>

      {mergeTargetPerson && (
        <div
          className="fixed inset-0 z-[70] flex cursor-default items-center justify-center bg-black/60 p-4 text-zinc-950"
          onClick={(event) => {
            event.stopPropagation();
            closeMergePeopleDialog();
          }}
        >
          <div
            className="flex max-h-[min(88svh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lightbox-merge-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4">
              <div className="min-w-0">
                <h2
                  id="lightbox-merge-title"
                  className="text-lg font-semibold text-zinc-950"
                >
                  Merge people
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Selected faces will be merged into{" "}
                  {getPersonDisplayName(mergeTargetPerson)}.
                </p>
              </div>

              <button
                type="button"
                onClick={closeMergePeopleDialog}
                disabled={isMergingPeople}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close merge dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-zinc-200 p-4">
              <input
                value={mergeQuery}
                onChange={(event) => setMergeQuery(event.target.value)}
                placeholder="Search people"
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
              />
              <p className="mt-2 text-xs text-zinc-500">
                {selectedMergePersonIds.length
                  ? `${selectedMergePersonIds.length} selected`
                  : "Choose one or more people to merge."}
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
              {mergeCandidatePeople.length ? (
                mergeCandidatePeople.map((person) => {
                  const displayName = getPersonDisplayName(person);
                  const isSelected = selectedMergePersonIds.includes(person.id);

                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => toggleMergePerson(person.id)}
                      aria-pressed={isSelected}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition ${
                        isSelected
                          ? "border-zinc-950 bg-zinc-50"
                          : "border-zinc-200 hover:bg-zinc-50"
                      }`}
                    >
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200">
                        <span className="flex h-full w-full items-center justify-center text-zinc-400">
                          <User className="h-5 w-5" />
                        </span>
                        {person.coverFaceUrl ? (
                          <RetryableAvatarImage
                            src={person.coverFaceUrl}
                            alt={displayName}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : null}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-zinc-950">
                          {displayName}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {person.photoCount} photos
                        </span>
                      </span>

                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          isSelected
                            ? "border-zinc-950 bg-zinc-950 text-white"
                            : "border-zinc-300"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-8 text-center text-sm text-zinc-500">
                  No other people found.
                </div>
              )}
            </div>

            {selectedMergePeople.length > 0 && (
              <div className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500">
                Merging {selectedMergePeople.length} into{" "}
                {getPersonDisplayName(mergeTargetPerson)}
              </div>
            )}

            {mergeError && (
              <div className="mx-4 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {mergeError}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-4">
              <button
                type="button"
                onClick={closeMergePeopleDialog}
                disabled={isMergingPeople}
                className="h-9 cursor-pointer rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-600 transition hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={mergePeopleIntoTarget}
                disabled={isMergingPeople || !selectedMergePersonIds.length}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMergingPeople ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitMerge className="h-4 w-4" />
                )}
                Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {isPresetPanelOpen && (
        <PhotoPresetPanel
          albumSlug={albumSlug}
          photo={photo}
          onClose={() => setIsPresetPanelOpen(false)}
        />
      )}

      {isFilterPanelOpen && (
        <aside
          className="absolute bottom-0 right-0 top-0 z-50 flex w-full max-w-sm cursor-default flex-col border-l border-zinc-200 bg-white text-zinc-950 shadow-2xl sm:w-[360px]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
                Instagram filters
              </p>
              <h2 className="truncate text-lg font-semibold">
                {selectedInstagramFilter.label}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
              aria-label="Close filters"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100">
              {instagramFilterPreviewUrl ? (
                <>
                  <RetryingImage
                    src={instagramFilterPreviewUrl}
                    alt={photo.fileName || "Selected photo"}
                    className="h-full w-full object-cover"
                    style={selectedInstagramFilterImageStyle}
                  />
                  <InstagramFilterOverlay filter={selectedInstagramFilter} />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">
                  No preview
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {INSTAGRAM_FILTERS.map((filter) => {
                const isSelected = selectedInstagramFilter.key === filter.key;
                const filterImageStyle = instagramFilterImageStyle(filter);

                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => {
                      setSelectedInstagramFilterKey(filter.key);
                      setFilterDownloadError("");
                      setAreControlsVisible(true);
                    }}
                    aria-pressed={isSelected}
                    className={`cursor-pointer rounded-lg border p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-zinc-300 ${
                      isSelected
                        ? "border-zinc-950 bg-zinc-50"
                        : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="relative block aspect-[4/3] overflow-hidden rounded-md bg-zinc-100">
                      {instagramFilterPreviewUrl ? (
                        <>
                          <RetryingImage
                            src={instagramFilterPreviewUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                            style={filterImageStyle}
                          />
                          <InstagramFilterOverlay filter={filter} />
                        </>
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                          Preview
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block truncate text-xs font-semibold text-zinc-800">
                      {filter.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {canDownload && (
            <div className="space-y-2 border-t border-zinc-200 p-5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {hasAppliedInstagramFilter && (
                  <button
                    type="button"
                    onClick={() => handleDownload("original")}
                    disabled={isDownloading}
                    className="flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    Original / Normal
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDownload()}
                  disabled={isDownloading}
                  className={`flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-3 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 ${
                    hasAppliedInstagramFilter ? "" : "sm:col-span-2"
                  }`}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download {selectedInstagramFilter.label}
                </button>
              </div>
              {filterDownloadError && (
                <p className="text-xs font-medium text-rose-600">
                  {filterDownloadError}
                </p>
              )}
            </div>
          )}
        </aside>
      )}

      {isAiEditOpen && (
        <aside
          className="absolute bottom-0 right-0 top-0 z-50 flex w-full max-w-md cursor-default flex-col border-l border-zinc-200 bg-white text-zinc-950 shadow-2xl sm:w-[420px]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
                AI photo edit
              </p>
              <h2 className="truncate text-lg font-semibold">
                {photo.fileName || "Selected photo"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsAiEditOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
              aria-label="Close AI editor"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            ref={aiEditScrollRef}
            className="flex-1 space-y-5 overflow-y-auto px-5 py-4"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100">
              {currentImageUrl ? (
                <RetryingImage
                  src={currentImageUrl}
                  alt={photo.fileName || "Selected photo"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">
                  No preview
                </div>
              )}
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-zinc-950">
                Preset edits
              </p>
              <div className="flex flex-wrap gap-2">
                {AI_EDIT_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => {
                      setSelectedAiPreset((current) =>
                        current === preset.key ? "" : preset.key,
                      );
                      setAiEditError("");
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      selectedAiPreset === preset.key
                        ? "bg-zinc-950 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-950">
                Describe your edit
              </span>
              <textarea
                value={aiEditPrompt}
                onChange={(event) => {
                  setAiEditPrompt(event.target.value);
                  setAiEditError("");
                }}
                rows={4}
                placeholder="Add a golden retriever next to the bride and match the lighting naturally."
                className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
              />
            </label>

            {aiEditError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {aiEditError}
              </div>
            )}

            {aiEditResult && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-950">
                  <Sparkles className="h-4 w-4" />
                  {aiEditResult.editedUrl ? "Edit complete" : "Edit submitted"}
                </div>
                {aiEditResult.editedUrl ? (
                  <>
                    <RetryingImage
                      src={aiEditResult.editedUrl}
                      alt="AI edited result"
                      onLoad={() => scrollAiEditToBottom()}
                      className="mt-3 w-full rounded-md"
                    />

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadAiEdit}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            disabled={
                              isAddingAiEditToAlbum || !eventOptions.length
                            }
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-3 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isAddingAiEditToAlbum ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ImagePlus className="h-4 w-4" />
                            )}
                            Add to album
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {eventOptions.map((event) => (
                            <DropdownMenuItem
                              key={event.id}
                              onSelect={() => addAiEditToAlbum(event)}
                            >
                              {event.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {aiEditAddStatus && (
                      <p className="mt-2 text-xs font-medium text-zinc-600">
                        {aiEditAddStatus}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-zinc-600">
                    {aiEditResult.taskId
                      ? `Novita task ${aiEditResult.taskId} is processing.`
                      : "The edit job is processing."}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-zinc-200 p-5">
            <button
              type="button"
              onClick={submitAiEdit}
              disabled={isSubmittingAiEdit}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmittingAiEdit ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Edit Photo with AI
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

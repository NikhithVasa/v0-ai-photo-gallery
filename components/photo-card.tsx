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
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  ImagePlus,
  Loader2,
  Mail,
  Palette,
  Pause,
  Play,
  Share2,
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
import { Skeleton } from "@/components/ui/skeleton";
import { photoAspectRatio } from "@/lib/photo-layout";
import type { AlbumEvent, AlbumShareSettings, Photo } from "@/lib/types";

interface SignedPhotoUrls {
  previewUrl: string | null;
  downloadUrl: string | null;
  thumbnailUrl?: string | null;
  originalUrl?: string | null;
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
  forceFill?: boolean;
  shareSettings?: AlbumShareSettings | null;
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
  onError?: () => void;
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
  onError,
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
      onError?.();
    };
    image.src = src;

    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);

    return () => {
      isCancelled = true;
      resizeObserver.disconnect();
    };
  }, [decoding, fit, onError, onLoad, settings, src, watermarkEnabled]);

  if (!watermarkEnabled || fallback) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        draggable={draggable}
        onLoad={onLoad}
        onError={onError}
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
  forceFill = false,
  shareSettings,
}: PhotoCardProps) {
  const imageUrl = photo.previewUrl || photo.thumbnailUrl;
  const aspectRatio = photoAspectRatio(photo);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoadImage, setShouldLoadImage] = useState(index < 18);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadHovering, setIsDownloadHovering] = useState(false);
  const isShareView = Boolean(shareToken);
  const canDownload = isShareView
    ? Boolean(shareSettings?.allowDownloads)
    : shareSettings?.allowDownloads ?? true;

  useEffect(() => {
    setShouldLoadImage(index < 18);
    setIsImageLoaded(false);
  }, [index, photo.id]);

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
          setShouldLoadImage(true);
          observer.disconnect();
        }
      },
      { rootMargin: "1800px 0px" },
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, [shouldLoadImage]);

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

  return (
    <div
      ref={cardRef}
      className={`group relative w-full overflow-hidden rounded-md bg-muted text-left shadow-sm ring-1 ring-border transition-shadow duration-200 hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background ${
        forceFill ? "h-full" : ""
      }`}
      style={forceFill ? undefined : { aspectRatio }}
    >
      <button
        type="button"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();

          onOpen(index, {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            imageUrl: imageUrl ?? undefined,
          });
        }}
        className="absolute inset-0 cursor-pointer focus:outline-none"
        aria-label={photo.caption ? `Open ${photo.caption}` : "Open photo"}
      >
        {imageUrl && shouldLoadImage ? (
          <WatermarkedImage
            src={imageUrl}
            alt={photo.caption || "Photo"}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
              isImageLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading="eager"
            decoding="async"
            fetchPriority={index < 8 ? "high" : "auto"}
            settings={shareSettings}
            fit="contain"
            onLoad={handleImageLoad}
            onError={handleImageLoad}
          />
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

    </div>
  );
});

interface PhotoLightboxProps {
  albumSlug: string;
  shareToken?: string;
  photos: Photo[];
  currentIndex: number;
  events?: AlbumEvent[];
  originRect?: PhotoOpenRect;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onPersonClick?: (personId: string) => void;
  shareSettings?: AlbumShareSettings | null;
}

export function PhotoLightbox({
  albumSlug,
  shareToken = "",
  photos,
  currentIndex,
  events,
  originRect,
  onClose,
  onNavigate,
  onPersonClick,
  shareSettings,
}: PhotoLightboxProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPeopleOpen, setIsPeopleOpen] = useState(false);
  const [isAiEditOpen, setIsAiEditOpen] = useState(false);
  const [isPresetPanelOpen, setIsPresetPanelOpen] = useState(false);
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
  const [entryStyle, setEntryStyle] = useState<CSSProperties>();
  const [signedUrlsByPhotoId, setSignedUrlsByPhotoId] = useState<
    Record<string, SignedPhotoUrls>
  >({});
  const [loadedOriginalUrlsByPhotoId, setLoadedOriginalUrlsByPhotoId] =
    useState<Record<string, string>>({});
  const [failedOriginalUrlsByPhotoId, setFailedOriginalUrlsByPhotoId] =
    useState<Record<string, string>>({});

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingSwipe, setIsAnimatingSwipe] = useState(false);

  const photoFrameRef = useRef<HTMLDivElement>(null);
  const touchSurfaceRef = useRef<HTMLDivElement>(null);
  const aiEditScrollRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{
    x: number;
    y: number;
    time: number;
  } | null>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const swipeCommitTimerRef = useRef<number | null>(null);
  const isMobilePointerRef = useRef(isMobilePointer);
  const isPeopleOpenRef = useRef(isPeopleOpen);
  const isDownloadHoveringRef = useRef(isDownloadHovering);
  const isAnimatingSwipeRef = useRef(isAnimatingSwipe);
  const isMountedRef = useRef(false);
  const originalPreloadRef = useRef(new Map<string, string>());
  const { mutate } = useSWRConfig();

  const photo = photos[currentIndex];

  const previousIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
  const nextIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;

  const previousPhoto = photos[previousIndex];
  const nextPhoto = photos[nextIndex];
  const preloadPhotoIds = useMemo(
    () =>
      Array.from(
        new Set(
          [photo?.id, previousPhoto?.id, nextPhoto?.id].filter(
            (id): id is string => Boolean(id),
          ),
        ),
      ),
    [nextPhoto?.id, photo?.id, previousPhoto?.id],
  );
  const preloadPhotoIdsKey = preloadPhotoIds.join(":");

  const previewImageCandidates = uniqueUrls([
    originRect?.imageUrl,
    photo.previewUrl,
    photo.thumbnailUrl,
  ]);
  const imageUrl = previewImageCandidates[activeImageIndex] ?? null;
  const originalImageUrl = loadedOriginalUrlsByPhotoId[photo.id] ?? null;
  const upgradedImageUrl =
    originalImageUrl && originalImageUrl !== imageUrl ? originalImageUrl : null;
  const currentDisplayBaseUrl = imageUrl ?? upgradedImageUrl;
  const downloadUrl = signedUrlsByPhotoId[photo.id]?.downloadUrl ?? photo.downloadUrl;
  const isShareView = Boolean(shareToken);
  const canDownload = isShareView
    ? Boolean(shareSettings?.allowDownloads)
    : shareSettings?.allowDownloads ?? true;
  const canApplyPreset = !isShareView && !shareSettings;
  const canEditPhoto = true;
  const photoName = photo.fileName || `Photo ${currentIndex + 1}`;
  const photoPeople = photo.people ?? [];
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
        photoCount: 0,
        peopleCount: 0,
      });
    }

    return Array.from(byId.values());
  }, [events, photos]);

  const getPreviewUrl = useCallback((targetPhoto: Photo | undefined) => {
    if (!targetPhoto) return null;
    return targetPhoto.previewUrl || targetPhoto.thumbnailUrl || null;
  }, []);

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
  }, [albumSlug, preloadPhotoIds, preloadPhotoIdsKey, shareToken, signedUrlsByPhotoId]);

  useEffect(() => {
    for (const photoId of preloadPhotoIds) {
      const originalUrl = signedUrlsByPhotoId[photoId]?.originalUrl;
      if (!originalUrl) continue;
      if (loadedOriginalUrlsByPhotoId[photoId] === originalUrl) continue;
      if (failedOriginalUrlsByPhotoId[photoId] === originalUrl) continue;
      if (originalPreloadRef.current.get(photoId) === originalUrl) continue;

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
    preloadPhotoIds,
    preloadPhotoIdsKey,
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
  }, [photo.id]);

  const startControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }

    controlsTimerRef.current = window.setTimeout(() => {
      controlsTimerRef.current = null;

      if (isMobilePointerRef.current) return;

      if (!isPeopleOpenRef.current && !isDownloadHoveringRef.current) {
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

    const backdropFrame = window.requestAnimationFrame(() =>
      setIsBackdropVisible(true),
    );

    return () => {
      window.clearTimeout(controlsTimer);
      window.cancelAnimationFrame(backdropFrame);
    };
  }, [showControlsBriefly]);

  useEffect(() => {
    setActiveImageIndex(0);
    setIsPeopleOpen(false);
    setIsAiEditOpen(false);
    setIsPresetPanelOpen(false);
    setSelectedAiPreset("");
    setAiEditPrompt("");
    setAiEditError("");
    setAiEditResult(null);
    setIsDownloadHovering(false);
    setDragOffset(0);
    setIsDragging(false);
    setIsAnimatingSwipe(false);

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

    if (!frame || !originRect) {
      setEntryStyle(undefined);
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      setEntryStyle(undefined);
      return;
    }

    const targetRect = frame.getBoundingClientRect();
    if (!targetRect.width || !targetRect.height) return;

    const originCenterX = originRect.left + originRect.width / 2;
    const originCenterY = originRect.top + originRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    const translateX = originCenterX - targetCenterX;
    const translateY = originCenterY - targetCenterY;
    const scale = originRect.width / targetRect.width;

    setEntryStyle({
      opacity: 0.72,
      transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
      transformOrigin: "center center",
    });

	    const animationFrame = window.requestAnimationFrame(() => {
	      setEntryStyle({
	        opacity: 1,
	        transform: "translate3d(0, 0, 0) scale(1)",
	        transformOrigin: "center center",
	      });
	    });

    return () => window.cancelAnimationFrame(animationFrame);
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
        else if (isAiEditOpen) setIsAiEditOpen(false);
        else closeWithAnimation();
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [closeWithAnimation, handlePrev, handleNext, isAiEditOpen, isPresetPanelOpen]);

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      let url = downloadUrl;

      if (!url) {
        const urlsById = await fetchSignedPhotoUrls(albumSlug, [photo.id], shareToken);
        url = urlsById[photo.id]?.downloadUrl;
      }

      if (!url) return;

      triggerDownload(url, photo.fileName || `photo-${photo.id}.jpg`);
    } catch (error) {
      console.error("Download failed:", error);
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

  const handleImageError = () => {
    setActiveImageIndex((current) =>
      current < previewImageCandidates.length - 1 ? current + 1 : current,
    );
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
    setDragOffset(0);
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

    setDragOffset(clampedDelta);
  };

  const handleTouchEnd = () => {
    const start = touchStartRef.current;
    touchStartRef.current = null;

    if (!start || isAnimatingSwipe) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const elapsed = Math.max(Date.now() - start.time, 1);
    const velocity = Math.abs(dragOffset) / elapsed;

    const frameWidth =
      photoFrameRef.current?.getBoundingClientRect().width ||
      window.innerWidth ||
      1;

    const threshold = Math.min(frameWidth * 0.24, 120);
    const shouldNavigate = Math.abs(dragOffset) > threshold || velocity > 0.55;

    setIsDragging(false);
    setIsAnimatingSwipe(true);

    if (!shouldNavigate) {
      setDragOffset(0);

      swipeCommitTimerRef.current = window.setTimeout(() => {
        setIsAnimatingSwipe(false);
      }, 280);

      return;
    }

    const direction = dragOffset < 0 ? "next" : "previous";
    const finalOffset = direction === "next" ? -frameWidth : frameWidth;

    setDragOffset(finalOffset);

    swipeCommitTimerRef.current = window.setTimeout(() => {
      setDragOffset(0);
      setIsAnimatingSwipe(false);
      setIsPeopleOpen(false);
      setIsDownloadHovering(false);

      if (direction === "next") {
        onNavigate(nextIndex);
      } else {
        onNavigate(previousIndex);
      }
    }, 280);
  };

  const handlePersonClick = (personId: string) => {
    onPersonClick?.(personId);
    onClose();
  };

  const areOverlaysInteractive =
    isMobilePointer || areControlsVisible || isPeopleOpen || isDownloadHovering;

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
      : "transition-transform duration-300 ease-out";

  const imageClassName =
    "pointer-events-none h-full w-full cursor-default select-none object-contain";

  return (
    <div
      className={`fixed inset-0 z-50 flex cursor-default items-center justify-center text-white transition-colors duration-300 ease-in-out ${
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
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {currentDisplayBaseUrl ? (
          <div
            ref={photoFrameRef}
            className="flex cursor-default flex-col transition-[transform,opacity] duration-300 ease-in-out will-change-transform"
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
                onError={handleImageError}
                settings={shareSettings}
                fit="contain"
              />

              <div className="absolute inset-0 overflow-hidden">
                <div
                  className={`flex h-full w-full ${swipeTrackClass}`}
                  style={{
                    transform: `translate3d(calc(-100% + ${dragOffset}px), 0, 0)`,
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
                        onError={handleImageError}
                        settings={shareSettings}
                        fit="contain"
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
                      />
                    ) : null}
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

                {canApplyPreset && (
                  <button
                    type="button"
                    onClick={() => {
                      setAreControlsVisible(true);
                      setIsPeopleOpen(false);
                      setIsAiEditOpen(false);
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

              <div className="relative">
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
                          const displayName =
                            person.displayName || person.defaultName;

                          return (
                            <button
                              key={person.id}
                              type="button"
                              onClick={() => handlePersonClick(person.id)}
                              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-zinc-950/[0.05] focus:outline-none focus:ring-2 focus:ring-zinc-300"
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

                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {displayName}
                                </span>
                                <span className="block truncate text-xs text-zinc-500">
                                  {person.photoCount} photos
                                </span>
                              </span>
                            </button>
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
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full cursor-default items-center justify-center bg-zinc-100 text-sm text-zinc-500">
            No preview available
          </div>
        )}
      </div>

      {isPresetPanelOpen && (
        <PhotoPresetPanel
          albumSlug={albumSlug}
          photo={photo}
          onClose={() => setIsPresetPanelOpen(false)}
        />
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
                <img
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
                    <img
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

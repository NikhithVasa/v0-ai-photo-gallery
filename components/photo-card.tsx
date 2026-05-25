"use client";

import {
  memo,
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Mail,
  Pause,
  Play,
  Share2,
  User,
  Users,
  X,
} from "lucide-react";
import { photoAspectRatio } from "@/lib/photo-layout";
import type { Photo } from "@/lib/types";

interface SignedPhotoUrls {
  previewUrl: string | null;
  downloadUrl: string | null;
  thumbnailUrl?: string | null;
}

async function fetchSignedPhotoUrls(albumSlug: string, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.length) return {};

  const response = await fetch(
    `/api/albums/${encodeURIComponent(albumSlug)}/photos/signed-urls`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds: uniqueIds }),
    }
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
      },
    ])
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

function absoluteBrowserUrl(url: string) {
  if (typeof window === "undefined") return url;
  return url.startsWith("/") ? `${window.location.origin}${url}` : url;
}

interface PhotoCardProps {
  albumSlug: string;
  photo: Photo;
  index: number;
  onOpen: (index: number, originRect: PhotoOpenRect) => void;
}

export interface PhotoOpenRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const PhotoCard = memo(function PhotoCard({
  albumSlug,
  photo,
  index,
  onOpen,
}: PhotoCardProps) {
  const imageUrl = photo.thumbnailUrl || photo.previewUrl;
  const aspectRatio = photoAspectRatio(photo);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const signedUrls =
        photo.downloadUrl
          ? null
          : await fetchSignedPhotoUrls(albumSlug, [photo.id]);
      const downloadUrl =
        photo.downloadUrl || signedUrls?.[photo.id]?.downloadUrl;
      if (!downloadUrl) return;
      triggerDownload(downloadUrl, photo.fileName || `photo-${photo.id}.jpg`);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    const url = photo.thumbnailUrl || photo.previewUrl || photo.downloadUrl;
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
      className="group relative w-full overflow-hidden rounded-md bg-muted text-left shadow-sm ring-1 ring-border transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
      style={{ aspectRatio }}
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
          });
        }}
        className="absolute inset-0 cursor-pointer focus:outline-none"
        aria-label={photo.caption ? `Open ${photo.caption}` : "Open photo"}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={photo.caption || "Photo"}
            width={photo.width ?? undefined}
            height={photo.height ?? undefined}
            className="absolute inset-0 h-full w-full object-cover"
            loading={index < 48 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={index < 12 ? "high" : "auto"}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary">
            <span className="text-muted-foreground text-sm">No preview</span>
          </div>
        )}
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end bg-gradient-to-t from-black/70 via-black/25 to-transparent px-2 pb-2 pt-14 opacity-100 transition duration-200 sm:translate-y-2 sm:px-3 sm:pb-3 sm:pt-16 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100">
        <div className="pointer-events-auto flex items-center gap-2 text-white sm:gap-4">
          <button
            type="button"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/80 sm:h-9 sm:w-9"
            aria-label="Favorite photo"
          >
            <Heart className="h-5 w-5 stroke-1.5 sm:h-6 sm:w-6" />
          </button>

          <a
            href={`mailto:?subject=Photo&body=${encodeURIComponent(
              photo.thumbnailUrl || photo.previewUrl || photo.downloadUrl
                ? absoluteBrowserUrl(
                    photo.thumbnailUrl ||
                      photo.previewUrl ||
                      photo.downloadUrl ||
                      ""
                  )
                : ""
            )}`}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/80 sm:h-9 sm:w-9"
            aria-label="Email photo"
            onClick={(e) => e.stopPropagation()}
          >
            <Mail className="h-5 w-5 stroke-1.5 sm:h-6 sm:w-6" />
          </a>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/80 sm:h-9 sm:w-9"
            aria-label="Share photo"
          >
            <Share2 className="h-5 w-5 stroke-1.5 sm:h-6 sm:w-6" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            disabled={isDownloading}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/80 disabled:cursor-not-allowed disabled:opacity-45 sm:h-9 sm:w-9"
            aria-label="Download photo"
          >
            <Download className="h-5 w-5 stroke-1.5 sm:h-6 sm:w-6" />
          </button>
        </div>
      </div>
    </div>
  );
});

interface PhotoLightboxProps {
  albumSlug: string;
  photos: Photo[];
  currentIndex: number;
  originRect?: PhotoOpenRect;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onPersonClick?: (personId: string) => void;
}

export function PhotoLightbox({
  albumSlug,
  photos,
  currentIndex,
  originRect,
  onClose,
  onNavigate,
  onPersonClick,
}: PhotoLightboxProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPeopleOpen, setIsPeopleOpen] = useState(false);
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [signedUrls, setSignedUrls] = useState<Record<string, SignedPhotoUrls>>(
    {}
  );
  const [entryStyle, setEntryStyle] = useState<CSSProperties>();

  const photoFrameRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const controlsTimerRef = useRef<number | null>(null);

  const photo = photos[currentIndex];
  const signedPhoto = signedUrls[photo.id];

  const imageCandidates = uniqueUrls([
    signedPhoto?.previewUrl,
    photo.previewUrl,
    signedPhoto?.thumbnailUrl,
    photo.thumbnailUrl,
  ]);

  const imageUrl = imageCandidates[activeImageIndex] ?? null;
  const downloadUrl = signedPhoto?.downloadUrl || photo.downloadUrl;
  const photoName = photo.fileName || `Photo ${currentIndex + 1}`;
  const photoPeople = photo.people ?? [];
  const photoAspect =
    photo.width && photo.height && photo.width > 0 && photo.height > 0
      ? photo.width / photo.height
      : null;

  const startControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }

    controlsTimerRef.current = window.setTimeout(() => {
      setAreControlsVisible(false);
    }, 2000);
  }, []);

  const showControlsBriefly = useCallback(() => {
    setAreControlsVisible(true);
    startControlsTimer();
  }, [startControlsTimer]);

  const handlePrev = useCallback(() => {
    showControlsBriefly();
    setIsPeopleOpen(false);
    onNavigate(currentIndex > 0 ? currentIndex - 1 : photos.length - 1);
  }, [currentIndex, onNavigate, photos.length, showControlsBriefly]);

  const handleNext = useCallback(() => {
    showControlsBriefly();
    setIsPeopleOpen(false);
    onNavigate(currentIndex < photos.length - 1 ? currentIndex + 1 : 0);
  }, [currentIndex, onNavigate, photos.length, showControlsBriefly]);

  useEffect(() => {
    setActiveImageIndex(0);
    setIsPeopleOpen(false);
  }, [photo.id]);

  useEffect(() => {
    const updateViewportSize = () => {
      const visualViewport = window.visualViewport;
      setViewportSize({
        width: visualViewport?.width ?? window.innerWidth,
        height: visualViewport?.height ?? window.innerHeight,
      });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    window.visualViewport?.addEventListener("resize", updateViewportSize);

    return () => {
      window.removeEventListener("resize", updateViewportSize);
      window.visualViewport?.removeEventListener("resize", updateViewportSize);
    };
  }, []);

  useEffect(() => {
    const hasMouse = window.matchMedia("(pointer: fine)").matches;
    if (!hasMouse) return;

    startControlsTimer();

    return () => {
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
      }
    };
  }, [startControlsTimer]);

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
      "(prefers-reduced-motion: reduce)"
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
    const scaleX = originRect.width / targetRect.width;
    const scaleY = originRect.height / targetRect.height;

    setEntryStyle({
      opacity: 0.88,
      transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`,
    });

    const animationFrame = window.requestAnimationFrame(() => {
      setEntryStyle({
        opacity: 1,
        transform: "translate3d(0, 0, 0) scale(1, 1)",
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [originRect, currentIndex]);

  useEffect(() => {
    let isCancelled = false;

    const indexesToSign = [
      currentIndex,
      currentIndex + 1,
      currentIndex - 1,
      currentIndex + 2,
      currentIndex - 2,
    ];

    const ids = indexesToSign
      .map((index) => photos[(index + photos.length) % photos.length]?.id)
      .filter((id): id is string => Boolean(id && !signedUrls[id]));

    if (!ids.length) return;

    fetchSignedPhotoUrls(albumSlug, ids).then((urlsById) => {
      if (isCancelled) return;

      setSignedUrls((current) => ({
        ...current,
        ...urlsById,
      }));

      Object.values(urlsById).forEach((urls) => {
        if (!urls.previewUrl) return;
        const image = new window.Image();
        image.src = urls.previewUrl;
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [albumSlug, currentIndex, photos, signedUrls]);

  useEffect(() => {
    if (!isPlaying || photos.length <= 1) return;

    const interval = window.setInterval(() => {
      showControlsBriefly();
      onNavigate(currentIndex < photos.length - 1 ? currentIndex + 1 : 0);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [
    currentIndex,
    isPlaying,
    onNavigate,
    photos.length,
    showControlsBriefly,
  ]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      let url = downloadUrl;

      if (!url) {
        const urlsById = await fetchSignedPhotoUrls(albumSlug, [photo.id]);
        url = urlsById[photo.id]?.downloadUrl;
        setSignedUrls((current) => ({ ...current, ...urlsById }));
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
    const url = imageUrl || downloadUrl || photo.thumbnailUrl;
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

  const handleImageError = () => {
    setActiveImageIndex((current) =>
      current < imageCandidates.length - 1 ? current + 1 : current
    );
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
      return;
    }

    if (deltaX < 0) handleNext();
    else handlePrev();
  };

  const handlePersonClick = (personId: string) => {
    onPersonClick?.(personId);
    onClose();
  };

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        handlePrev();
      }

      if (event.key === "ArrowRight") {
        handleNext();
      }

      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [handlePrev, handleNext, onClose]);

  const overlayVisibilityClass =
    areControlsVisible || isPeopleOpen
      ? "opacity-100"
      : "opacity-0 pointer-events-none";
  const imageFrameStyle: CSSProperties = {};

  if (photoAspect && viewportSize.width && viewportSize.height) {
    const maxWidth = Math.max(240, viewportSize.width - 32);
    const maxHeight = Math.max(240, viewportSize.height - 32);
    const boundsAspect = maxWidth / maxHeight;

    if (boundsAspect > photoAspect) {
      imageFrameStyle.height = maxHeight;
      imageFrameStyle.width = maxHeight * photoAspect;
    } else {
      imageFrameStyle.width = maxWidth;
      imageFrameStyle.height = maxWidth / photoAspect;
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 text-white backdrop-blur-[1px]"
      onClick={() => {
        if (isPeopleOpen) setIsPeopleOpen(false);
        else onClose();
      }}
      onMouseMove={showControlsBriefly}
      tabIndex={0}
    >
      <button
        type="button"
        className={`absolute left-2 top-1/2 z-20 -translate-y-1/2 cursor-pointer rounded-full p-1 text-white drop-shadow transition-opacity duration-300 hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-white/70 sm:left-8 sm:p-2 ${overlayVisibilityClass}`}
        onClick={(e) => {
          e.stopPropagation();
          handlePrev();
        }}
        aria-label="Previous photo"
      >
        <ChevronLeft className="h-10 w-10 stroke-1 sm:h-14 sm:w-14" />
      </button>

      <button
        type="button"
        className={`absolute right-2 top-1/2 z-20 -translate-y-1/2 cursor-pointer rounded-full p-1 text-white drop-shadow transition-opacity duration-300 hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-white/70 sm:right-8 sm:p-2 ${overlayVisibilityClass}`}
        onClick={(e) => {
          e.stopPropagation();
          handleNext();
        }}
        aria-label="Next photo"
      >
        <ChevronRight className="h-10 w-10 stroke-1 sm:h-14 sm:w-14" />
      </button>

      <div
        className="relative flex h-full w-full items-center justify-center px-4 py-4"
        onClick={(e) => {
          e.stopPropagation();
          if (isPeopleOpen) setIsPeopleOpen(false);
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {imageUrl ? (
          <div
            ref={photoFrameRef}
            className="relative inline-block max-h-[100svh] max-w-[100vw] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.2,0.85,0.2,1)] will-change-transform"
            style={{ ...imageFrameStyle, ...entryStyle }}
          >
            <img
              src={imageUrl}
              alt={photo.caption || "Photo"}
              width={photo.width ?? undefined}
              height={photo.height ?? undefined}
              className="block h-full w-full object-contain"
              decoding="async"
              fetchPriority="high"
              onError={handleImageError}
            />

            <div className="pointer-events-none absolute inset-0">
              <div
                className={`pointer-events-none absolute left-1/2 top-4 z-30 max-w-[70%] -translate-x-1/2 truncate text-center text-sm font-medium text-white drop-shadow transition-opacity duration-300 ${overlayVisibilityClass}`}
              >
                {photoName}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className={`pointer-events-auto absolute right-4 top-4 z-30 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-white drop-shadow transition-opacity duration-300 hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-white/70 ${overlayVisibilityClass}`}
                aria-label="Close photo"
              >
                <X className="h-5 w-5" />
              </button>

              <div
                className={`pointer-events-auto absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-full bg-white/25 px-2 py-1 text-white shadow-lg backdrop-blur-md ring-1 ring-white/35 transition-opacity duration-300 sm:bottom-5 sm:left-5 sm:gap-4 ${overlayVisibilityClass}`}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    showControlsBriefly();
                    setIsPlaying((current) => !current);
                  }}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/20 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/70"
                  aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
                  aria-pressed={isPlaying}
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={showControlsBriefly}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/20 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/70"
                  aria-label="Favorite photo"
                >
                  <Heart className="h-5 w-5 stroke-1.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    showControlsBriefly();
                    handleShare();
                  }}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/20 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/70"
                  aria-label="Share photo"
                >
                  <Share2 className="h-5 w-5 stroke-1.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    showControlsBriefly();
                    handleDownload();
                  }}
                  disabled={isDownloading}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/20 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:cursor-not-allowed disabled:opacity-45"
                  aria-label="Download photo"
                >
                  <Download className="h-5 w-5 stroke-1.5" />
                </button>
              </div>

              <div
                className={`pointer-events-auto absolute bottom-4 right-4 z-30 transition-opacity duration-300 sm:bottom-5 sm:right-5 ${overlayVisibilityClass}`}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    showControlsBriefly();
                    setIsPeopleOpen((current) => !current);
                  }}
                  className="flex h-10 min-w-10 cursor-pointer items-center justify-center rounded-full bg-white/25 px-1 text-white shadow-lg backdrop-blur-md ring-1 ring-white/35 transition hover:bg-white/35 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/70"
                  aria-expanded={isPeopleOpen}
                  aria-label="Show people in this photo"
                >
                  {photoPeople.length ? (
                    <span className="flex -space-x-2">
                      {photoPeople.slice(0, 4).map((person) => (
                        <span
                          key={person.id}
                          className="relative h-8 w-8 overflow-hidden rounded-full bg-zinc-800 ring-1 ring-white/90"
                        >
                          {person.coverFaceUrl ? (
                            <img
                              src={person.coverFaceUrl}
                              alt={person.displayName || person.defaultName}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center">
                              <User className="h-4 w-4" />
                            </span>
                          )}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <Users className="h-5 w-5" />
                  )}
                </button>

                {isPeopleOpen && (
                  <div className="absolute bottom-full right-0 mb-3 w-[min(78vw,280px)] rounded-xl border border-white/20 bg-white/95 p-2 text-zinc-950 shadow-lg backdrop-blur-md">
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
                                {person.coverFaceUrl ? (
                                  <img
                                    src={person.coverFaceUrl}
                                    alt={displayName}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-zinc-400">
                                    <User className="h-4 w-4" />
                                  </span>
                                )}
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
          <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">
            No preview available
          </div>
        )}
      </div>
    </div>
  );
}

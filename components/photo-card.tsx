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
  const [isDownloadHovering, setIsDownloadHovering] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      const signedUrls = photo.downloadUrl
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
      className="group relative w-full overflow-hidden rounded-md bg-muted text-left shadow-sm ring-1 ring-border transition-shadow duration-200 hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
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
            <span className="text-sm text-muted-foreground">No preview</span>
          </div>
        )}
      </button>

      <div
        className={`pointer-events-none absolute inset-0 z-10 bg-black/55 transition-opacity duration-200 ${
          isDownloadHovering ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className={`pointer-events-none absolute bottom-24 left-3 z-20 transition-opacity duration-200 sm:bottom-28 sm:left-4 ${
          isDownloadHovering ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="text-sm font-medium tracking-wide text-white drop-shadow">
          Download Photo
        </div>

        <div className="relative mt-3 h-px w-36 bg-white/75 sm:w-44">
          <div className="absolute right-4 top-[-3px] h-3 w-3 rotate-45 border-b border-r border-white/75" />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2 z-30 flex items-center gap-2 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 sm:bottom-3 sm:left-3">
        <button
          type="button"
          className="pointer-events-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white drop-shadow-md transition hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-white/80"
          aria-label="Favorite photo"
        >
          <Heart className="h-4 w-4 stroke-1.5" />
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
          className="pointer-events-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white drop-shadow-md transition hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-white/80"
          aria-label="Email photo"
          onClick={(event) => event.stopPropagation()}
        >
          <Mail className="h-4 w-4 stroke-1.5" />
        </a>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleShare();
          }}
          className="pointer-events-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white drop-shadow-md transition hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-white/80"
          aria-label="Share photo"
        >
          <Share2 className="h-4 w-4 stroke-1.5" />
        </button>

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
          className="pointer-events-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white drop-shadow-md transition hover:bg-white/15 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/80 disabled:cursor-not-allowed disabled:opacity-45"
          aria-label="Download photo"
        >
          <Download className="h-4 w-4 stroke-1.5" />
        </button>
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
  const [areControlsVisible, setAreControlsVisible] = useState(false);
  const [isMobilePointer, setIsMobilePointer] = useState(false);
  const [isDownloadHovering, setIsDownloadHovering] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
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

  const startControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }

    controlsTimerRef.current = window.setTimeout(() => {
      if (isMobilePointer) return;

      if (!isPeopleOpen && !isDownloadHovering) {
        setAreControlsVisible(false);
      }
    }, 2000);
  }, [isDownloadHovering, isMobilePointer, isPeopleOpen]);

  const showControlsBriefly = useCallback(() => {
    setAreControlsVisible(true);
    startControlsTimer();
  }, [startControlsTimer]);

  const handlePrev = useCallback(() => {
    showControlsBriefly();
    setIsPeopleOpen(false);
    setIsDownloadHovering(false);
    onNavigate(currentIndex > 0 ? currentIndex - 1 : photos.length - 1);
  }, [currentIndex, onNavigate, photos.length, showControlsBriefly]);

  const handleNext = useCallback(() => {
    showControlsBriefly();
    setIsPeopleOpen(false);
    setIsDownloadHovering(false);
    onNavigate(currentIndex < photos.length - 1 ? currentIndex + 1 : 0);
  }, [currentIndex, onNavigate, photos.length, showControlsBriefly]);

  useEffect(() => {
    setActiveImageIndex(0);
    setIsPeopleOpen(false);
    setIsDownloadHovering(false);

    if (isMobilePointer) {
      setAreControlsVisible(true);
    }
  }, [photo.id, isMobilePointer]);

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

  const overlayVisibilityClass =
    isMobilePointer || areControlsVisible || isPeopleOpen || isDownloadHovering
      ? "opacity-100"
      : "opacity-0 pointer-events-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 text-white backdrop-blur-[1px]"
      onClick={() => {
        if (isPeopleOpen) setIsPeopleOpen(false);
        else onClose();
      }}
      tabIndex={0}
    >
      <div
        className={`pointer-events-none absolute left-1/2 top-4 z-30 max-w-[70vw] -translate-x-1/2 truncate text-center text-sm font-medium text-white drop-shadow transition-opacity duration-200 sm:top-5 ${overlayVisibilityClass}`}
      >
        {photoName}
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        className={`absolute right-3 top-3 z-30 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/25 text-white shadow-lg backdrop-blur-md ring-1 ring-white/30 transition-opacity duration-200 hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70 sm:right-6 sm:top-5 ${overlayVisibilityClass}`}
        aria-label="Close photo"
      >
        <X className="h-5 w-5" />
      </button>

      <button
        type="button"
        className={`absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/25 text-white shadow-lg backdrop-blur-md ring-1 ring-white/30 transition-opacity duration-200 hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70 sm:left-8 sm:h-12 sm:w-12 ${overlayVisibilityClass}`}
        onClick={(event) => {
          event.stopPropagation();
          handlePrev();
        }}
        aria-label="Previous photo"
      >
        <ChevronLeft className="h-7 w-7 stroke-1.5 sm:h-9 sm:w-9" />
      </button>

      <button
        type="button"
        className={`absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/25 text-white shadow-lg backdrop-blur-md ring-1 ring-white/30 transition-opacity duration-200 hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70 sm:right-8 sm:h-12 sm:w-12 ${overlayVisibilityClass}`}
        onClick={(event) => {
          event.stopPropagation();
          handleNext();
        }}
        aria-label="Next photo"
      >
        <ChevronRight className="h-7 w-7 stroke-1.5 sm:h-9 sm:w-9" />
      </button>

      <div
        className="relative flex h-full w-full items-center justify-center px-4 py-4"
        onClick={(event) => {
          event.stopPropagation();

          if (isPeopleOpen) {
            setIsPeopleOpen(false);
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {imageUrl ? (
          <div
            ref={photoFrameRef}
            className="relative inline-block max-h-[100svh] max-w-[100vw] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.2,0.85,0.2,1)] will-change-transform"
            style={entryStyle}
            onMouseEnter={() => {
              if (!isMobilePointer) {
                setAreControlsVisible(true);
              }
            }}
            onMouseMove={() => {
              if (!isMobilePointer) {
                setAreControlsVisible(true);
              }
            }}
            onMouseLeave={() => {
              if (!isMobilePointer && !isPeopleOpen && !isDownloadHovering) {
                setAreControlsVisible(false);
              }
            }}
          >
            <img
              src={imageUrl}
              alt={photo.caption || "Photo"}
              width={photo.width ?? undefined}
              height={photo.height ?? undefined}
              className="block max-h-[100svh] max-w-[100vw] object-contain"
              decoding="async"
              fetchPriority="high"
              onError={handleImageError}
            />

            <div
              className={`pointer-events-none absolute inset-0 z-10 bg-black/55 transition-opacity duration-200 ${
                isDownloadHovering ? "opacity-100" : "opacity-0"
              }`}
            />

            <div
              className={`pointer-events-none absolute bottom-28 left-3 z-20 transition-opacity duration-200 sm:bottom-32 sm:left-4 ${
                isDownloadHovering ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="text-sm font-medium tracking-wide text-white drop-shadow sm:text-base">
                Download Photo
              </div>

              <div className="relative mt-3 h-px w-44 bg-white/75 sm:w-56">
                <div className="absolute right-4 top-[-3px] h-3 w-3 rotate-45 border-b border-r border-white/75" />
              </div>
            </div>

            <div
              className={`pointer-events-auto absolute bottom-4 left-4 z-30 flex items-center gap-2 rounded-full bg-white/25 px-2 py-1 text-white shadow-lg backdrop-blur-md ring-1 ring-white/30 transition-opacity duration-200 sm:bottom-5 sm:left-5 ${overlayVisibilityClass}`}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setAreControlsVisible(true);
                  setIsPlaying((current) => !current);
                }}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full drop-shadow-md transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
                aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
                aria-pressed={isPlaying}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setAreControlsVisible(true)}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full drop-shadow-md transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
                aria-label="Favorite photo"
              >
                <Heart className="h-4 w-4 stroke-1.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setAreControlsVisible(true);
                  handleShare();
                }}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full drop-shadow-md transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
                aria-label="Share photo"
              >
                <Share2 className="h-4 w-4 stroke-1.5" />
              </button>

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
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full drop-shadow-md transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Download photo"
              >
                <Download className="h-4 w-4 stroke-1.5" />
              </button>
            </div>

            <div
              className={`pointer-events-auto absolute bottom-4 right-4 z-30 transition-opacity duration-200 sm:bottom-5 sm:right-5 ${overlayVisibilityClass}`}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setAreControlsVisible(true);
                  setIsPeopleOpen((current) => !current);
                }}
                className="flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-full bg-white/25 px-1 text-white shadow-lg backdrop-blur-md ring-1 ring-white/30 transition hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70"
                aria-expanded={isPeopleOpen}
                aria-label="Show people in this photo"
              >
                {photoPeople.length ? (
                  <span className="flex -space-x-2">
                    {photoPeople.slice(0, 4).map((person) => (
                      <span
                        key={person.id}
                        className="relative h-7 w-7 overflow-hidden rounded-full bg-zinc-800 ring-1 ring-white/90"
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
                            <User className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </span>
                    ))}
                  </span>
                ) : (
                  <Users className="h-4 w-4" />
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
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">
            No preview available
          </div>
        )}
      </div>
    </div>
  );
}
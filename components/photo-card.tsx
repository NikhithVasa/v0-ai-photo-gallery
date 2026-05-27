"use client";

import {
  memo,
  type CSSProperties,
  type TouchEvent,
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

function preloadImage(url: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = url;
  });
}

interface PhotoCardProps {
  albumSlug: string;
  photo: Photo;
  index: number;
  onOpen: (index: number, originRect: PhotoOpenRect) => void;
  forceFill?: boolean;
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
  forceFill = false,
}: PhotoCardProps) {
  const imageUrl = photo.thumbnailUrl || photo.previewUrl;
  const aspectRatio = photoAspectRatio(photo);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadHovering, setIsDownloadHovering] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      let downloadUrl = photo.downloadUrl;

      if (!downloadUrl) {
        const signedUrls = await fetchSignedPhotoUrls(albumSlug, [photo.id]);
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
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-black/80 via-black/35 to-transparent transition-opacity duration-200 ${
          isDownloadHovering
            ? "opacity-0"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        }`}
      />

      <div className="pointer-events-none absolute bottom-2 left-2 z-40 flex items-center gap-1 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 sm:bottom-3 sm:left-3">
        <button
          type="button"
          className="pointer-events-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white drop-shadow-md transition hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-white/80"
          aria-label="Favorite photo"
        >
          <Heart className="h-4 w-4 stroke-1.5" />
        </button>

        <a
          href={`mailto:?subject=Photo&body=${encodeURIComponent(
            imageUrl ? absoluteBrowserUrl(imageUrl) : ""
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
  const [entryStyle, setEntryStyle] = useState<CSSProperties>();
  const [preloadedUrls, setPreloadedUrls] = useState<Set<string>>(new Set());
  const [canPreloadAdjacent, setCanPreloadAdjacent] = useState(false);

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingSwipe, setIsAnimatingSwipe] = useState(false);

  const photoFrameRef = useRef<HTMLDivElement>(null);
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

  const photo = photos[currentIndex];

  const previousIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
  const nextIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;

  const previousPhoto = photos[previousIndex];
  const nextPhoto = photos[nextIndex];

  const imageCandidates = uniqueUrls([photo.thumbnailUrl, photo.previewUrl]);
  const imageUrl = imageCandidates[activeImageIndex] ?? null;
  const downloadUrl = photo.downloadUrl;
  const photoName = photo.fileName || `Photo ${currentIndex + 1}`;
  const photoPeople = photo.people ?? [];

  const getPreviewUrl = useCallback((targetPhoto: Photo | undefined) => {
    if (!targetPhoto) return null;
    return targetPhoto.thumbnailUrl || targetPhoto.previewUrl || null;
  }, []);

  const previousImageUrl = useMemo(
    () => getPreviewUrl(previousPhoto),
    [getPreviewUrl, previousPhoto]
  );

  const currentImageUrl = imageUrl;

  const nextImageUrl = useMemo(
    () => getPreviewUrl(nextPhoto),
    [getPreviewUrl, nextPhoto]
  );

  const adjacentImagesReady = Boolean(
    currentImageUrl &&
      previousImageUrl &&
      nextImageUrl &&
      preloadedUrls.has(currentImageUrl) &&
      preloadedUrls.has(previousImageUrl) &&
      preloadedUrls.has(nextImageUrl)
  );

  isMobilePointerRef.current = isMobilePointer;
  isPeopleOpenRef.current = isPeopleOpen;
  isDownloadHoveringRef.current = isDownloadHovering;

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
    [onNavigate, showControlsBriefly]
  );

  const handlePrev = useCallback(() => {
    navigateToIndex(previousIndex);
  }, [navigateToIndex, previousIndex]);

  const handleNext = useCallback(() => {
    navigateToIndex(nextIndex);
  }, [navigateToIndex, nextIndex]);

  useEffect(() => {
    setActiveImageIndex(0);
    setIsPeopleOpen(false);
    setIsDownloadHovering(false);
    setDragOffset(0);
    setIsDragging(false);
    setIsAnimatingSwipe(false);
    setCanPreloadAdjacent(false);

    if (isMobilePointer) {
      setAreControlsVisible(true);
    }

    const timer = window.setTimeout(() => {
      setCanPreloadAdjacent(true);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [photo.id, isMobilePointer]);

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
    if (!currentImageUrl) return;

    setPreloadedUrls((current) => {
      if (current.has(currentImageUrl)) return current;

      const next = new Set(current);
      next.add(currentImageUrl);
      return next;
    });
  }, [currentImageUrl]);

  useEffect(() => {
    if (!canPreloadAdjacent) return;
    if (!currentImageUrl) return;

    const urlsToPreload = uniqueUrls([previousImageUrl, nextImageUrl]).filter(
      (url) => !preloadedUrls.has(url)
    );

    if (!urlsToPreload.length) return;

    let isCancelled = false;

    urlsToPreload.forEach((url) => {
      preloadImage(url)
        .then(() => {
          if (isCancelled) return;

          setPreloadedUrls((current) => {
            if (current.has(url)) return current;

            const next = new Set(current);
            next.add(url);
            return next;
          });
        })
        .catch(() => {
          // Failed image is ignored so we do not render broken adjacent slides.
        });
    });

    return () => {
      isCancelled = true;
    };
  }, [
    canPreloadAdjacent,
    currentImageUrl,
    nextImageUrl,
    previousImageUrl,
    preloadedUrls,
  ]);

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
    const url = currentImageUrl || downloadUrl || photo.thumbnailUrl;
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

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (photos.length <= 1 || isAnimatingSwipe) return;

    if (!adjacentImagesReady) {
      setAreControlsVisible(true);
      return;
    }

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

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    if (!start || isAnimatingSwipe || !adjacentImagesReady) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.25) {
      return;
    }

    event.preventDefault();

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

    if (!start || isAnimatingSwipe || !adjacentImagesReady) {
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
    const shouldNavigate =
      Math.abs(dragOffset) > threshold || velocity > 0.55;

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

  const overlayOpacityClass = areOverlaysInteractive
    ? "opacity-100"
    : "opacity-0";

  const overlayInteractionClass = areOverlaysInteractive
    ? "pointer-events-auto"
    : "pointer-events-none";

  const swipeTrackClass =
    isDragging || !isAnimatingSwipe
      ? ""
      : "transition-transform duration-300 ease-out";

  const imageClassName =
    "pointer-events-none max-h-full max-w-full cursor-default select-none object-contain shadow-2xl";

  return (
    <div
      className="fixed inset-0 z-50 flex cursor-default items-center justify-center bg-white/90 text-white backdrop-blur-2xl supports-[backdrop-filter]:bg-white/85"
      onClick={() => {
        if (isPeopleOpen) setIsPeopleOpen(false);
        else onClose();
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
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        className={`absolute right-3 top-3 z-40 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/75 text-zinc-950 shadow-lg backdrop-blur-md ring-1 ring-zinc-900/10 transition-opacity duration-200 hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-zinc-900/30 sm:right-6 sm:top-5 ${overlayOpacityClass} ${overlayInteractionClass}`}
        aria-label="Close photo"
      >
        <X className="h-5 w-5 stroke-[2.25]" />
      </button>

      <button
        type="button"
        className={`absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/70 text-zinc-900 shadow-lg backdrop-blur-md ring-1 ring-zinc-900/10 transition-opacity duration-200 hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-zinc-900/30 sm:left-8 sm:h-12 sm:w-12 ${overlayOpacityClass} ${overlayInteractionClass}`}
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
        className={`absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/70 text-zinc-900 shadow-lg backdrop-blur-md ring-1 ring-zinc-900/10 transition-opacity duration-200 hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-zinc-900/30 sm:right-8 sm:h-12 sm:w-12 ${overlayOpacityClass} ${overlayInteractionClass}`}
        onClick={(event) => {
          event.stopPropagation();
          handleNext();
        }}
        aria-label="Next photo"
      >
        <ChevronRight className="h-7 w-7 stroke-1.5 sm:h-9 sm:w-9" />
      </button>

      <div
        className="relative flex h-full w-full cursor-default items-center justify-center px-4 py-4"
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
        {currentImageUrl ? (
          <div
            ref={photoFrameRef}
            className="relative inline-block max-h-[100svh] max-w-[100vw] cursor-default overflow-hidden transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.2,0.85,0.2,1)] will-change-transform"
            style={{
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
                if (controlsTimerRef.current) {
                  window.clearTimeout(controlsTimerRef.current);
                  controlsTimerRef.current = null;
                }

                setAreControlsVisible(false);
              }
            }}
          >
            <img
              src={currentImageUrl}
              alt={photo.caption || "Photo"}
              width={photo.width ?? undefined}
              height={photo.height ?? undefined}
              className="pointer-events-none block max-h-[100svh] max-w-[100vw] cursor-default select-none object-contain opacity-0"
              decoding="async"
              fetchPriority="high"
              draggable={false}
              onError={handleImageError}
            />

            <div className="absolute inset-0 overflow-hidden">
              <div
                className={`flex h-full w-full ${swipeTrackClass}`}
                style={{
                  transform: `translate3d(calc(-100% + ${dragOffset}px), 0, 0)`,
                }}
              >
                <div className="flex h-full w-full shrink-0 cursor-default items-center justify-center">
                  {previousImageUrl && preloadedUrls.has(previousImageUrl) ? (
                    <img
                      src={previousImageUrl}
                      alt={previousPhoto?.caption || "Previous photo"}
                      className={imageClassName}
                      draggable={false}
                    />
                  ) : null}
                </div>

                <div className="flex h-full w-full shrink-0 cursor-default items-center justify-center">
                  <img
                    src={currentImageUrl}
                    alt={photo.caption || "Photo"}
                    className={imageClassName}
                    decoding="async"
                    fetchPriority="high"
                    draggable={false}
                    onError={handleImageError}
                  />
                </div>

                <div className="flex h-full w-full shrink-0 cursor-default items-center justify-center">
                  {nextImageUrl && preloadedUrls.has(nextImageUrl) ? (
                    <img
                      src={nextImageUrl}
                      alt={nextPhoto?.caption || "Next photo"}
                      className={imageClassName}
                      draggable={false}
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

            <div
              className={`absolute bottom-4 left-4 z-30 flex cursor-default items-center gap-2 rounded-full bg-white/70 px-2 py-1 text-zinc-900 shadow-lg backdrop-blur-md ring-1 ring-zinc-900/10 transition-opacity duration-200 sm:bottom-5 sm:left-5 ${overlayOpacityClass} ${overlayInteractionClass}`}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setAreControlsVisible(true);
                  setIsPlaying((current) => !current);
                }}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full drop-shadow-sm transition hover:bg-zinc-900/10 focus:outline-none focus:ring-2 focus:ring-zinc-900/30"
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
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full drop-shadow-sm transition hover:bg-zinc-900/10 focus:outline-none focus:ring-2 focus:ring-zinc-900/30"
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
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full drop-shadow-sm transition hover:bg-zinc-900/10 focus:outline-none focus:ring-2 focus:ring-zinc-900/30"
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
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full drop-shadow-sm transition hover:bg-zinc-900/10 focus:outline-none focus:ring-2 focus:ring-zinc-900/30 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Download photo"
              >
                <Download className="h-4 w-4 stroke-1.5" />
              </button>
            </div>

            <div
              className={`absolute bottom-4 right-4 z-30 cursor-default transition-opacity duration-200 sm:bottom-5 sm:right-5 ${overlayOpacityClass} ${overlayInteractionClass}`}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setAreControlsVisible(true);
                  setIsPeopleOpen((current) => !current);
                }}
                className="flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-full bg-white/70 px-1 text-zinc-900 shadow-lg backdrop-blur-md ring-1 ring-zinc-900/10 transition hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-zinc-900/30"
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
                            <User className="h-3.5 w-3.5 text-white" />
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
                <div className="absolute bottom-full right-0 mb-3 w-[min(78vw,280px)] cursor-default rounded-xl border border-white/20 bg-white/95 p-2 text-zinc-950 shadow-lg backdrop-blur-md">
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
          <div className="flex h-full w-full cursor-default items-center justify-center bg-zinc-100 text-sm text-zinc-500">
            No preview available
          </div>
        )}
      </div>
    </div>
  );
}

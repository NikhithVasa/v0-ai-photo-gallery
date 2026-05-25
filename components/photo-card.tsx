"use client";

import {
  memo,
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Cast,
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
import { Button } from "@/components/ui/button";
import { photoAspectRatio } from "@/lib/photo-layout";
import type { Photo, PhotoPerson } from "@/lib/types";

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
        className="absolute inset-0 focus:outline-none"
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
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/80 sm:h-9 sm:w-9"
            aria-label="Favorite photo"
          >
            <Heart className="h-5 w-5 stroke-1.5 sm:h-6 sm:w-6" />
          </button>
          <a
            href={`mailto:?subject=Photo&body=${encodeURIComponent(
              photo.thumbnailUrl || photo.previewUrl || photo.downloadUrl
                ? absoluteBrowserUrl(
                    photo.thumbnailUrl || photo.previewUrl || photo.downloadUrl || ""
                  )
                : ""
            )}`}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/80 sm:h-9 sm:w-9"
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
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/80 sm:h-9 sm:w-9"
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
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/80 disabled:cursor-not-allowed disabled:opacity-45 sm:h-9 sm:w-9"
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

function SelectedPhotoPeoplePanel({
  photo,
  people,
  onPersonClick,
}: {
  photo: Photo;
  people: PhotoPerson[];
  onPersonClick?: (personId: string) => void;
}) {
  return (
    <aside className="flex h-full flex-col gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-400">
          {photo.eventName}
        </p>
        <h2 className="mt-1 truncate text-base font-semibold text-zinc-950">
          {photo.fileName || "Selected photo"}
        </h2>
      </div>

      <div className="h-px bg-zinc-200" />

      <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-400">
        People
      </p>

      {people.length ? (
        <div className="space-y-1.5">
          {people.map((person) => {
            const displayName = person.displayName || person.defaultName;
            const countLabel = `appears in ${person.photoCount} ${
              person.photoCount === 1 ? "photo" : "photos"
            }`;
            const content = (
              <>
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200">
                  {person.coverFaceUrl ? (
                    <img
                      src={person.coverFaceUrl}
                      alt={displayName}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-zinc-400">
                      <User className="h-5 w-5" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900">
                    {displayName}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">
                    Person {person.personNumber || "-"} · {countLabel}
                  </span>
                </span>
              </>
            );

            if (!onPersonClick) {
              return (
                <div
                  key={person.id}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2"
                >
                  {content}
                </div>
              );
            }

            return (
              <button
                key={person.id}
                type="button"
                onClick={() => onPersonClick(person.id)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition hover:bg-zinc-950/[0.04] focus:outline-none focus:ring-2 focus:ring-zinc-300"
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border border-zinc-200 bg-white/70 px-3 py-3 text-sm text-zinc-500">
          No people detected in this photo.
        </p>
      )}
    </aside>
  );
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
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [signedUrls, setSignedUrls] = useState<Record<string, SignedPhotoUrls>>(
    {}
  );
  const [entryStyle, setEntryStyle] = useState<CSSProperties>();
  const photoFrameRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
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
    setActiveImageIndex(0);
    setIsPeopleOpen(false);
  }, [photo.id]);

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
      onNavigate(currentIndex < photos.length - 1 ? currentIndex + 1 : 0);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [currentIndex, isPlaying, onNavigate, photos.length]);

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

  const handlePrev = () => {
    setIsPeopleOpen(false);
    onNavigate(currentIndex > 0 ? currentIndex - 1 : photos.length - 1);
  };

  const handleNext = () => {
    setIsPeopleOpen(false);
    onNavigate(currentIndex < photos.length - 1 ? currentIndex + 1 : 0);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") handlePrev();
    if (e.key === "ArrowRight") handleNext();
    if (e.key === "Escape") onClose();
  };

  const handlePersonClick = (personId: string) => {
    onPersonClick?.(personId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white md:bg-white/[0.92] md:px-6 md:py-4 md:pl-80 md:text-zinc-950 md:backdrop-blur-[1px]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="absolute left-3 top-3 z-30 flex items-center gap-2 text-white md:text-zinc-700 sm:left-6 sm:top-5 sm:gap-3">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-black/30 focus:outline-none focus:ring-2 focus:ring-white/60 md:bg-transparent md:text-zinc-700 md:hover:bg-zinc-950/5 md:focus:ring-zinc-400"
          aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
          aria-pressed={isPlaying}
          onClick={(e) => {
            e.stopPropagation();
            setIsPlaying((current) => !current);
          }}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </button>
        <span className="hidden text-sm font-medium md:inline">
          {isPlaying ? "Playing" : "Play"}
        </span>
      </div>

      <div
        className="absolute bottom-5 left-4 top-16 z-10 hidden w-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white/75 p-4 shadow-sm backdrop-blur-md md:block"
        onClick={(e) => e.stopPropagation()}
      >
        <SelectedPhotoPeoplePanel
          photo={photo}
          people={photoPeople}
          onPersonClick={onPersonClick ? handlePersonClick : undefined}
        />
      </div>

      <div className="absolute right-3 top-3 z-30 sm:right-6 sm:top-5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full bg-black/20 text-white backdrop-blur hover:bg-black/30 hover:text-white md:bg-transparent md:text-zinc-600 md:hover:bg-zinc-950/5 md:hover:text-zinc-950"
          aria-label="Close photo"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <button
        type="button"
        className="absolute left-1 top-1/2 z-20 hidden -translate-y-1/2 rounded-full p-1 text-zinc-300 transition hover:bg-zinc-950/5 hover:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-300 md:block sm:left-8 sm:p-2"
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
        className="absolute right-1 top-1/2 z-20 hidden -translate-y-1/2 rounded-full p-1 text-zinc-300 transition hover:bg-zinc-950/5 hover:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-300 md:block sm:right-8 sm:p-2"
        onClick={(e) => {
          e.stopPropagation();
          handleNext();
        }}
        aria-label="Next photo"
      >
        <ChevronRight className="h-10 w-10 stroke-1 sm:h-14 sm:w-14" />
      </button>

      <button
        type="button"
        className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-white/60 md:hidden"
        onClick={(e) => {
          e.stopPropagation();
          handlePrev();
        }}
        aria-label="Previous photo"
      >
        <ChevronLeft className="h-6 w-6 stroke-1.5" />
      </button>

      <button
        type="button"
        className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-white/60 md:hidden"
        onClick={(e) => {
          e.stopPropagation();
          handleNext();
        }}
        aria-label="Next photo"
      >
        <ChevronRight className="h-6 w-6 stroke-1.5" />
      </button>

      <div
        className="relative flex h-full w-full items-center justify-center md:h-auto md:max-h-[calc(100vh-4rem)] md:max-w-[min(92vw,1180px)] md:flex-col"
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
            className="relative flex h-full w-full items-center justify-center transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.2,0.85,0.2,1)] will-change-transform md:h-auto md:w-auto"
            style={entryStyle}
          >
            <img
              src={imageUrl}
              alt={photo.caption || "Photo"}
              width={photo.width ?? undefined}
              height={photo.height ?? undefined}
              className="block max-h-[100svh] max-w-screen object-contain md:max-h-[calc(100vh-8rem)] md:max-w-[min(92vw,1180px)] md:shadow-sm"
              decoding="async"
              fetchPriority="high"
              onError={handleImageError}
            />

            {photo.caption && (
              <div className="absolute inset-x-0 bottom-24 hidden justify-center px-4 md:flex md:bottom-3">
                <p className="max-w-[min(92%,44rem)] rounded-md bg-black/70 px-3 py-1.5 text-center text-xs font-medium leading-snug text-white shadow-sm">
                  {photo.caption}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500 md:h-[60vh] md:w-[min(92vw,900px)]">
            No preview available
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/65 via-black/20 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-20 md:hidden">
          <div className="pointer-events-auto flex items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-white/60"
                aria-label="Favorite photo"
              >
                <Heart className="h-5 w-5 stroke-1.5" />
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-white/60"
                aria-label="Share photo"
              >
                <Share2 className="h-5 w-5 stroke-1.5" />
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Download photo"
              >
                <Download className="h-5 w-5 stroke-1.5" />
              </button>
            </div>

            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setIsPeopleOpen((current) => !current)}
                className="flex h-10 min-w-10 items-center justify-center rounded-full bg-black/25 px-2 text-white backdrop-blur transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-white/60"
                aria-expanded={isPeopleOpen}
                aria-label="Show people in this photo"
              >
                {photoPeople.length ? (
                  <span className="flex -space-x-2">
                    {photoPeople.slice(0, 3).map((person) => (
                      <span
                        key={person.id}
                        className="relative h-7 w-7 overflow-hidden rounded-full bg-zinc-800 ring-1 ring-white/80"
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
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-zinc-950/[0.05] focus:outline-none focus:ring-2 focus:ring-zinc-300"
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

        <div className="mt-2 hidden max-w-[min(92vw,1180px)] truncate px-4 text-center text-sm font-medium text-zinc-700 md:block">
          {photoName}
        </div>

        <div className="mt-2 hidden items-center justify-center gap-3 text-zinc-600 md:flex sm:gap-5">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            aria-label="Favorite photo"
          >
            <Heart className="h-5 w-5 stroke-1.5" />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            aria-label="Email photo"
          >
            <Mail className="h-5 w-5 stroke-1.5" />
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            aria-label="Share photo"
          >
            <Share2 className="h-5 w-5 stroke-1.5" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Download photo"
          >
            <Download className="h-5 w-5 stroke-1.5" />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            aria-label="Cast photo"
          >
            <Cast className="h-5 w-5 stroke-1.5" />
          </button>
        </div>
      </div>

      <div className="absolute bottom-5 right-6 hidden text-sm font-medium text-zinc-400 md:block">
        {currentIndex + 1} / {photos.length}
      </div>
    </div>
  );
}

"use client";

import { memo, useEffect, useState } from "react";
import {
  Cast,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Mail,
  Play,
  Share2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { photoAspectRatio } from "@/lib/photo-layout";
import type { Photo } from "@/lib/types";

interface SignedPhotoUrls {
  previewUrl: string | null;
  downloadUrl: string | null;
}

async function fetchSignedPhotoUrls(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.length) return {};

  const response = await fetch("/api/photos/signed-urls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: uniqueIds }),
  });

  if (!response.ok) return {};

  const data = (await response.json()) as {
    photos?: Array<{ id: string } & SignedPhotoUrls>;
  };

  return Object.fromEntries(
    (data.photos ?? []).map((photo) => [
      photo.id,
      {
        previewUrl: photo.previewUrl,
        downloadUrl: photo.downloadUrl,
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

interface PhotoCardProps {
  photo: Photo;
  index: number;
  onOpen: (index: number) => void;
}

export const PhotoCard = memo(function PhotoCard({
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
        photo.downloadUrl ? null : await fetchSignedPhotoUrls([photo.id]);
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
    const shareUrl = photo.thumbnailUrl || photo.previewUrl || photo.downloadUrl;
    if (!shareUrl) return;

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
        onClick={() => onOpen(index)}
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
            loading={index < 24 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={index < 8 ? "high" : "auto"}
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
              photo.thumbnailUrl || photo.previewUrl || photo.downloadUrl || ""
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
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function PhotoLightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate,
}: PhotoLightboxProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, SignedPhotoUrls>>(
    {}
  );
  const photo = photos[currentIndex];
  const signedPhoto = signedUrls[photo.id];
  const imageUrl = signedPhoto?.previewUrl || photo.previewUrl || photo.thumbnailUrl;
  const downloadUrl = signedPhoto?.downloadUrl || photo.downloadUrl;
  const photoName = photo.fileName || `Photo ${currentIndex + 1}`;

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

    fetchSignedPhotoUrls(ids).then((urlsById) => {
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
  }, [currentIndex, photos, signedUrls]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      let url = downloadUrl;
      if (!url) {
        const urlsById = await fetchSignedPhotoUrls([photo.id]);
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
    onNavigate(currentIndex > 0 ? currentIndex - 1 : photos.length - 1);
  };

  const handleNext = () => {
    onNavigate(currentIndex < photos.length - 1 ? currentIndex + 1 : 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") handlePrev();
    if (e.key === "ArrowRight") handleNext();
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/[0.92] px-3 py-4 backdrop-blur-[1px] sm:bg-white/[0.94] sm:px-6"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2 text-zinc-700 sm:left-6 sm:top-5 sm:gap-3">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-zinc-950/5 focus:outline-none focus:ring-2 focus:ring-zinc-400 sm:h-9 sm:w-9"
          aria-label="Play slideshow"
          onClick={(e) => e.stopPropagation()}
        >
          <Play className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium">Play</span>
      </div>

      <div className="absolute right-3 top-3 z-10 sm:right-6 sm:top-5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-950"
          aria-label="Close photo"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <button
        type="button"
        className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full p-1 text-zinc-300 transition hover:bg-zinc-950/5 hover:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-300 sm:left-8 sm:p-2"
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
        className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full p-1 text-zinc-300 transition hover:bg-zinc-950/5 hover:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-300 sm:right-8 sm:p-2"
        onClick={(e) => {
          e.stopPropagation();
          handleNext();
        }}
        aria-label="Next photo"
      >
        <ChevronRight className="h-10 w-10 stroke-1 sm:h-14 sm:w-14" />
      </button>

      <div
        className="flex max-h-[calc(100svh-2rem)] max-w-[min(94vw,1180px)] flex-col items-center justify-center sm:max-h-[calc(100vh-4rem)] sm:max-w-[min(92vw,1180px)]"
        onClick={(e) => e.stopPropagation()}
      >
        {imageUrl ? (
          <div className="relative">
            <img
              src={imageUrl}
              alt={photo.caption || "Photo"}
              width={photo.width ?? undefined}
              height={photo.height ?? undefined}
              className="block max-h-[calc(100svh-11rem)] max-w-[min(94vw,1180px)] object-contain shadow-sm sm:max-h-[calc(100vh-8rem)] sm:max-w-[min(92vw,1180px)]"
              decoding="async"
              fetchPriority="high"
            />

            {photo.caption && (
              <div className="absolute inset-x-0 bottom-3 flex justify-center px-4">
                <p className="max-w-[min(92%,44rem)] rounded-md bg-black/70 px-3 py-1.5 text-center text-xs font-medium leading-snug text-white shadow-sm">
                  {photo.caption}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-[60vh] w-[min(92vw,900px)] items-center justify-center bg-zinc-100">
            <span className="text-sm text-zinc-500">No preview available</span>
          </div>
        )}

        <div className="mt-2 max-w-[min(92vw,1180px)] truncate px-4 text-center text-sm font-medium text-zinc-700">
          {photoName}
        </div>

        <div className="mt-2 flex items-center justify-center gap-3 text-zinc-600 sm:gap-5">
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

      <div className="absolute bottom-5 right-6 text-sm font-medium text-zinc-400">
        {currentIndex + 1} / {photos.length}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import useSWR from "swr";
import { PhotoCard, PhotoLightbox, type PhotoOpenRect } from "./photo-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cloudFrontImageUrl } from "@/lib/cloudfront-url";
import { photoAspectRatio } from "@/lib/photo-layout";
import type {
  AlbumEvent,
  AlbumShareSettings,
  Person,
  Photo,
  PhotoPerson,
} from "@/lib/types";

export type PeopleMatchMode = "all" | "any";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

const swrOptions = {
  dedupingInterval: 60 * 60 * 1000,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

interface PhotosGridProps {
  albumSlug: string;
  shareToken?: string;
  selectedEventSlug: string | null;
  selectedPeopleIds: string[];
  peopleMatchMode: PeopleMatchMode;
  onPersonClick?: (personId: string) => void;
  onPhotoPersonClick?: (person: PhotoPerson, photoId: string) => void;
  openPhotoId?: string | null;
  onOpenPhotoHandled?: () => void;
  onReachedEnd?: () => void;
  isSelectionMode?: boolean;
  selectedPhotoIds?: string[];
  onTogglePhoto?: (photoId: string) => void;
  events?: AlbumEvent[];
  people?: Person[];
  canManagePeople?: boolean;
  onPeopleChanged?: () => void | Promise<void>;
  shareSettings?: AlbumShareSettings | null;
}

function photosUrl(
  albumSlug: string,
  shareToken: string,
  selectedEventSlug: string | null,
  selectedPeopleIds: string[],
  peopleMatchMode: PeopleMatchMode,
) {
  const base = `/api/albums/${encodeURIComponent(albumSlug)}/photos`;
  const params = new URLSearchParams();

  if (selectedEventSlug) params.set("event", selectedEventSlug);
  if (shareToken) params.set("share", shareToken);

  if (selectedPeopleIds.length) {
    params.set("people", selectedPeopleIds.join(","));
  }

  if (selectedPeopleIds.length > 1) {
    params.set("peopleMode", peopleMatchMode);
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

function SelectionPhotoCell({
  photo,
  index,
  isSelected,
  onTogglePhoto,
}: {
  photo: Photo;
  index: number;
  isSelected: boolean;
  onTogglePhoto?: (photoId: string) => void;
}) {
  const imageCandidates = useMemo(
    () =>
      Array.from(
        new Set(
          [
            photo.previewUrl,
            photo.thumbnailUrl,
            photo.cleanPreviewS3Key
              ? `/api/media?key=${encodeURIComponent(photo.cleanPreviewS3Key)}`
              : null,
            photo.watermarkedPreviewS3Key
              ? `/api/media?key=${encodeURIComponent(photo.watermarkedPreviewS3Key)}`
              : null,
            photo.thumbnailS3Key
              ? `/api/media?key=${encodeURIComponent(photo.thumbnailS3Key)}`
              : null,
            photo.aiInputS3Key
              ? `/api/media?key=${encodeURIComponent(photo.aiInputS3Key)}`
              : null,
            cloudFrontImageUrl(photo.cleanPreviewS3Key),
            cloudFrontImageUrl(photo.watermarkedPreviewS3Key),
            cloudFrontImageUrl(photo.thumbnailS3Key),
            cloudFrontImageUrl(photo.aiInputS3Key),
          ].filter((url): url is string => Boolean(url)),
        ),
      ),
    [photo],
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const imageUrl = imageCandidates[activeImageIndex] || "";
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [photo.id]);

  useEffect(() => {
    setIsImageLoaded(false);
  }, [imageUrl]);

  return (
    <button
      type="button"
      onClick={() => onTogglePhoto?.(photo.id)}
      aria-pressed={isSelected}
      className={`group relative w-full cursor-pointer overflow-hidden rounded-[22px] bg-white text-left ring-1 transition focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
        isSelected
          ? "ring-2 ring-zinc-950"
          : "ring-border hover:ring-zinc-400"
      }`}
      style={{ aspectRatio: photoAspectRatio(photo) }}
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={photo.caption || photo.fileName || "Photo"}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
              isImageLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading={index < 12 ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setIsImageLoaded(true)}
            onError={() => {
              setActiveImageIndex((current) => {
                if (current < imageCandidates.length - 1) return current + 1;

                setIsImageLoaded(true);
                return current;
              });
            }}
          />
          {!isImageLoaded && (
            <Skeleton className="absolute inset-0 rounded-[22px] bg-zinc-200/80" />
          )}
        </>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          No preview
        </span>
      )}

      <span
        className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full shadow-sm ${
          isSelected ? "bg-zinc-950 text-white" : "bg-white/90 text-zinc-400"
        }`}
      >
        <Check className="h-4 w-4" />
      </span>
    </button>
  );
}

export function PhotosGrid({
  albumSlug,
  shareToken = "",
  selectedEventSlug,
  selectedPeopleIds,
  peopleMatchMode,
  onPersonClick,
  onPhotoPersonClick,
  openPhotoId,
  onOpenPhotoHandled,
  onReachedEnd,
  isSelectionMode = false,
  selectedPhotoIds = [],
  onTogglePhoto,
  events,
  people = [],
  canManagePeople = false,
  onPeopleChanged,
  shareSettings,
}: PhotosGridProps) {
  const photosRequestUrl = useMemo(
    () =>
      photosUrl(
        albumSlug,
        shareToken,
        selectedEventSlug,
        selectedPeopleIds,
        peopleMatchMode,
      ),
    [albumSlug, shareToken, selectedEventSlug, selectedPeopleIds, peopleMatchMode],
  );

  const { data, error, isLoading, mutate } = useSWR<{ photos: Photo[] }>(
    photosRequestUrl,
    fetcher,
    swrOptions,
  );

  const [lightboxState, setLightboxState] = useState<{
    index: number;
    originRect?: PhotoOpenRect;
  } | null>(null);
  const selectedPhotoIdSet = useMemo(
    () => new Set(selectedPhotoIds),
    [selectedPhotoIds],
  );

  const endSentinelRef = useRef<HTMLDivElement | null>(null);
  const lastTriggeredKeyRef = useRef<string | null>(null);

  const triggerKey = useMemo(
    () =>
      [
        albumSlug,
        selectedEventSlug ?? "all",
        selectedPeopleIds.join(","),
        peopleMatchMode,
        data?.photos?.length ?? 0,
      ].join(":"),
    [
      albumSlug,
      selectedEventSlug,
      selectedPeopleIds,
      peopleMatchMode,
      data?.photos?.length,
    ],
  );

  const handleOpen = useCallback((index: number, originRect: PhotoOpenRect) => {
    setLightboxState({ index, originRect });
  }, []);

  const handleNavigate = useCallback((index: number) => {
    setLightboxState({ index });
  }, []);

  useEffect(() => {
    if (!openPhotoId || !data?.photos?.length) return;

    const index = data.photos.findIndex((photo) => photo.id === openPhotoId);
    if (index >= 0) {
      setLightboxState({ index });
    }

    onOpenPhotoHandled?.();
  }, [data?.photos, onOpenPhotoHandled, openPhotoId]);

  useEffect(() => {
    if (!onReachedEnd) return;
    if (isLoading) return;
    if (!data?.photos?.length) return;

    const sentinel = endSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        if (lastTriggeredKeyRef.current === triggerKey) return;
        lastTriggeredKeyRef.current = triggerKey;

        onReachedEnd();
      },
      {
        root: null,
        rootMargin: "500px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [data?.photos?.length, isLoading, onReachedEnd, triggerKey]);

  if (error) {
    console.error("Photos loading error:", error);
    return (
      <div className="rounded-[28px] border border-white/70 bg-white/85 px-6 py-12 text-center shadow-[0_18px_55px_rgba(0,0,0,0.10)] backdrop-blur-xl">
        <p className="text-sm font-medium text-rose-700">
          Failed to load photos
        </p>
        <p className="mt-1 text-xs text-rose-600">
          {error?.message || "Please check your database connection and try again."}
        </p>
        <button
          onClick={() => {
            // Trigger manual refresh by changing a dummy dependency
            window.location.reload();
          }}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-xs font-medium text-rose-700 shadow-sm ring-1 ring-inset ring-rose-200 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="columns-2 gap-2 sm:columns-2 sm:gap-3 lg:columns-3">
        {Array.from({ length: 14 }).map((_, index) => (
          <div key={index} className="mb-2 break-inside-avoid sm:mb-3">
            <Skeleton
              className={`w-full rounded-[22px] bg-white/70 shadow-[0_16px_45px_rgba(0,0,0,0.08)] ${
                index % 6 === 0
                  ? "h-56 sm:h-80"
                  : index % 4 === 0
                    ? "h-44 sm:h-64"
                    : index % 3 === 0
                      ? "h-64 sm:h-96"
                      : "h-48 sm:h-72"
              }`}
            />
          </div>
        ))}
      </div>
    );
  }

  if (!data?.photos?.length) {
    return (
      <div className="rounded-[28px] border border-white/70 bg-white/85 px-6 py-12 text-center text-zinc-500 shadow-[0_18px_55px_rgba(0,0,0,0.10)] backdrop-blur-xl">
        {selectedPeopleIds.length
          ? peopleMatchMode === "any" && selectedPeopleIds.length > 1
            ? "No photos found for any of the selected people."
            : "No photos found with all selected people."
          : selectedEventSlug
            ? "No photos found for this event yet."
            : "No photos found in this album yet."}
      </div>
    );
  }

  return (
    <>
      <div className="columns-2 gap-2 sm:columns-2 sm:gap-3 lg:columns-3">
        {data.photos.map((photo, index) => (
          <div
            key={photo.id}
            className="mb-2 break-inside-avoid overflow-hidden rounded-[22px] shadow-[0_16px_45px_rgba(0,0,0,0.12)] ring-1 ring-white/70 transition-transform duration-300 ease-out hover:-translate-y-1.5 sm:mb-3"
          >
            {isSelectionMode ? (
              <SelectionPhotoCell
                photo={photo}
                index={index}
                isSelected={selectedPhotoIdSet.has(photo.id)}
                onTogglePhoto={onTogglePhoto}
              />
            ) : (
              <PhotoCard
                albumSlug={albumSlug}
                shareToken={shareToken}
                photo={photo}
                index={index}
                onOpen={handleOpen}
                shareSettings={shareSettings}
              />
            )}
          </div>
        ))}
      </div>

      <div ref={endSentinelRef} className="h-px w-full" />

      {lightboxState !== null && !isSelectionMode && (
        <PhotoLightbox
          albumSlug={albumSlug}
          shareToken={shareToken}
          photos={data.photos}
          currentIndex={lightboxState.index}
          events={events}
          allPeople={people}
          canManagePeople={canManagePeople}
          originRect={lightboxState.originRect}
          onClose={() => setLightboxState(null)}
          onNavigate={handleNavigate}
          onPersonClick={(person) => {
            const sourcePhoto = data.photos[lightboxState.index];
            if (onPhotoPersonClick && sourcePhoto) {
              onPhotoPersonClick(person, sourcePhoto.id);
              return;
            }

            onPersonClick?.(person.id);
          }}
          onPeopleChanged={async () => {
            await mutate();
            await onPeopleChanged?.();
          }}
          shareSettings={shareSettings}
        />
      )}
    </>
  );
}

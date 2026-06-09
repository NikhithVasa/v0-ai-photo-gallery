"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Check, Loader2, Pencil } from "lucide-react";
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
  PhotoSortMode,
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

const PHOTO_SORT_OPTIONS: Array<{ value: PhotoSortMode; label: string }> = [
  { value: "title_asc", label: "Title (A-Z)" },
  { value: "title_desc", label: "Title (Z-A)" },
  { value: "added_newest", label: "Added date (Newest)" },
  { value: "added_oldest", label: "Added date (Oldest)" },
  { value: "original_newest", label: "Original date (Newest)" },
  { value: "original_oldest", label: "Original date (Oldest)" },
  { value: "rating", label: "Rating" },
  { value: "custom", label: "Custom" },
];

const DEFAULT_SORT_MODE: PhotoSortMode = "added_oldest";
const RESET_SORT_MODE: PhotoSortMode = "added_newest";

function sortLabel(sortMode: PhotoSortMode) {
  return (
    PHOTO_SORT_OPTIONS.find((option) => option.value === sortMode)?.label ??
    "Added date (Oldest)"
  );
}

function dateMs(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function titleValue(photo: Photo) {
  return (photo.caption || photo.fileName || "").trim().toLowerCase();
}

function withCustomPositions(photos: Photo[]) {
  return photos.map((photo, index) => ({
    ...photo,
    customSortOrder: index + 1,
  }));
}

function sortPhotos(photos: Photo[], sortMode: PhotoSortMode) {
  const indexed = photos.map((photo, index) => ({ photo, index }));

  indexed.sort((a, b) => {
    switch (sortMode) {
      case "title_asc":
        return (
          titleValue(a.photo).localeCompare(titleValue(b.photo)) ||
          a.index - b.index
        );
      case "title_desc":
        return (
          titleValue(b.photo).localeCompare(titleValue(a.photo)) ||
          a.index - b.index
        );
      case "added_newest":
        return dateMs(b.photo.createdAt) - dateMs(a.photo.createdAt) || b.index - a.index;
      case "original_newest":
        return (
          dateMs(b.photo.originalDate || b.photo.createdAt) -
            dateMs(a.photo.originalDate || a.photo.createdAt) ||
          b.index - a.index
        );
      case "original_oldest":
        return (
          dateMs(a.photo.originalDate || a.photo.createdAt) -
            dateMs(b.photo.originalDate || b.photo.createdAt) ||
          a.index - b.index
        );
      case "rating": {
        const aRating = a.photo.rating ?? Number.NEGATIVE_INFINITY;
        const bRating = b.photo.rating ?? Number.NEGATIVE_INFINITY;
        return bRating - aRating || a.index - b.index;
      }
      case "custom":
        return (
          (a.photo.customSortOrder ?? a.index + 1) -
            (b.photo.customSortOrder ?? b.index + 1) ||
          a.index - b.index
        );
      case "added_oldest":
      default:
        return dateMs(a.photo.createdAt) - dateMs(b.photo.createdAt) || a.index - b.index;
    }
  });

  return indexed.map((item) => item.photo);
}

function positionsPayload(photos: Photo[]) {
  return photos.map((photo, index) => ({
    photoId: photo.id,
    position: index + 1,
  }));
}

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
  canManageSort?: boolean;
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

function CustomPositionControl({
  position,
  onCommit,
  disabled,
}: {
  position: number;
  onCommit: (position: number) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState(String(position));

  useEffect(() => {
    setValue(String(position));
  }, [position]);

  const commit = () => {
    const nextPosition = Number.parseInt(value, 10);
    if (!Number.isFinite(nextPosition)) {
      setValue(String(position));
      return;
    }
    onCommit(nextPosition);
  };

  return (
    <label className="absolute left-2 top-2 z-20 flex items-center gap-1.5 rounded-full bg-white/92 px-2 py-1 text-[11px] font-semibold text-zinc-700 shadow-sm ring-1 ring-black/10 backdrop-blur">
      <span>Position</span>
      <input
        type="number"
        min={1}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        className="h-6 w-12 rounded-full border border-zinc-200 bg-white px-2 text-center text-xs font-semibold text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:opacity-60"
        aria-label={`Position ${position}`}
      />
    </label>
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
  canManageSort = false,
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

  const { data, error, isLoading, mutate } = useSWR<{
    photos: Photo[];
    sortMode: PhotoSortMode;
  }>(
    photosRequestUrl,
    fetcher,
    swrOptions,
  );
  const [isSavingSort, setIsSavingSort] = useState(false);
  const [sortError, setSortError] = useState("");
  const [isCustomOrderEditing, setIsCustomOrderEditing] = useState(false);
  const savedCustomPhotosRef = useRef<Photo[] | null>(null);

  const [lightboxState, setLightboxState] = useState<{
    index: number;
    originRect?: PhotoOpenRect;
  } | null>(null);
  const selectedPhotoIdSet = useMemo(
    () => new Set(selectedPhotoIds),
    [selectedPhotoIds],
  );
  const activeSortMode = data?.sortMode ?? DEFAULT_SORT_MODE;
  const canEditSort =
    canManageSort && selectedPeopleIds.length === 0 && !isSelectionMode;

  const saveSort = useCallback(
    async (sortMode: PhotoSortMode, photos: Photo[]) => {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/photos/sort`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventSlug: selectedEventSlug,
            sortMode,
            positions: sortMode === "custom" ? positionsPayload(photos) : undefined,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to save sort");
      }
    },
    [albumSlug, selectedEventSlug],
  );

  const applySortMode = useCallback(
    async (sortMode: PhotoSortMode) => {
      if (!data?.photos?.length || !canEditSort) return;

      const previous = data;
      const sorted = sortPhotos(data.photos, sortMode);
      const nextPhotos =
        sortMode === "custom" ? withCustomPositions(sorted) : sorted;

      setSortError("");
      await mutate({ photos: nextPhotos, sortMode }, { revalidate: false });

      if (sortMode === "custom") {
        savedCustomPhotosRef.current = previous.photos;
        setIsCustomOrderEditing(true);
        return;
      }

      setIsCustomOrderEditing(false);
      savedCustomPhotosRef.current = null;
      setIsSavingSort(true);
      try {
        await saveSort(sortMode, nextPhotos);
      } catch (error) {
        console.error("Failed to save photo sort:", error);
        setSortError(
          error instanceof Error ? error.message : "Failed to save sort",
        );
        await mutate(previous, { revalidate: false });
      } finally {
        setIsSavingSort(false);
      }
    },
    [canEditSort, data, mutate, saveSort],
  );

  const moveCustomPosition = useCallback(
    (photoId: string, rawPosition: number) => {
      if (!data?.photos?.length || !canEditSort || !isCustomOrderEditing) return;

      const currentIndex = data.photos.findIndex((photo) => photo.id === photoId);
      if (currentIndex < 0) return;

      const targetIndex = Math.min(
        Math.max(Math.floor(rawPosition) - 1, 0),
        data.photos.length - 1,
      );
      if (targetIndex === currentIndex) return;

      const nextPhotos = [...data.photos];
      const [moved] = nextPhotos.splice(currentIndex, 1);
      if (!moved) return;
      nextPhotos.splice(targetIndex, 0, moved);

      const rankedPhotos = withCustomPositions(nextPhotos);
      setSortError("");
      void mutate(
        { photos: rankedPhotos, sortMode: "custom" },
        { revalidate: false },
      );
    },
    [canEditSort, data, isCustomOrderEditing, mutate],
  );

  const saveCustomOrder = useCallback(async () => {
    if (!data?.photos?.length || !canEditSort) return;

    setSortError("");
    setIsSavingSort(true);
    const rankedPhotos = withCustomPositions(data.photos);
    await mutate(
      { photos: rankedPhotos, sortMode: "custom" },
      { revalidate: false },
    );

    try {
      await saveSort("custom", rankedPhotos);
      setIsCustomOrderEditing(false);
      savedCustomPhotosRef.current = null;
    } catch (error) {
      console.error("Failed to save custom photo sort:", error);
      setSortError(
        error instanceof Error ? error.message : "Failed to save custom order",
      );
      if (savedCustomPhotosRef.current) {
        await mutate(
          { photos: savedCustomPhotosRef.current, sortMode: activeSortMode },
          { revalidate: false },
        );
      }
    } finally {
      setIsSavingSort(false);
    }
  }, [activeSortMode, canEditSort, data, mutate, saveSort]);

  const startCustomOrderEditing = useCallback(() => {
    if (!data?.photos?.length || !canEditSort) return;

    savedCustomPhotosRef.current = data.photos;
    setSortError("");
    setIsCustomOrderEditing(true);
    if (activeSortMode !== "custom") {
      void applySortMode("custom");
    }
  }, [activeSortMode, applySortMode, canEditSort, data]);

  const cancelCustomOrderEditing = useCallback(async () => {
    if (savedCustomPhotosRef.current) {
      await mutate(
        { photos: savedCustomPhotosRef.current, sortMode: activeSortMode },
        { revalidate: false },
      );
    }

    savedCustomPhotosRef.current = null;
    setIsCustomOrderEditing(false);
    setSortError("");
  }, [activeSortMode, mutate]);

  const resetSort = useCallback(async () => {
    if (!data?.photos?.length || !canEditSort) return;

    savedCustomPhotosRef.current = null;
    setIsCustomOrderEditing(false);
    await applySortMode(RESET_SORT_MODE);
  }, [applySortMode, canEditSort, data]);

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
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        {Array.from({ length: 14 }).map((_, index) => (
          <div key={index}>
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
      {canEditSort && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2 sm:px-0">
          <label className="flex h-10 max-w-full items-center gap-2 rounded-full bg-white/85 px-3 text-sm font-medium text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-inset ring-black/10 backdrop-blur">
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className="shrink-0">Sort</span>
            <select
              value={activeSortMode}
              onChange={(event) =>
                void applySortMode(event.target.value as PhotoSortMode)
              }
              disabled={isSavingSort}
              className="min-w-0 cursor-pointer bg-transparent text-sm font-semibold text-zinc-950 outline-none disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Sort photos"
            >
              {PHOTO_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {isSavingSort && <Loader2 className="h-4 w-4 animate-spin" />}
          </label>

          {activeSortMode === "custom" &&
            (isCustomOrderEditing ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void resetSort()}
                  disabled={isSavingSort}
                  className="h-9 rounded-full bg-white/80 px-3 text-sm font-semibold text-zinc-600 shadow-sm ring-1 ring-inset ring-black/10 transition hover:bg-white hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reset Sort
                </button>
                <button
                  type="button"
                  onClick={() => void cancelCustomOrderEditing()}
                  disabled={isSavingSort}
                  className="h-9 rounded-full bg-white/80 px-3 text-sm font-semibold text-zinc-600 shadow-sm ring-1 ring-inset ring-black/10 transition hover:bg-white hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveCustomOrder()}
                  disabled={isSavingSort}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-zinc-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingSort ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Save Order
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void resetSort()}
                  disabled={isSavingSort}
                  className="h-9 rounded-full bg-white/80 px-3 text-sm font-semibold text-zinc-600 shadow-sm ring-1 ring-inset ring-black/10 transition hover:bg-white hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reset Sort
                </button>
                <button
                  type="button"
                  onClick={startCustomOrderEditing}
                  disabled={isSavingSort}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-white/85 px-3 text-sm font-semibold text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-inset ring-black/10 transition hover:bg-white hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Pencil className="h-4 w-4" />
                  Edit custom order
                </button>
              </div>
            ))}

          {activeSortMode !== RESET_SORT_MODE && activeSortMode !== "custom" && (
            <button
              type="button"
              onClick={() => void resetSort()}
              disabled={isSavingSort}
              className="h-9 rounded-full bg-white/80 px-3 text-sm font-semibold text-zinc-600 shadow-sm ring-1 ring-inset ring-black/10 transition hover:bg-white hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset Sort
            </button>
          )}

          {sortError ? (
            <p className="text-sm font-medium text-rose-600">{sortError}</p>
          ) : (
            <p className="text-sm font-medium text-zinc-500">
              {isCustomOrderEditing
                ? "Editing custom order"
                : sortLabel(activeSortMode)}
            </p>
          )}
        </div>
      )}

      <div
        className={
          isCustomOrderEditing
            ? "grid grid-cols-2 items-start gap-2 sm:gap-3 lg:grid-cols-3"
            : "columns-2 gap-2 sm:columns-2 sm:gap-3 lg:columns-3"
        }
      >
        {data.photos.map((photo, index) => (
          <div
            key={photo.id}
            className={`relative overflow-hidden rounded-[22px] shadow-[0_16px_45px_rgba(0,0,0,0.12)] ring-1 ring-white/70 transition-transform duration-300 ease-out hover:-translate-y-1.5 ${
              isCustomOrderEditing ? "aspect-square" : "mb-2 break-inside-avoid sm:mb-3"
            }`}
          >
            {canEditSort && isCustomOrderEditing && (
              <CustomPositionControl
                position={index + 1}
                disabled={isSavingSort}
                onCommit={(position) => {
                  void moveCustomPosition(photo.id, position);
                }}
              />
            )}

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
                forceFill={isCustomOrderEditing}
                imageFit={isCustomOrderEditing ? "cover" : "contain"}
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

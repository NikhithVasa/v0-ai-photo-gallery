"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { PhotoCard, PhotoLightbox, type PhotoOpenRect } from "./photo-card";
import { Skeleton } from "@/components/ui/skeleton";
import { photoAspectRatio, photoFlexBasis } from "@/lib/photo-layout";
import type { Photo } from "@/lib/types";

export type PeopleMatchMode = "all" | "any";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const swrOptions = {
  dedupingInterval: 60 * 60 * 1000,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

interface PhotosGridProps {
  albumSlug: string;
  selectedEventSlug: string | null;
  selectedPeopleIds: string[];
  peopleMatchMode: PeopleMatchMode;
  onPersonClick?: (personId: string) => void;
  onReachedEnd?: () => void;
}

function photosUrl(
  albumSlug: string,
  selectedEventSlug: string | null,
  selectedPeopleIds: string[],
  peopleMatchMode: PeopleMatchMode
) {
  const base = `/api/albums/${encodeURIComponent(albumSlug)}/photos`;
  const params = new URLSearchParams();

  if (selectedEventSlug) params.set("event", selectedEventSlug);
  if (selectedPeopleIds.length) params.set("people", selectedPeopleIds.join(","));
  if (selectedPeopleIds.length > 1) params.set("peopleMode", peopleMatchMode);

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function PhotosGrid({
  albumSlug,
  selectedEventSlug,
  selectedPeopleIds,
  peopleMatchMode,
  onPersonClick,
  onReachedEnd,
}: PhotosGridProps) {
  const photosRequestUrl = useMemo(
    () =>
      photosUrl(
        albumSlug,
        selectedEventSlug,
        selectedPeopleIds,
        peopleMatchMode
      ),
    [albumSlug, selectedEventSlug, selectedPeopleIds, peopleMatchMode]
  );

  const { data, error, isLoading } = useSWR<{ photos: Photo[] }>(
    photosRequestUrl,
    fetcher,
    swrOptions
  );

  const [lightboxState, setLightboxState] = useState<{
    index: number;
    originRect?: PhotoOpenRect;
  } | null>(null);

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
    ]
  );

  const handleOpen = useCallback((index: number, originRect: PhotoOpenRect) => {
    setLightboxState({ index, originRect });
  }, []);

  const handleNavigate = useCallback((index: number) => {
    setLightboxState({ index });
  }, []);

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
      }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [data?.photos?.length, isLoading, onReachedEnd, triggerKey]);

  if (error) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Failed to load photos. Please check your database connection.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-56 min-w-[min(42vw,180px)] flex-1 rounded-md sm:h-72 lg:h-80"
            style={{
              flexBasis:
                i % 5 === 0
                  ? "430px"
                  : i % 3 === 0
                    ? "240px"
                    : i % 2 === 0
                      ? "520px"
                      : "320px",
            }}
          />
        ))}
      </div>
    );
  }

  if (!data?.photos?.length) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white px-6 py-12 text-center text-zinc-500">
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
      <div className="flex flex-wrap gap-2">
        {data.photos.map((photo, index) => (
          <div
            key={photo.id}
            className="min-w-[min(42vw,180px)] max-w-full"
            style={{
              flexBasis: photoFlexBasis(photo),
              flexGrow: photoAspectRatio(photo),
            }}
          >
            <PhotoCard
              albumSlug={albumSlug}
              photo={photo}
              index={index}
              onOpen={handleOpen}
            />
          </div>
        ))}

        <div ref={endSentinelRef} className="h-px flex-[999_1_20rem]" />
      </div>

      {lightboxState !== null && (
        <PhotoLightbox
          albumSlug={albumSlug}
          photos={data.photos}
          currentIndex={lightboxState.index}
          originRect={lightboxState.originRect}
          onClose={() => setLightboxState(null)}
          onNavigate={handleNavigate}
          onPersonClick={onPersonClick}
        />
      )}
    </>
  );
}
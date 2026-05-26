"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { ArrowLeft, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoCard, PhotoLightbox, type PhotoOpenRect } from "./photo-card";
import { Skeleton } from "@/components/ui/skeleton";
import { photoAspectRatio, photoFlexBasis } from "@/lib/photo-layout";
import type { AlbumEvent, Person, Photo } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const swrOptions = {
  dedupingInterval: 60 * 60 * 1000,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

interface PersonViewProps {
  albumSlug: string;
  selectedEventSlug: string | null;
  events: AlbumEvent[];
  person: Person;
  onBack: () => void;
}

function personPhotosUrl(
  albumSlug: string,
  personId: string,
  selectedEventSlug: string | null
) {
  const base = `/api/albums/${encodeURIComponent(
    albumSlug
  )}/people/${encodeURIComponent(personId)}/photos`;

  return selectedEventSlug
    ? `${base}?event=${encodeURIComponent(selectedEventSlug)}`
    : base;
}

export function PersonView({
  albumSlug,
  selectedEventSlug,
  events,
  person,
  onBack,
}: PersonViewProps) {
  const [activeEventSlug, setActiveEventSlug] = useState<string | null>(
    selectedEventSlug
  );

  const { data, error, isLoading } = useSWR<{ photos: Photo[] }>(
    personPhotosUrl(albumSlug, person.id, activeEventSlug),
    fetcher,
    swrOptions
  );

  const [lightboxState, setLightboxState] = useState<{
    index: number;
    originRect?: PhotoOpenRect;
  } | null>(null);

  const handleOpen = useCallback((index: number, originRect: PhotoOpenRect) => {
    setLightboxState({ index, originRect });
  }, []);

  const handleNavigate = useCallback((index: number) => {
    setLightboxState({ index });
  }, []);

  const totalPhotoCount = person.photoCount ?? 0;

  const eventsWithStats = useMemo(() => {
    return events.map((event) => {
      const stat = person.eventStats?.find(
        (item) => item.eventSlug === event.slug
      );

      return {
        event,
        photoCount: stat?.photoCount ?? 0,
      };
    });
  }, [events, person.eventStats]);

  return (
    <div className="space-y-6 px-2 sm:px-0">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="cursor-pointer"
            aria-label="Back to people"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-border bg-muted">
              {person.coverFaceUrl ? (
                <Image
                  src={person.coverFaceUrl}
                  alt={person.displayName || person.defaultName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-secondary">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {person.displayName || person.defaultName}
              </h2>
              <p className="text-sm text-muted-foreground">
                {totalPhotoCount}{" "}
                {totalPhotoCount === 1 ? "photo" : "photos"}
              </p>
            </div>
          </div>
        </div>

        {!!events.length && (
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveEventSlug(null)}
              className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                activeEventSlug === null
                  ? "bg-zinc-950 text-white ring-zinc-950"
                  : "bg-white text-zinc-700 ring-zinc-200 hover:text-zinc-950"
              }`}
            >
              All
              <span className="ml-2 opacity-70">{totalPhotoCount}</span>
            </button>

            {eventsWithStats.map(({ event, photoCount }) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setActiveEventSlug(event.slug)}
                disabled={photoCount === 0}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                  activeEventSlug === event.slug
                    ? "cursor-pointer bg-zinc-950 text-white ring-zinc-950"
                    : photoCount > 0
                      ? "cursor-pointer bg-white text-zinc-700 ring-zinc-200 hover:text-zinc-950"
                      : "cursor-not-allowed bg-zinc-100 text-zinc-400 ring-zinc-200"
                }`}
                title={`${event.name}: ${photoCount} photos`}
              >
                {event.name}
                <span className="ml-2 opacity-70">{photoCount}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="py-12 text-center text-muted-foreground">
          Failed to load photos for this person.
        </div>
      )}

      {isLoading && (
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
      )}

      {data?.photos && (
        <>
          {data.photos.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No photos found for this person.
            </div>
          ) : (
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

              <div className="h-0 flex-[999_1_20rem]" />
            </div>
          )}

          {lightboxState !== null && (
            <PhotoLightbox
              albumSlug={albumSlug}
              photos={data.photos}
              currentIndex={lightboxState.index}
              originRect={lightboxState.originRect}
              onClose={() => setLightboxState(null)}
              onNavigate={handleNavigate}
            />
          )}
        </>
      )}
    </div>
  );
}
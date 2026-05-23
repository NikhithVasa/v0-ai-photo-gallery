"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { ArrowLeft, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoCard, PhotoLightbox } from "./photo-card";
import { Skeleton } from "@/components/ui/skeleton";
import { photoAspectRatio, photoFlexBasis } from "@/lib/photo-layout";
import type { Person, Photo } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const swrOptions = {
  dedupingInterval: 60 * 60 * 1000,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

interface PersonViewProps {
  person: Person;
  onBack: () => void;
}

export function PersonView({ person, onBack }: PersonViewProps) {
  const { data, error, isLoading } = useSWR<{ photos: Photo[] }>(
    `/api/people/${person.id}/photos`,
    fetcher,
    swrOptions
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const handleOpen = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-full overflow-hidden bg-muted border-2 border-border">
            {person.coverFaceUrl ? (
              <Image
                src={person.coverFaceUrl}
                alt={person.displayName || person.defaultName}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-secondary">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {person.displayName || person.defaultName}
            </h2>
            <p className="text-sm text-muted-foreground">
              {person.photoCount} {person.photoCount === 1 ? "photo" : "photos"}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-center py-12 text-muted-foreground">
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
            <div className="text-center py-12 text-muted-foreground">
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
                    photo={photo}
                    index={index}
                    onOpen={handleOpen}
                  />
                </div>
              ))}
              <div className="h-0 flex-[999_1_20rem]" />
            </div>
          )}

          {lightboxIndex !== null && (
            <PhotoLightbox
              photos={data.photos}
              currentIndex={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
              onNavigate={setLightboxIndex}
            />
          )}
        </>
      )}
    </div>
  );
}

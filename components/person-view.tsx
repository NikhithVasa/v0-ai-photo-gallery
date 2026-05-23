"use client";

import { useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { ArrowLeft, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoCard, PhotoLightbox } from "./photo-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Person, Photo } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PersonViewProps {
  person: Person;
  onBack: () => void;
}

export function PersonView({ person, onBack }: PersonViewProps) {
  const { data, error, isLoading } = useSWR<{ photos: Photo[] }>(
    `/api/people/${person.id}/photos`,
    fetcher
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {data.photos.map((photo, index) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  onClick={() => setLightboxIndex(index)}
                />
              ))}
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

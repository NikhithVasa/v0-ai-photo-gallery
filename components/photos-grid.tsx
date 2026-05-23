"use client";

import { useState } from "react";
import useSWR from "swr";
import { PhotoCard, PhotoLightbox } from "./photo-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Photo } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function PhotosGrid() {
  const { data, error, isLoading } = useSWR<{ photos: Photo[] }>(
    "/api/photos",
    fetcher
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load photos. Please check your database connection.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {Array.from({ length: 18 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data?.photos?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No photos found. Make sure your database has photo data.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {data.photos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onClick={() => setLightboxIndex(index)}
          />
        ))}
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={data.photos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}

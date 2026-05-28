"use client";

import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { CalendarDays, Images, Lock, Upload, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlbumSummary } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AlbumStats {
  albumId: string;
  eventCount: number;
  photoCount: number;
  peopleCount: number;
}

export function AlbumsPage() {
  const {
    data: albumsData,
    error: albumsError,
    isLoading: albumsLoading,
  } = useSWR<{ albums: AlbumSummary[] }>("/api/albums", fetcher, {
    dedupingInterval: 0,
    revalidateOnFocus: false,
  });

  const {
    data: statsData,
    error: statsError,
    isLoading: statsLoading,
  } = useSWR<{ stats: AlbumStats[] }>(
    albumsData?.albums?.length ? "/api/albums/stats" : null,
    fetcher,
    {
      dedupingInterval: 0,
      revalidateOnFocus: false,
    }
  );

  // TEMP: Hide Nikhith album from UI only.
  // API still returns it, but this page will not render it.
const SHOW_NIKHITH = true;

const visibleAlbums =
  albumsData?.albums?.filter(
    (album) => SHOW_NIKHITH || album.slug !== "Nikhith"
  ) ?? [];
  const statsByAlbumId = new Map(
    statsData?.stats?.map((item) => [item.albumId, item]) ?? []
  );

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-start justify-between gap-4 sm:mb-10">
          <div>
            <p className="text-sm font-medium text-zinc-500">Albums</p>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-5xl">
              Photo Galleries
            </h1>
          </div>

          <Link
            href="/upload"
            className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <Upload className="h-4 w-4" />
            Upload
          </Link>
        </header>

        {albumsError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm text-rose-700">
            Failed to load albums. Please check the database connection.
          </div>
        )}

        {albumsLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[4/3] rounded-lg" />
            ))}
          </div>
        )}

        {!albumsLoading && !albumsError && !visibleAlbums.length && (
          <div className="rounded-md border border-zinc-200 bg-white px-5 py-12 text-center text-sm text-zinc-500">
            No albums found yet.
          </div>
        )}

        {!!visibleAlbums.length && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleAlbums.map((album) => {
              const stats = statsByAlbumId.get(album.id);

              return (
                <Link
                  key={album.id}
                  href={`/albums/${album.slug}`}
                  className="group overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-400"
                >
                  <div className="relative aspect-[4/3] bg-zinc-100">
                    {album.coverPhotoUrl ? (
                      <Image
                        src={album.coverPhotoUrl}
                        alt={album.name}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                        unoptimized
                        priority
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-400">
                        <Images className="h-10 w-10" strokeWidth={1.5} />
                      </div>
                    )}

                    {album.passwordRequired && (
                      <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-zinc-700 shadow-sm backdrop-blur">
                        <Lock className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 p-4">
                    <div>
                      <h2 className="truncate text-lg font-semibold">
                        {album.name}
                      </h2>
                      <p className="text-sm text-zinc-500">{album.slug}</p>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm text-zinc-600">
                      {statsLoading && !stats ? (
                        <>
                          <Skeleton className="h-5 w-14 rounded-full" />
                          <Skeleton className="h-5 w-14 rounded-full" />
                          <Skeleton className="h-5 w-14 rounded-full" />
                        </>
                      ) : statsError ? (
                        <span className="text-xs text-zinc-400">
                          Stats unavailable
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1.5">
                            <Images className="h-4 w-4" />
                            {stats?.photoCount ?? album.photoCount ?? 0}
                          </span>

                          <span className="inline-flex items-center gap-1.5">
                            <Users className="h-4 w-4" />
                            {stats?.peopleCount ?? album.peopleCount ?? 0}
                          </span>

                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4" />
                            {stats?.eventCount ?? album.eventCount ?? 0}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

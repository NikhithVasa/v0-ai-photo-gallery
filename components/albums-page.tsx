"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { CalendarDays, Images, Lock, Plus, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumPasscodeManager } from "@/components/album-passcode-manager";
import type { AlbumSummary } from "@/lib/types";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

interface AlbumStats {
  albumId: string;
  eventCount: number;
  photoCount: number;
  peopleCount: number;
}

export function AlbumsPage() {
  const [selectedAlbumForPasscode, setSelectedAlbumForPasscode] = useState<{
    slug: string;
    name: string;
  } | null>(null);

  const {
    data: albumsData,
    error: albumsError,
    isLoading: albumsLoading,
    mutate: mutateAlbums,
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
            href="/albums/new"
            className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <Plus className="h-4 w-4" />
            Add Album
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
                <div
                  key={album.id}
                  className="group overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
                >
                  <Link
                    href={`/albums/${album.slug}`}
                    className="block focus:outline-none focus:ring-2 focus:ring-zinc-400"
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

                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedAlbumForPasscode({
                            slug: album.slug,
                            name: album.name,
                          });
                        }}
                        className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400 ${
                          album.passwordRequired
                            ? "text-zinc-800"
                            : "text-zinc-400"
                        }`}
                        aria-label="Manage passcode"
                      >
                        <Lock className="h-4 w-4" />
                      </button>

                      {album.isExpired && (
                        <div className="absolute left-3 top-3 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-white shadow-sm">
                          Expired
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 p-4">
                      <div>
                        <h2 className="truncate text-lg font-semibold">
                          {album.name}
                        </h2>
                        <p className="text-sm text-zinc-500">
                          {album.albumDate || album.slug}
                        </p>
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedAlbumForPasscode && (
        <AlbumPasscodeManager
          albumSlug={selectedAlbumForPasscode.slug}
          albumName={selectedAlbumForPasscode.name}
          onChanged={() => mutateAlbums()}
          onClose={() => setSelectedAlbumForPasscode(null)}
        />
      )}
    </main>
  );
}

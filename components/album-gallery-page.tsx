"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, Images, Search, Users } from "lucide-react";
import { PeopleGrid } from "@/components/people-grid";
import { PersonView } from "@/components/person-view";
import { PhotosGrid } from "@/components/photos-grid";
import { FloatingSearchButton } from "@/components/search-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlbumDetail, Person } from "@/lib/types";

type Tab = "photos" | "people";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AlbumGalleryPageProps {
  albumSlug: string;
}

function eventQuery(selectedEventSlug: string | null) {
  return selectedEventSlug
    ? `?event=${encodeURIComponent(selectedEventSlug)}`
    : "";
}

function PasswordGate({
  albumSlug,
  onVerified,
}: {
  albumSlug: string;
  onVerified: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const verify = async () => {
    if (!password || isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/verify-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );
      const data = (await response.json()) as { ok?: boolean };

      if (!response.ok || !data.ok) {
        setError("Incorrect password.");
        return;
      }

      sessionStorage.setItem(`album:${albumSlug}:verified`, "true");
      onVerified();
    } catch {
      setError("Could not verify password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] px-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-medium text-zinc-500">Protected album</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-950">
            Enter password
          </h1>
        </div>
        <div className="space-y-3">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") verify();
            }}
            placeholder="Password"
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button
            className="w-full"
            onClick={verify}
            disabled={!password || isSubmitting}
          >
            Unlock
          </Button>
        </div>
      </div>
    </main>
  );
}

export function AlbumGalleryPage({ albumSlug }: AlbumGalleryPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("photos");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedEventSlug, setSelectedEventSlug] = useState<string | null>(
    searchParams.get("event") || null
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);

  const { data, error, isLoading } = useSWR<{ album: AlbumDetail }>(
    `/api/albums/${encodeURIComponent(albumSlug)}`,
    fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );

  const album = data?.album;
  const selectedEvent = useMemo(
    () => album?.events.find((event) => event.slug === selectedEventSlug),
    [album?.events, selectedEventSlug]
  );

  useEffect(() => {
    const eventFromUrl = searchParams.get("event") || null;
    setSelectedEventSlug(eventFromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (!album || !selectedEventSlug) return;
    if (!album.events.some((event) => event.slug === selectedEventSlug)) {
      setSelectedEventSlug(null);
      router.replace(`/albums/${albumSlug}`, { scroll: false });
    }
  }, [album, albumSlug, router, selectedEventSlug]);

  useEffect(() => {
    setIsPasswordVerified(
      sessionStorage.getItem(`album:${albumSlug}:verified`) === "true"
    );
  }, [albumSlug]);

  const changeEvent = (eventSlug: string | null) => {
    setSelectedEventSlug(eventSlug);
    router.replace(`/albums/${albumSlug}${eventQuery(eventSlug)}`, {
      scroll: false,
    });
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#fbfaf8]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Skeleton className="mb-6 h-10 w-56" />
          <Skeleton className="mb-4 h-12 w-full rounded-full" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-72 min-w-[min(42vw,180px)] flex-1 rounded-md"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !album) {
    return (
      <main className="min-h-screen bg-[#fbfaf8] px-4 py-12 text-center text-zinc-600">
        Failed to load album.
      </main>
    );
  }

  if (album.passwordRequired && !isPasswordVerified) {
    return (
      <PasswordGate
        albumSlug={albumSlug}
        onVerified={() => setIsPasswordVerified(true)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-[#fbfaf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/albums"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                aria-label="Back to albums"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
                  Album
                </p>
                <h1 className="truncate text-xl font-semibold sm:text-2xl">
                  {album.name}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="hidden items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-zinc-200 sm:flex"
                role="tablist"
              >
                <button
                  role="tab"
                  aria-selected={activeTab === "photos" && !selectedPerson}
                  onClick={() => {
                    setSelectedPerson(null);
                    setActiveTab("photos");
                  }}
                  className={`flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium transition ${
                    activeTab === "photos" && !selectedPerson
                      ? "bg-zinc-950 text-white"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  <Images className="h-4 w-4" />
                  Photos
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === "people" && !selectedPerson}
                  onClick={() => {
                    setSelectedPerson(null);
                    setActiveTab("people");
                  }}
                  className={`flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium transition ${
                    activeTab === "people" && !selectedPerson
                      ? "bg-zinc-950 text-white"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  People
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => changeEvent(null)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                !selectedEventSlug
                  ? "bg-zinc-950 text-white"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-zinc-950"
              }`}
            >
              All
              <span className="ml-2 text-xs opacity-70">{album.photoCount}</span>
            </button>
            {album.events.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => changeEvent(event.slug)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  selectedEventSlug === event.slug
                    ? "bg-zinc-950 text-white"
                    : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-zinc-950"
                }`}
              >
                {event.name}
                <span className="ml-2 text-xs opacity-70">
                  {event.photoCount}
                </span>
              </button>
            ))}
          </div>

          <div
            className="grid grid-cols-2 gap-2 rounded-full bg-white p-1 shadow-sm ring-1 ring-zinc-200 sm:hidden"
            role="tablist"
          >
            <button
              role="tab"
              aria-selected={activeTab === "photos" && !selectedPerson}
              onClick={() => {
                setSelectedPerson(null);
                setActiveTab("photos");
              }}
              className={`flex h-8 items-center justify-center gap-2 rounded-full text-sm font-medium transition ${
                activeTab === "photos" && !selectedPerson
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-600"
              }`}
            >
              <Images className="h-4 w-4" />
              Photos
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "people" && !selectedPerson}
              onClick={() => {
                setSelectedPerson(null);
                setActiveTab("people");
              }}
              className={`flex h-8 items-center justify-center gap-2 rounded-full text-sm font-medium transition ${
                activeTab === "people" && !selectedPerson
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-600"
              }`}
            >
              <Users className="h-4 w-4" />
              People
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-6 lg:px-6">
        {selectedPerson ? (
          <PersonView
            albumSlug={albumSlug}
            selectedEventSlug={selectedEventSlug}
            events={album.events}
            person={selectedPerson}
            onBack={() => setSelectedPerson(null)}
          />
        ) : activeTab === "people" ? (
          <section className="space-y-5 px-2 sm:px-0">
            <div>
              <p className="text-sm font-medium text-zinc-500">
                {selectedEvent?.name ?? "All events"}
              </p>
              <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                People
              </h2>
            </div>
            <PeopleGrid
              albumSlug={albumSlug}
              selectedEventSlug={selectedEventSlug}
              events={album.events}
              onPersonClick={setSelectedPerson}
            />
          </section>
        ) : (
          <section className="space-y-5">
            <div className="px-2 sm:px-0">
              <p className="text-sm font-medium text-zinc-500">
                {selectedEvent?.name ?? "All events"}
              </p>
              <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                Photos
              </h2>
            </div>
            <PhotosGrid
              albumSlug={albumSlug}
              selectedEventSlug={selectedEventSlug}
            />
          </section>
        )}
      </div>

      <FloatingSearchButton
        albumSlug={albumSlug}
        selectedEventSlug={selectedEventSlug}
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
      />
    </main>
  );
}

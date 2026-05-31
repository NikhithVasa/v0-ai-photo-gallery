"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Images,
  Plus,
  Search,
  User,
  Users,
  X,
} from "lucide-react";
import { PeopleGrid } from "@/components/people-grid";
import { PersonView } from "@/components/person-view";
import { PhotosGrid, type PeopleMatchMode } from "@/components/photos-grid";
import { PhotoCard, PhotoLightbox, type PhotoOpenRect } from "./photo-card";
import { ApsaraMomentsRoot } from "@/components/apsara-moments";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlbumDetail, Person, Photo } from "@/lib/types";

type Tab = "photos" | "people";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

interface AlbumGalleryPageProps {
  albumSlug: string;
}

interface AlbumStatsResponse {
  stats: {
    photoCount: number;
    peopleCount: number;
    events: {
      eventId: string;
      photoCount: number;
      peopleCount: number;
      pendingAiCount?: number;
    }[];
  };
}

interface AlbumSummaryForGate {
  slug: string;
  name: string;
  coverPhotoUrl?: string | null;
}

function eventQuery(selectedEventSlug: string | null) {
  return selectedEventSlug
    ? `?event=${encodeURIComponent(selectedEventSlug)}`
    : "";
}

function formatAlbumDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function PasswordGate({
  albumSlug,
  albumName,
  onVerified,
}: {
  albumSlug: string;
  albumName: string;
  onVerified: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: albumsData } = useSWR<{ albums: AlbumSummaryForGate[] }>(
    "/api/albums",
    fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );

  const coverPhotoUrl = useMemo(() => {
    return (
      albumsData?.albums?.find((album) => album.slug === albumSlug)
        ?.coverPhotoUrl ?? null
    );
  }, [albumsData?.albums, albumSlug]);

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
        setError("Wrong code. Signed up already? Click ‘Login here’ below.");
        return;
      }

      sessionStorage.setItem(`album:${albumSlug}:verified`, "true");
      onVerified();
    } catch {
      setError("Wrong code. Signed up already? Click ‘Login here’ below.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-100 text-zinc-950">
      {coverPhotoUrl && (
        <Image
          src={coverPhotoUrl}
          alt={albumName}
          fill
          sizes="100vw"
          className="object-cover"
          priority
          unoptimized
        />
      )}

      <div className="absolute inset-0 bg-white/78 backdrop-blur-[1px]" />

      <div className="relative z-10 flex min-h-screen items-start justify-center px-5 pt-10 sm:pt-12">
        <div className="w-full max-w-[480px] text-center">
          <p className="mb-14 font-serif text-[18px] uppercase tracking-[0.28em] text-zinc-950">
            {albumName}
          </p>

          <h1 className="mb-14 text-[22px] font-semibold uppercase tracking-[0.22em] text-zinc-950">
            Enter code to view this gallery
          </h1>

          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") verify();
              }}
              placeholder="Access Code"
              aria-label="Access code"
              aria-invalid={Boolean(error)}
              className={`h-12 w-full border bg-white/70 px-4 text-[16px] tracking-wide text-zinc-950 outline-none backdrop-blur-sm placeholder:text-zinc-500 focus:border-zinc-950 ${
                error ? "border-red-500" : "border-zinc-300"
              }`}
            />

            {error && (
              <p className="text-left text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={verify}
              disabled={!password || isSubmitting}
              className="flex h-12 w-full cursor-pointer items-center justify-center bg-zinc-800 text-[13px] font-semibold uppercase tracking-[0.28em] text-white transition hover:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white/90" />
                  <span className="sr-only">Checking code</span>
                </span>
              ) : (
                "Continue"
              )}
            </button>
          </div>

          <div className="mt-20 space-y-4 text-center">
            <p className="text-[15px] tracking-wide text-zinc-950">
              Signed up already?{" "}
              <Link
                href="/login"
                className="text-zinc-950 transition hover:text-[#868686]"
              >
                Login here
              </Link>
            </p>

            <p className="mx-auto max-w-[440px] text-[14px] leading-5 tracking-wide text-zinc-500">
              Click ‘Login here’ if you signed up using your email, Facebook, or
              Google account.
            </p>

            <p className="text-[14px] tracking-wide">
              <Link
                href="/legal/terms-of-service"
                className="text-[#868686] transition hover:text-black"
              >
                Terms of Service
              </Link>{" "}
              <span className="text-[#868686]">and</span>{" "}
              <Link
                href="/legal/privacy-policy"
                className="text-[#868686] transition hover:text-black"
              >
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function SearchResultsGrid({
  albumSlug,
  query,
  photos,
  isLoading,
  error,
  onClear,
  onPersonClick,
}: {
  albumSlug: string;
  query: string;
  photos: Photo[];
  isLoading: boolean;
  error: string | null;
  onClear: () => void;
  onPersonClick?: (personId: string) => void;
}) {
  const [lightboxState, setLightboxState] = useState<{
    index: number;
    originRect?: PhotoOpenRect;
  } | null>(null);

  const handleOpen = (index: number, originRect: PhotoOpenRect) => {
    setLightboxState({ index, originRect });
  };

  const handleNavigate = (index: number) => {
    setLightboxState({ index });
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 px-2 sm:flex-row sm:items-end sm:justify-between sm:px-0">
        <div>
          <p className="text-sm font-medium text-zinc-500">Search results</p>
          <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
            {query}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-9 w-fit cursor-pointer items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-600 shadow-sm transition hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300"
        >
          Back to photos
        </button>
      </div>

      {isLoading && (
        <div className="columns-2 gap-[3px] sm:columns-2 sm:gap-2 lg:columns-3">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="mb-[3px] break-inside-avoid sm:mb-2">
              <Skeleton className="h-56 w-full rounded-md sm:h-72" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm text-rose-700">
          {error}
        </div>
      )}

      {!isLoading && !error && !photos.length && (
        <div className="rounded-md border border-zinc-200 bg-white px-6 py-12 text-center text-zinc-500">
          No photos found for this search.
        </div>
      )}

      {!isLoading && !error && photos.length > 0 && (
        <div className="columns-2 gap-[3px] sm:columns-2 sm:gap-2 lg:columns-3">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="mb-[3px] break-inside-avoid overflow-hidden rounded-md sm:mb-2"
            >
              <PhotoCard
                albumSlug={albumSlug}
                photo={photo}
                index={index}
                onOpen={handleOpen}
              />
            </div>
          ))}
        </div>
      )}

      {lightboxState !== null && (
        <PhotoLightbox
          albumSlug={albumSlug}
          photos={photos}
          currentIndex={lightboxState.index}
          originRect={lightboxState.originRect}
          onClose={() => setLightboxState(null)}
          onNavigate={handleNavigate}
          onPersonClick={onPersonClick}
        />
      )}
    </section>
  );
}

function PersonAvatar({
  person,
  size = "md",
}: {
  person: Person;
  size?: "sm" | "md";
}) {
  const dimension = size === "sm" ? "h-6 w-6" : "h-9 w-9";
  const displayName = person.displayName || person.defaultName;

  return (
    <span
      className={`relative inline-flex ${dimension} shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-white`}
    >
      {person.coverFaceUrl ? (
        <Image
          src={person.coverFaceUrl}
          alt={displayName}
          fill
          sizes={size === "sm" ? "24px" : "36px"}
          className="object-cover"
          unoptimized
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-zinc-400">
          <User className={size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5"} />
        </span>
      )}
    </span>
  );
}

function PeopleFilterButton({
  people,
  selectedPeople,
  selectedPeopleIds,
  onToggle,
  onClear,
}: {
  people: Person[];
  selectedPeople: Person[];
  selectedPeopleIds: string[];
  onToggle: (personId: string) => void;
  onClear: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedIdSet = useMemo(
    () => new Set(selectedPeopleIds),
    [selectedPeopleIds]
  );

  const previewPeople = selectedPeople.length
    ? selectedPeople.slice(0, 4)
    : people.slice(0, 4);

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return people;

    return people.filter((person) => {
      const name = `${person.displayName || ""} ${
        person.defaultName || ""
      } Person ${person.personNumber}`.toLowerCase();

      return name.includes(normalized);
    });
  }, [people, query]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-9 cursor-pointer items-center gap-2 rounded-full border px-2.5 text-sm font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-zinc-400 ${
          selectedPeopleIds.length
            ? "border-zinc-950 bg-zinc-950 text-white"
            : "border-zinc-200 bg-white text-zinc-600 hover:text-zinc-950"
        }`}
        aria-expanded={isOpen}
        aria-label="Filter by people"
      >
        <Users className="h-4 w-4" />
        <span>People</span>

        {previewPeople.length > 0 && (
          <span className="flex -space-x-2">
            {previewPeople.map((person) => (
              <PersonAvatar key={person.id} person={person} size="sm" />
            ))}
          </span>
        )}

        {selectedPeopleIds.length > 0 && (
          <span className="rounded-full bg-white/20 px-1.5 text-xs">
            {selectedPeopleIds.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(88vw,360px)] rounded-lg border border-zinc-200 bg-white p-3 text-zinc-950 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Filter people</p>
              <p className="text-xs text-zinc-500">
                {selectedPeopleIds.length
                  ? `${selectedPeopleIds.length} selected`
                  : "Select one or more"}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {selectedPeopleIds.length > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="cursor-pointer rounded-full px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                >
                  Clear
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                aria-label="Close people filter"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            className="mb-3 h-9"
          />

          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredPeople.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                No people found.
              </div>
            ) : (
              filteredPeople.map((person) => {
                const isSelected = selectedIdSet.has(person.id);
                const displayName = person.displayName || person.defaultName;

                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => onToggle(person.id)}
                    aria-pressed={isSelected}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left transition ${
                      isSelected
                        ? "bg-zinc-950 text-white"
                        : "hover:bg-zinc-100"
                    }`}
                  >
                    <PersonAvatar person={person} />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {displayName}
                      </span>
                      <span
                        className={`block text-xs ${
                          isSelected ? "text-white/65" : "text-zinc-500"
                        }`}
                      >
                        {person.photoCount} photos
                      </span>
                    </span>

                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PeopleMatchModeSelect({
  value,
  onChange,
}: {
  value: PeopleMatchMode;
  onChange: (value: PeopleMatchMode) => void;
}) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">People photo mode</span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value as PeopleMatchMode)}
        className="h-9 cursor-pointer appearance-none rounded-full border border-zinc-200 bg-white py-0 pl-3 pr-8 text-sm font-medium text-zinc-600 shadow-sm transition hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
      >
        <option value="any">Show single person photos</option>
        <option value="all">Show multiple person photos</option>
      </select>

      <span className="pointer-events-none absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 border-b border-r border-zinc-500" />
    </label>
  );
}

function EventNameControl({
  eventName,
  isEditing,
  draft,
  isSaving,
  onStart,
  onDraftChange,
  onSave,
  onCancel,
}: {
  eventName: string;
  isEditing: boolean;
  draft: string;
  isSaving: boolean;
  onStart: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (isEditing) {
    return (
      <div className="flex max-w-full items-center gap-1.5">
        <Input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSave();
            if (event.key === "Escape") onCancel();
          }}
          className="h-8 w-48 max-w-[60vw] bg-white"
          aria-label="Event name"
          disabled={isSaving}
          autoFocus
        />

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || !draft.trim()}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-950/5 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Save event name"
        >
          <Check className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Cancel event name edit"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <p className="text-sm font-medium text-zinc-500">{eventName}</p>

      <button
        type="button"
        onClick={onStart}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300"
        aria-label={`Edit ${eventName} event name`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AlbumGalleryPage({ albumSlug }: AlbumGalleryPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<Tab>("photos");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [peopleMatchMode, setPeopleMatchMode] =
    useState<PeopleMatchMode>("all");
  const [selectedEventSlug, setSelectedEventSlug] = useState<string | null>(
    searchParams.get("event") || null
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventNameDraft, setEventNameDraft] = useState("");
  const [isSavingEventName, setIsSavingEventName] = useState(false);
  const [apsaraTextSearch, setApsaraTextSearch] = useState<{
    query: string;
    photos: Photo[];
    isLoading: boolean;
    error: string | null;
  } | null>(null);

  const { data, error, isLoading, mutate } = useSWR<{ album: AlbumDetail }>(
    `/api/albums/${encodeURIComponent(albumSlug)}`,
    fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );

  // Check if any event has photos but no people (AI still processing)
  const hasEventsLoadingAi = useMemo(() => {
    return data?.album?.events?.some(
      (event) => (event.photoCount ?? 0) > 0 && (event.peopleCount ?? 0) === 0
    );
  }, [data?.album?.events]);

  const { data: statsData, mutate: mutateStats } = useSWR<AlbumStatsResponse>(
    data?.album
      ? `/api/albums/${encodeURIComponent(albumSlug)}/stats`
      : null,
    fetcher,
    {
      dedupingInterval: hasEventsLoadingAi ? 10 * 1000 : 5 * 60 * 1000, // Refresh every 10s if AI is loading, else 5 minutes
      revalidateOnFocus: false,
    }
  );

  const { data: peopleFilterData } = useSWR<{ people: Person[] }>(
    data?.album && (!data.album.passwordRequired || isPasswordVerified)
      ? `/api/albums/${encodeURIComponent(albumSlug)}/people`
      : null,
    fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );

  const album = useMemo(() => {
    if (!data?.album) return undefined;

    const eventStatsById = new Map(
      statsData?.stats.events.map((event) => [event.eventId, event]) ?? []
    );

    return {
      ...data.album,
      photoCount: statsData?.stats.photoCount ?? data.album.photoCount,
      peopleCount: statsData?.stats.peopleCount ?? data.album.peopleCount,
      events: data.album.events.map((event) => {
        const stats = eventStatsById.get(event.id);

        return {
          ...event,
          photoCount: stats?.photoCount ?? event.photoCount,
          peopleCount: stats?.peopleCount ?? event.peopleCount,
        };
      }),
    };
  }, [data?.album, statsData?.stats]);

  const filterPeople = peopleFilterData?.people ?? [];

  const selectedFilterPeople = useMemo(() => {
    const selectedIds = new Set(selectedPeopleIds);
    return filterPeople.filter((person) => selectedIds.has(person.id));
  }, [filterPeople, selectedPeopleIds]);

  const selectedEvent = useMemo(
    () => album?.events.find((event) => event.slug === selectedEventSlug),
    [album?.events, selectedEventSlug]
  );
  const albumDateLabel = formatAlbumDate(album?.albumDate);
  const coverTitle = album?.customer?.name || album?.name || "";
  const photographerName = "24 Frames Photography";

  const scrollToGalleryTop = () => {
    requestAnimationFrame(() => {
      const shell = document.getElementById("album-gallery-shell");
      window.scrollTo({
        top: shell ? Math.max(shell.offsetTop - 8, 0) : 0,
        left: 0,
        behavior: "smooth",
      });
    });
  };

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

  useEffect(() => {
    if (selectedPeopleIds.length < 2 && peopleMatchMode !== "all") {
      setPeopleMatchMode("all");
    }
  }, [peopleMatchMode, selectedPeopleIds.length]);

  const changeEvent = (eventSlug: string | null) => {
    setSelectedEventSlug(eventSlug);
    setEditingEventId(null);
    setApsaraTextSearch(null);

    router.replace(`/albums/${albumSlug}${eventQuery(eventSlug)}`, {
      scroll: false,
    });

    scrollToGalleryTop();
  };

  const goToNextEvent = () => {
    if (!album) return;
    if (activeTab !== "photos") return;
    if (selectedPerson) return;
    if (!selectedEventSlug) return;
    if (selectedPeopleIds.length > 0) return;

    const currentIndex = album.events.findIndex(
      (event) => event.slug === selectedEventSlug
    );

    if (currentIndex < 0) return;

    const nextEvent = album.events[currentIndex + 1];
    if (!nextEvent) return;

    changeEvent(nextEvent.slug);
  };

  const openPerson = (person: Person) => {
    setApsaraTextSearch(null);
    setSelectedPerson(person);
    setActiveTab("people");
    scrollToGalleryTop();
  };

  const filterByPerson = (personId: string) => {
    setApsaraTextSearch(null);
    setSelectedPeopleIds([personId]);
    setPeopleMatchMode("all");
    setSelectedPerson(null);
    setActiveTab("photos");
    scrollToGalleryTop();
  };

  const filterByPeopleSelection = (people: Person[], mode: PeopleMatchMode) => {
    const ids = people.map((person) => person.id);

    setApsaraTextSearch(null);
    setSelectedPeopleIds(ids);
    setPeopleMatchMode(ids.length > 1 ? mode : "all");
    setSelectedPerson(null);
    setActiveTab("photos");
    scrollToGalleryTop();
  };

  const toggleSelectedPersonId = (personId: string) => {
    setApsaraTextSearch(null);
    setSelectedPeopleIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]
    );
    setSelectedPerson(null);
    setActiveTab("photos");
    scrollToGalleryTop();
  };

  const runApsaraTextSearch = async (
    searchQuery: string,
    selectedPeople: Person[] = []
  ) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    const personIds = selectedPeople.map((person) => person.id);

    setSelectedPerson(null);
    setSelectedPeopleIds([]);
    setPeopleMatchMode("all");
    setActiveTab("photos");
    setApsaraTextSearch({
      query: trimmedQuery,
      photos: [],
      isLoading: true,
      error: null,
    });
    scrollToGalleryTop();

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: trimmedQuery,
            event: selectedEventSlug,
            people: personIds,
            together: true,
            limit: 100,
          }),
        }
      );

      if (!response.ok) throw new Error("Search request failed");

      const payload = (await response.json()) as { results?: Photo[] };

      setApsaraTextSearch({
        query: trimmedQuery,
        photos: payload.results ?? [],
        isLoading: false,
        error: null,
      });
    } catch (searchError) {
      console.error("Apsara text search failed:", searchError);
      setApsaraTextSearch({
        query: trimmedQuery,
        photos: [],
        isLoading: false,
        error: "Failed to search photos. Please try again.",
      });
    }
  };

  const startEditingSelectedEvent = () => {
    if (!selectedEvent) return;

    setEditingEventId(selectedEvent.id);
    setEventNameDraft(selectedEvent.name);
  };

  const cancelEditingEvent = () => {
    setEditingEventId(null);
    setEventNameDraft("");
  };

  const saveEventName = async () => {
    if (!selectedEvent || !eventNameDraft.trim() || isSavingEventName) return;

    setIsSavingEventName(true);

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/events`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: selectedEvent.id,
            name: eventNameDraft.trim(),
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to update event name");

      const payload = (await response.json()) as {
        events?: AlbumDetail["events"];
      };

      if (payload.events) {
        await mutate(
          (current) =>
            current
              ? {
                  album: {
                    ...current.album,
                    events: payload.events ?? current.album.events,
                  },
                }
              : current,
          { revalidate: false }
        );
      } else {
        await mutate();
      }

      cancelEditingEvent();
    } catch (eventNameError) {
      console.error("Failed to update event name:", eventNameError);
    } finally {
      setIsSavingEventName(false);
    }
  };

  const eventLabel = selectedEvent?.name ?? "All events";
  const selectedEventStats = statsData?.stats.events.find(
    (event) => event.eventId === selectedEvent?.id
  );
  const isAiDataLoadingForEvent = Boolean(
    selectedEvent && (selectedEventStats?.pendingAiCount ?? 0) > 0
  );

  const eventHeader = selectedEvent ? (
    <EventNameControl
      eventName={selectedEvent.name}
      isEditing={editingEventId === selectedEvent.id}
      draft={eventNameDraft}
      isSaving={isSavingEventName}
      onStart={startEditingSelectedEvent}
      onDraftChange={setEventNameDraft}
      onSave={saveEventName}
      onCancel={cancelEditingEvent}
    />
  ) : (
    <p className="text-sm font-medium text-zinc-500">{eventLabel}</p>
  );

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
        albumName={album.name}
        onVerified={() => setIsPasswordVerified(true)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-zinc-950">
      <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-white px-5 py-8 text-center sm:py-10">
        {album.coverPhotoUrl && (
          <Image
            src={album.coverPhotoUrl}
            alt={album.name}
            fill
            sizes="100vw"
            className="object-cover opacity-[0.18]"
            priority
            unoptimized
          />
        )}
        <div className="absolute inset-0 bg-white/72 backdrop-blur-[2px]" />

        <div className="relative z-10 flex w-full max-w-6xl flex-col items-center pb-16">
          <div className="relative grid w-full items-center gap-5 sm:grid-cols-[80px_minmax(250px,380px)_minmax(220px,1fr)] sm:gap-8 lg:gap-12">
            <div className="order-2 flex justify-center sm:order-1 sm:h-[340px] sm:items-center">
              <div className="text-center text-[11px] font-medium tracking-normal text-zinc-500 sm:w-[340px] sm:-rotate-90">
                <span>Photos by</span>
                <span className="ml-1 text-zinc-800">{photographerName}</span>
              </div>
            </div>

            <div className="order-1 flex justify-center sm:order-2">
              <div className="relative aspect-[4/5] w-[min(62vw,320px)] overflow-hidden rounded-[24px] bg-zinc-100 shadow-[0_30px_74px_rgba(24,24,27,0.16)] ring-1 ring-zinc-200 sm:w-[min(32vw,380px)] sm:rounded-[30px]">
                {album.coverPhotoUrl ? (
                  <Image
                    src={album.coverPhotoUrl}
                    alt={album.name}
                    fill
                    sizes="(min-width: 768px) 380px, 62vw"
                    className="object-cover"
                    priority
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-300">
                    <Images className="h-20 w-20" strokeWidth={1.3} />
                  </div>
                )}
              </div>
            </div>

            <div className="order-3 flex justify-center text-center sm:justify-start sm:text-left">
              <div className="flex items-center gap-4 text-zinc-950">
                <h1 className="max-w-[18rem] text-2xl font-semibold uppercase tracking-[0.08em] sm:text-4xl lg:text-5xl">
                  {coverTitle}
                </h1>

                {albumDateLabel && (
                  <>
                    <span className="h-px w-10 shrink-0 bg-zinc-400" />
                    <p className="text-base font-medium text-zinc-500 sm:text-lg">
                      {albumDateLabel}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {album.description && (
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-500">
              {album.description}
            </p>
          )}

          {album.isExpired && (
            <div className="mt-5 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-rose-700">
              Album expired
            </div>
          )}

          <button
            type="button"
            onClick={scrollToGalleryTop}
            className="absolute bottom-5 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:-translate-y-0.5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300 sm:bottom-7"
            aria-label="Scroll to gallery"
          >
            <ChevronDown className="h-6 w-6" />
          </button>
        </div>
      </section>

      <header
        id="album-gallery-shell"
        className="sticky top-0 z-30 border-b border-zinc-200/80 bg-[#fbfaf8]/90 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
                  {album.peopleCount} people
                </p>
                <h1 className="truncate text-xl font-semibold sm:text-2xl">
                  {album.customer?.name || album.name}
                </h1>
              </div>

              {!selectedPerson && activeTab === "photos" && (
                <div className="hidden items-center gap-2 sm:flex">
                  <PeopleFilterButton
                    people={filterPeople}
                    selectedPeople={selectedFilterPeople}
                    selectedPeopleIds={selectedPeopleIds}
                    onToggle={toggleSelectedPersonId}
                    onClear={() => setSelectedPeopleIds([])}
                  />

                  {selectedPeopleIds.length > 1 && (
                    <PeopleMatchModeSelect
                      value={peopleMatchMode}
                      onChange={setPeopleMatchMode}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/albums/${encodeURIComponent(albumSlug)}/events/new`}
                className="flex h-9 w-9 items-center justify-center gap-2 rounded-full bg-zinc-950 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 sm:w-auto sm:px-3"
                aria-label="Manage events"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Manage Events</span>
              </Link>

              {!selectedPerson && (
                <div
                  className="hidden items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-zinc-200 sm:flex"
                  role="tablist"
                >
                  <button
                    role="tab"
                    aria-selected={activeTab === "photos"}
                    onClick={() => {
                      setSelectedPerson(null);
                      setApsaraTextSearch(null);
                      setActiveTab("photos");
                      scrollToGalleryTop();
                    }}
                    className={`flex h-8 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium transition ${
                      activeTab === "photos"
                        ? "bg-zinc-950 text-white"
                        : "text-zinc-600 hover:text-zinc-950"
                    }`}
                  >
                    <Images className="h-4 w-4" />
                    Photos
                  </button>

                  <button
                    role="tab"
                    aria-selected={activeTab === "people"}
                    onClick={() => {
                      setSelectedPerson(null);
                      setApsaraTextSearch(null);
                      setActiveTab("people");
                      scrollToGalleryTop();
                    }}
                    className={`flex h-8 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium transition ${
                      activeTab === "people"
                        ? "bg-zinc-950 text-white"
                        : "text-zinc-600 hover:text-zinc-950"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    People
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>

          {!selectedPerson && activeTab === "photos" && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => changeEvent(null)}
                className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  !selectedEventSlug
                    ? "bg-zinc-950 text-white"
                    : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-zinc-950"
                }`}
              >
                All
                <span className="ml-2 text-xs opacity-70">
                  {album.photoCount}
                </span>
              </button>

              {album.events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => changeEvent(event.slug)}
                  className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition ${
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

              <Link
                href={`/albums/${encodeURIComponent(albumSlug)}/events/new`}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 ring-1 ring-zinc-200 transition hover:text-zinc-950"
              >
                <Plus className="h-4 w-4" />
                Manage Events
              </Link>
            </div>
          )}

          {!selectedPerson && (
            <div
              className="grid grid-cols-2 gap-2 rounded-full bg-white p-1 shadow-sm ring-1 ring-zinc-200 sm:hidden"
              role="tablist"
            >
              <button
                role="tab"
                aria-selected={activeTab === "photos"}
                onClick={() => {
                  setSelectedPerson(null);
                  setApsaraTextSearch(null);
                  setActiveTab("photos");
                  scrollToGalleryTop();
                }}
                className={`flex h-8 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-medium transition ${
                  activeTab === "photos"
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-600"
                }`}
              >
                <Images className="h-4 w-4" />
                Photos
              </button>

              <button
                role="tab"
                aria-selected={activeTab === "people"}
                onClick={() => {
                  setSelectedPerson(null);
                  setApsaraTextSearch(null);
                  setActiveTab("people");
                  scrollToGalleryTop();
                }}
                className={`flex h-8 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-medium transition ${
                  activeTab === "people"
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-600"
                }`}
              >
                <Users className="h-4 w-4" />
                People
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-6 lg:px-6">
        {selectedPerson ? (
          <PersonView
            albumSlug={albumSlug}
            selectedEventSlug={null}
            events={album.events}
            person={selectedPerson}
            onBack={() => {
              setSelectedPerson(null);
              setActiveTab("people");
              scrollToGalleryTop();
            }}
          />
        ) : activeTab === "people" ? (
          <section className="space-y-5 px-2 sm:px-0">
            <div>
              <p className="text-sm font-medium text-zinc-500">All people</p>
              <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                People
              </h2>
            </div>

            <PeopleGrid
              albumSlug={albumSlug}
              selectedEventSlug={null}
              events={album.events}
              onPersonClick={openPerson}
              onPeopleSelectionApply={filterByPeopleSelection}
            />
          </section>
        ) : apsaraTextSearch ? (
          <SearchResultsGrid
            albumSlug={albumSlug}
            query={apsaraTextSearch.query}
            photos={apsaraTextSearch.photos}
            isLoading={apsaraTextSearch.isLoading}
            error={apsaraTextSearch.error}
            onClear={() => setApsaraTextSearch(null)}
            onPersonClick={filterByPerson}
          />
        ) : (
          <section className="space-y-5">
            <div className="px-2 sm:px-0">
              {eventHeader}
              <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                Photos
              </h2>
              {isAiDataLoadingForEvent && (
                <div className="mt-4 rounded-2xl border border-[#d8ddff] bg-[#f3f5ff] px-4 py-3 text-sm text-zinc-700">
                  AI data is loading for this event. Photos are available now;
                  people and search details will appear after processing finishes.
                </div>
              )}
            </div>

            <PhotosGrid
              albumSlug={albumSlug}
              selectedEventSlug={selectedEventSlug}
              selectedPeopleIds={selectedPeopleIds}
              peopleMatchMode={peopleMatchMode}
              onPersonClick={filterByPerson}
              onReachedEnd={goToNextEvent}
            />
          </section>
        )}
      </div>

      <ApsaraMomentsRoot
        albumSlug={albumSlug}
        selectedEventSlug={selectedEventSlug}
        selectedPeopleIds={selectedPeopleIds}
        peopleMatchMode={peopleMatchMode}
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onPersonOpen={openPerson}
        onPeopleSelectionApply={filterByPeopleSelection}
        onTextSearch={runApsaraTextSearch}
      />
    </main>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  Check,
  Pencil,
  Images,
  Search,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { PeopleGrid } from "@/components/people-grid";
import { PersonView } from "@/components/person-view";
import { PhotosGrid } from "@/components/photos-grid";
import { ApsaraMomentsRoot } from "@/components/apsara-moments";
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

function PersonAvatar({ person, size = "md" }: { person: Person; size?: "sm" | "md" }) {
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
      const name = `${person.displayName || ""} ${person.defaultName || ""} Person ${
        person.personNumber
      }`.toLowerCase();
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
        className={`flex h-9 items-center gap-2 rounded-full border px-2.5 text-sm font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-zinc-400 ${
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
                  className="rounded-full px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
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
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition ${
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
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-950/5 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Save event name"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-35"
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
        className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300"
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
  const [selectedEventSlug, setSelectedEventSlug] = useState<string | null>(
    searchParams.get("event") || null
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventNameDraft, setEventNameDraft] = useState("");
  const [isSavingEventName, setIsSavingEventName] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<{ album: AlbumDetail }>(
    `/api/albums/${encodeURIComponent(albumSlug)}`,
    fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
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

  const album = data?.album;
  const filterPeople = peopleFilterData?.people ?? [];
  const selectedFilterPeople = useMemo(() => {
    const selectedIds = new Set(selectedPeopleIds);
    return filterPeople.filter((person) => selectedIds.has(person.id));
  }, [filterPeople, selectedPeopleIds]);
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
    setEditingEventId(null);
    router.replace(`/albums/${albumSlug}${eventQuery(eventSlug)}`, {
      scroll: false,
    });
  };
  const filterByPerson = (personId: string) => {
    setSelectedPeopleIds([personId]);
    setSelectedPerson(null);
    setActiveTab("photos");
  };
  const toggleSelectedPersonId = (personId: string) => {
    setSelectedPeopleIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]
    );
    setSelectedPerson(null);
    setActiveTab("photos");
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
      const payload = (await response.json()) as { events?: AlbumDetail["events"] };
      if (payload.events) {
        await mutate(
          (current) =>
            current
              ? { album: { ...current.album, events: payload.events ?? current.album.events } }
              : current,
          { revalidate: false }
        );
      } else {
        await mutate();
      }
      cancelEditingEvent();
    } catch (error) {
      console.error("Failed to update event name:", error);
    } finally {
      setIsSavingEventName(false);
    }
  };

  const eventLabel = selectedEvent?.name ?? "All events";
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
        onVerified={() => setIsPasswordVerified(true)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-[#fbfaf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
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
              <PeopleFilterButton
                people={filterPeople}
                selectedPeople={selectedFilterPeople}
                selectedPeopleIds={selectedPeopleIds}
                onToggle={toggleSelectedPersonId}
                onClear={() => setSelectedPeopleIds([])}
              />
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/upload?album=${encodeURIComponent(albumSlug)}`}
                className="flex h-9 w-9 items-center justify-center gap-2 rounded-full bg-zinc-950 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 sm:w-auto sm:px-3"
                aria-label="Upload photos"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Upload</span>
              </Link>
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
              {eventHeader}
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
              {eventHeader}
              <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                Photos
              </h2>
            </div>
            <PhotosGrid
              albumSlug={albumSlug}
              selectedEventSlug={selectedEventSlug}
              selectedPeopleIds={selectedPeopleIds}
              onPersonClick={filterByPerson}
            />
          </section>
        )}
      </div>

      <ApsaraMomentsRoot
        albumSlug={albumSlug}
        selectedEventSlug={selectedEventSlug}
        selectedPeopleIds={selectedPeopleIds}
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
      />
    </main>
  );
}

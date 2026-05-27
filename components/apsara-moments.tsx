"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  MessageCircle,
  Search,
  Share2,
  User,
  X,
} from "lucide-react";
import type { PeopleMatchMode } from "@/components/photos-grid";
import type { Person, Photo } from "@/lib/types";

interface ApsaraFloatingTriggerProps {
  onClick: () => void;
}

export function ApsaraFloatingTrigger({ onClick }: ApsaraFloatingTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-5 right-5 z-40 flex h-11 items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-4 text-sm font-medium text-zinc-900 shadow-sm backdrop-blur transition hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-300 sm:bottom-7 sm:right-7"
      aria-label="Open Apsara AI photo search"
    >
      <MessageCircle className="h-4 w-4" />
      <span>Apsara AI</span>
    </button>
  );
}

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function getDownloadUrl(albumSlug: string, photo: Photo) {
  if (photo.downloadUrl) return photo.downloadUrl;

  const response = await fetch(
    `/api/albums/${encodeURIComponent(albumSlug)}/photos/signed-urls`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds: [photo.id] }),
    }
  );

  if (!response.ok) return null;

  const data = (await response.json()) as {
    urls?: Record<string, { downloadUrl: string | null }>;
  };
  return data.urls?.[photo.id]?.downloadUrl ?? null;
}

function PersonAvatarButton({
  person,
  isSelected,
  onClick,
}: {
  person: Person;
  isSelected: boolean;
  onClick: () => void;
}) {
  const name = person.displayName || person.defaultName;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-20 flex-col items-center gap-2 text-center focus:outline-none"
      aria-pressed={isSelected}
      aria-label={`${isSelected ? "Remove" : "Select"} ${name}`}
    >
      <span
        className={`relative flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 transition ${
          isSelected
            ? "ring-3 ring-zinc-950 ring-offset-3"
            : "ring-1 ring-zinc-200 group-hover:ring-zinc-400"
        }`}
      >
        <span className="absolute inset-0 overflow-hidden rounded-full">
          {person.coverFaceUrl ? (
            <Image
              src={person.coverFaceUrl}
              alt={name}
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <User className="h-6 w-6 text-zinc-400" />
            </span>
          )}
        </span>

        {isSelected && (
          <span className="absolute -bottom-1 -right-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950 text-white ring-2 ring-white">
            <Check className="h-3.5 w-3.5 stroke-2.5" />
          </span>
        )}
      </span>

      <span className="line-clamp-2 max-w-full text-xs font-medium text-zinc-600">
        {name}
      </span>
    </button>
  );
}

function ApsaraPhotoCard({
  photo,
  onClick,
}: {
  photo: Photo;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-md border border-zinc-200 bg-white text-left transition hover:border-zinc-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
    >
      <div className="relative aspect-square bg-zinc-100">
        {photo.thumbnailUrl || photo.previewUrl ? (
          <Image
            src={photo.thumbnailUrl || photo.previewUrl || ""}
            alt={photo.caption || "Search result"}
            fill
            sizes="(max-width: 768px) 50vw, 220px"
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            No preview
          </div>
        )}
      </div>
      {(photo.eventName || photo.caption) && (
        <div className="space-y-1 p-2">
          {photo.eventName && (
            <p className="truncate text-[11px] font-medium text-zinc-500">
              {photo.eventName}
            </p>
          )}
          {photo.caption && (
            <p className="line-clamp-2 text-xs text-zinc-700">{photo.caption}</p>
          )}
        </div>
      )}
    </button>
  );
}

function ApsaraPhotoViewer({
  albumSlug,
  photos,
  currentIndex,
  onClose,
  onNavigate,
}: {
  albumSlug: string;
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const photo = photos[currentIndex];
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      }
      if (event.key === "ArrowRight" && currentIndex < photos.length - 1) {
        onNavigate(currentIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, onClose, onNavigate, photos.length]);

  if (!photo) return null;

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const url = await getDownloadUrl(albumSlug, photo);
      if (url) triggerDownload(url, photo.fileName || `photo-${photo.id}.jpg`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.origin + `/albums/${albumSlug}?photo=${photo.id}`;
    if (navigator.share) {
      await navigator.share({ title: photo.caption || "Photo", url });
      return;
    }
    await navigator.clipboard?.writeText(url);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-white/95 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="absolute left-4 top-4 text-sm font-medium text-zinc-500">
        {currentIndex + 1} of {photos.length}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300"
        aria-label="Close photo viewer"
      >
        <X className="h-5 w-5" />
      </button>

      {currentIndex > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onNavigate(currentIndex - 1);
          }}
          className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300 sm:flex"
          aria-label="Previous photo"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}

      <div
        className="flex max-h-[88vh] max-w-[min(94vw,1100px)] flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        {photo.previewUrl || photo.thumbnailUrl ? (
          <Image
            src={photo.previewUrl || photo.thumbnailUrl || ""}
            alt={photo.caption || "Photo"}
            width={photo.width || 1200}
            height={photo.height || 800}
            className="max-h-[78vh] w-auto max-w-full rounded-md object-contain shadow-sm"
            priority
            unoptimized
          />
        ) : (
          <div className="flex h-[60vh] w-[min(92vw,900px)] items-center justify-center rounded-md bg-zinc-100 text-sm text-zinc-500">
            No preview available
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex h-9 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 disabled:opacity-40"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex h-9 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </div>

      {currentIndex < photos.length - 1 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onNavigate(currentIndex + 1);
          }}
          className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300 sm:flex"
          aria-label="Next photo"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      )}
    </div>
  );
}

interface ApsaraMomentsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  albumSlug: string;
  selectedEventSlug: string | null;
  selectedPeopleIds?: string[];
  peopleMatchMode?: PeopleMatchMode;
  onPersonOpen?: (person: Person) => void;
  onPeopleSelectionApply?: (people: Person[], mode: PeopleMatchMode) => void;
}

export function ApsaraMomentsOverlay({
  isOpen,
  onClose,
  albumSlug,
  selectedEventSlug,
  selectedPeopleIds = [],
  peopleMatchMode = "all",
  onPersonOpen,
  onPeopleSelectionApply,
}: ApsaraMomentsOverlayProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Photo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoadingPeople, setIsLoadingPeople] = useState(false);
  const [selectedSearchPeopleIds, setSelectedSearchPeopleIds] = useState<
    string[]
  >([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(
    null
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedPeopleCount = selectedSearchPeopleIds.length;
  const canSearch = Boolean(query.trim()) || selectedPeopleCount > 0;

  const selectedSearchPeople = useMemo(() => {
    const selectedIds = new Set(selectedSearchPeopleIds);
    return people.filter((person) => selectedIds.has(person.id));
  }, [people, selectedSearchPeopleIds]);

  const searchLabel = selectedPeopleCount
    ? `Search (${selectedPeopleCount})`
    : "Search";

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setHasSearched(false);
      setSelectedSearchPeopleIds([]);
      setSelectedPhotoIndex(null);
      return;
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 160);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    setIsLoadingPeople(true);

    fetch(`/api/albums/${encodeURIComponent(albumSlug)}/people`)
      .then(async (response) => {
        if (!response.ok) throw new Error("People request failed");
        return (await response.json()) as { people?: Person[] };
      })
      .then((data) => {
        if (isCancelled) return;
        setPeople(data.people ?? []);
      })
      .catch((error) => {
        console.error("Failed to load people for Apsara search:", error);
        if (!isCancelled) setPeople([]);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingPeople(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [albumSlug, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedPhotoIndex === null) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, selectedPhotoIndex]);

  const handleSearch = async (overrideQuery?: string) => {
    const activeQuery = (overrideQuery ?? query).trim();
    const activePeopleIds = selectedSearchPeopleIds.length
      ? selectedSearchPeopleIds
      : selectedPeopleIds;

    if (!activeQuery && !activePeopleIds.length) return;

    if (overrideQuery) setQuery(overrideQuery);
    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: activeQuery,
            event: selectedEventSlug,
            people: activePeopleIds,
            together: selectedSearchPeopleIds.length
              ? true
              : peopleMatchMode === "all",
            limit: 100,
          }),
        }
      );

      if (!response.ok) throw new Error("Search request failed");
      const data = (await response.json()) as { results?: Photo[] };
      setResults(data.results ?? []);
    } catch (error) {
      console.error("Apsara AI search failed:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const togglePerson = (personId: string) => {
    setSelectedSearchPeopleIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]
    );
  };

  const handleSubmitSearch = () => {
    if (!query.trim() && selectedSearchPeople.length === 1) {
      onPersonOpen?.(selectedSearchPeople[0]);
      onClose();
      return;
    }

    if (!query.trim() && selectedSearchPeople.length > 1) {
      onPeopleSelectionApply?.(selectedSearchPeople, "all");
      onClose();
      return;
    }

    handleSearch();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/10 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close Apsara AI"
      />

      <section
        className="relative z-10 flex h-full w-full max-w-[min(100vw,760px)] flex-col border-l border-zinc-200 bg-white shadow-xl transition-transform"
        onClick={(event) => event.stopPropagation()}
        aria-label="Apsara AI photo search"
      >
        <header className="flex items-start justify-between px-6 pb-3 pt-7 sm:px-12 sm:pt-10">
          <h2 className="text-3xl font-normal tracking-normal text-zinc-900 sm:text-4xl">
            Search
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-800 transition hover:bg-zinc-950/5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            aria-label="Close Apsara AI"
          >
            <X className="h-7 w-7 stroke-1" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 pb-28 pt-4 sm:px-12">
          {!hasSearched ? (
            <div className="space-y-6">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSubmitSearch();
                }}
              >
                <label className="flex h-12 items-center gap-3 rounded-md border border-zinc-500 px-4 text-zinc-900 focus-within:border-zinc-950">
                  <Search className="h-5 w-5 shrink-0 stroke-1.5" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search for keywords"
                    className="min-w-0 flex-1 bg-transparent text-base font-light tracking-normal outline-none placeholder:text-zinc-500"
                    aria-label="Search for keywords"
                    disabled={isSearching}
                  />
                </label>
              </form>

              <div className="space-y-3">
                <p className="text-lg font-light text-zinc-800">Try these:</p>
                <button
                  type="button"
                  onClick={() => handleSearch("wedding dress")}
                  className="rounded-full bg-zinc-100 px-4 py-2 text-base font-light text-zinc-700 transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                >
                  wedding dress
                </button>
              </div>

              <div className="h-px bg-zinc-200" />

              <section className="space-y-6">
                <h3 className="text-2xl font-normal tracking-normal text-zinc-900 sm:text-3xl">
                  Find Yourself and others
                </h3>

                {isLoadingPeople ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading people...
                  </div>
                ) : people.length ? (
                  <div className="flex flex-wrap gap-x-7 gap-y-7">
                    {people.map((person) => (
                      <PersonAvatarButton
                        key={person.id}
                        person={person}
                        isSelected={selectedSearchPeopleIds.includes(person.id)}
                        onClick={() => togglePerson(person.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-zinc-200 px-4 py-6 text-sm text-zinc-500">
                    No people detected in this album yet.
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="space-y-5">
              <button
                type="button"
                onClick={() => {
                  setHasSearched(false);
                  setResults([]);
                }}
                className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-950"
              >
                <ChevronLeft className="h-4 w-4" />
                Search again
              </button>

              <div>
                <p className="text-sm font-medium text-zinc-500">
                  {isSearching
                    ? "Searching photos..."
                    : results.length
                      ? `Found ${results.length} ${
                          results.length === 1 ? "photo" : "photos"
                        }`
                      : "No photos found"}
                </p>
                <h3 className="mt-1 text-3xl font-semibold tracking-normal text-zinc-950">
                  {query.trim() ||
                    selectedSearchPeople
                      .map((person) => person.displayName || person.defaultName)
                      .join(", ") ||
                    "Selected people"}
                </h3>
              </div>

              {isSearching && (
                <div className="flex items-center gap-2 py-10 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching photos...
                </div>
              )}

              {!isSearching && results.length === 0 && (
                <div className="rounded-md border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
                  No photos found. Try a person, event, outfit color, or moment.
                </div>
              )}

              {!isSearching && results.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {results.map((photo, index) => (
                    <ApsaraPhotoCard
                      key={photo.id}
                      photo={photo}
                      onClick={() => setSelectedPhotoIndex(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <form
          className="absolute inset-x-0 bottom-0 bg-white/95 px-6 py-4 shadow-[0_-20px_40px_rgba(0,0,0,0.08)] backdrop-blur sm:px-12"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmitSearch();
          }}
        >
          <button
            type="submit"
            disabled={isSearching || !canSearch}
            className="ml-auto flex h-12 w-full max-w-[220px] cursor-pointer items-center justify-center rounded-full bg-zinc-950 text-lg font-light text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
          >
            {isSearching ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              searchLabel
            )}
          </button>
        </form>
      </section>

      {selectedPhotoIndex !== null && (
        <ApsaraPhotoViewer
          albumSlug={albumSlug}
          photos={results}
          currentIndex={selectedPhotoIndex}
          onClose={() => setSelectedPhotoIndex(null)}
          onNavigate={setSelectedPhotoIndex}
        />
      )}
    </div>
  );
}

interface ApsaraMomentsRootProps {
  albumSlug: string;
  selectedEventSlug: string | null;
  selectedPeopleIds?: string[];
  peopleMatchMode?: PeopleMatchMode;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onPersonOpen?: (person: Person) => void;
  onPeopleSelectionApply?: (people: Person[], mode: PeopleMatchMode) => void;
}

export function ApsaraMomentsRoot({
  albumSlug,
  selectedEventSlug,
  selectedPeopleIds = [],
  peopleMatchMode = "all",
  isOpen: controlledIsOpen,
  onOpenChange,
  onPersonOpen,
  onPeopleSelectionApply,
}: ApsaraMomentsRootProps) {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;
  const setIsOpen = onOpenChange ?? setUncontrolledIsOpen;

  return (
    <>
      <ApsaraFloatingTrigger onClick={() => setIsOpen(true)} />
      <ApsaraMomentsOverlay
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        albumSlug={albumSlug}
        selectedEventSlug={selectedEventSlug}
        selectedPeopleIds={selectedPeopleIds}
        peopleMatchMode={peopleMatchMode}
        onPersonOpen={onPersonOpen}
        onPeopleSelectionApply={onPeopleSelectionApply}
      />
    </>
  );
}

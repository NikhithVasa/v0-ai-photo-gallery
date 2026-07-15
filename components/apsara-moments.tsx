"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
import {
  FindYourselfUpload,
  findPeopleBySelfie,
  type FaceMatch,
  type SelfieMatchedPhoto,
} from "@/components/find-yourself-upload";
import type { PeopleMatchMode } from "@/components/photos-grid";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import type { Person, Photo } from "@/lib/types";

interface ApsaraFloatingTriggerProps {
  onClick: () => void;
  galleryFooterVisible?: boolean;
  mobileGalleryActionsVisible?: boolean;
}

export function ApsaraFloatingTrigger({
  onClick,
  galleryFooterVisible = false,
  mobileGalleryActionsVisible = false,
}: ApsaraFloatingTriggerProps) {
  const footerOffset = galleryFooterVisible
    ? mobileGalleryActionsVisible
      ? "bottom-[9.5rem] sm:bottom-24"
      : "bottom-[5.5rem] sm:bottom-24"
    : "bottom-20 sm:bottom-7";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`fixed left-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-sm font-medium text-zinc-900 shadow-sm backdrop-blur transition hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-300 sm:left-auto sm:right-7 sm:w-auto sm:gap-2 sm:px-4 ${footerOffset}`}
      aria-label="Open SaathiDesk AI photo search"
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">SaathiDesk AI</span>
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

function albumApiUrl(albumSlug: string, path: string, shareToken = "") {
  return `/api/albums/${encodeURIComponent(albumSlug)}${path}${
    shareToken ? `?share=${encodeURIComponent(shareToken)}` : ""
  }`;
}

async function getDownloadUrl(albumSlug: string, photo: Photo, shareToken = "") {
  if (photo.downloadUrl) return photo.downloadUrl;

  const response = await fetch(
    albumApiUrl(albumSlug, "/photos/signed-urls", shareToken),
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

async function photoFromSelfieMatch(
  albumSlug: string,
  matchedPhoto: SelfieMatchedPhoto,
  shareToken = "",
): Promise<Photo> {
  const response = await fetch(
    albumApiUrl(albumSlug, "/photos/signed-urls", shareToken),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds: [matchedPhoto.id] }),
    },
  );
  const data = response.ok
    ? ((await response.json()) as {
        urls?: Record<
          string,
          {
            previewUrl: string | null;
            downloadUrl: string | null;
            thumbnailUrl: string | null;
          }
        >;
      })
    : { urls: {} };
  const urls = data.urls?.[matchedPhoto.id];

  return {
    id: matchedPhoto.id,
    albumId: "",
    albumSlug,
    eventId: "",
    eventSlug: matchedPhoto.eventSlug,
    eventName: "Closest match",
    fileName: matchedPhoto.fileName,
    caption: null,
    searchText: null,
    previewUrl: urls?.previewUrl ?? urls?.thumbnailUrl ?? null,
    thumbnailUrl: urls?.thumbnailUrl ?? urls?.previewUrl ?? null,
    downloadUrl: urls?.downloadUrl ?? null,
    width: null,
    height: null,
  };
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
      className="group flex w-16 flex-col items-center gap-2 text-center focus:outline-none sm:w-20"
      aria-pressed={isSelected}
      aria-label={`${isSelected ? "Remove" : "Select"} ${name}`}
    >
      <span
        className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 transition sm:h-16 sm:w-16 ${
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
  shareToken = "",
  downloadsEnabled = true,
  photos,
  currentIndex,
  onClose,
  onNavigate,
}: {
  albumSlug: string;
  shareToken?: string;
  downloadsEnabled?: boolean;
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
      const url = await getDownloadUrl(albumSlug, photo, shareToken);
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
          {downloadsEnabled && (
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
            )}
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
  shareToken?: string;
  downloadsEnabled?: boolean;
  selectedEventSlug: string | null;
  selectedPeopleIds?: string[];
  peopleMatchMode?: PeopleMatchMode;
  onPersonOpen?: (person: Person) => void;
  onPeopleSelectionApply?: (people: Person[], mode: PeopleMatchMode) => void;
  onTextSearch?: (query: string, people: Person[]) => void;
}

export function ApsaraMomentsOverlay({
  isOpen,
  onClose,
  albumSlug,
  shareToken = "",
  downloadsEnabled = true,
  selectedEventSlug,
  selectedPeopleIds = [],
  peopleMatchMode = "all",
  onPersonOpen,
  onPeopleSelectionApply,
  onTextSearch,
}: ApsaraMomentsOverlayProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [resultsTitle, setResultsTitle] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Photo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoadingPeople, setIsLoadingPeople] = useState(false);
  const [isFindingPerson, setIsFindingPerson] = useState(false);
  const [isFindYourselfOpen, setIsFindYourselfOpen] = useState(false);
  const [findPersonError, setFindPersonError] = useState("");
  const [findPersonMessage, setFindPersonMessage] = useState("");
  const [faceMatches, setFaceMatches] = useState<FaceMatch[] | null>(null);
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

  const visibleSearchPeople = useMemo(() => {
    if (faceMatches === null) return people;
    const faceMatchIds = new Set(faceMatches.map((match) => match.personId));
    return people.filter((person) => faceMatchIds.has(person.id));
  }, [faceMatches, people]);

  const searchLabel = selectedPeopleCount
    ? `Search (${selectedPeopleCount})`
    : "Search";

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResultsTitle("");
      setResults([]);
      setHasSearched(false);
      setSelectedSearchPeopleIds([]);
      setFaceMatches(null);
      setIsFindYourselfOpen(false);
      setFindPersonError("");
      setFindPersonMessage("");
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

    fetch(albumApiUrl(albumSlug, "/people", shareToken))
      .then(async (response) => {
        if (!response.ok) throw new Error("People request failed");
        return (await response.json()) as { people?: Person[] };
      })
      .then((data) => {
        if (isCancelled) return;
        setPeople(data.people ?? []);
      })
      .catch((error) => {
        console.error("Failed to load people for SaathiDesk search:", error);
        if (!isCancelled) setPeople([]);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingPeople(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [albumSlug, shareToken, isOpen]);

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
        albumApiUrl(albumSlug, "/search", shareToken),
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

      if (response.status === 401 || response.status === 403) {
        const next = `${window.location.pathname}${window.location.search}`;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      if (!response.ok) throw new Error("Search request failed");
      const data = (await response.json()) as { results?: Photo[] };
      setResults(data.results ?? []);
      setResultsTitle(
        activeQuery ||
          selectedSearchPeople
            .map((person) => person.displayName || person.defaultName)
            .join(", ") ||
          "Selected people",
      );
    } catch (error) {
      console.error("SaathiDesk AI search failed:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const togglePerson = (personId: string) => {
    setFindPersonMessage("");
    setSelectedSearchPeopleIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]
    );
  };

  const findPersonByUpload = async (file: File) => {
    if (isFindingPerson) return;

    setIsFindingPerson(true);
    setFindPersonError("");
    setFindPersonMessage("");

    try {
      const result = await findPeopleBySelfie({
        albumSlug,
        shareToken,
        selectedEventSlug,
        image: file,
      });
      const matches = result.matches;
      const matchIds = matches.map((match) => match.personId);
      const matchedIdSet = new Set(matchIds);
      const matchedPeople = people.filter((person) =>
        matchedIdSet.has(person.id),
      );

      if (!matchIds.length) {
        setSelectedSearchPeopleIds([]);
        setFaceMatches([]);
        if (result.matchedPhoto) {
          const photo = await photoFromSelfieMatch(
            albumSlug,
            result.matchedPhoto,
            shareToken,
          );
          setResults([photo]);
          setResultsTitle("Closest photo match");
          setHasSearched(true);
          return;
        }

        setFindPersonError("No matching embedded photo was found.");
        return;
      }

      setSelectedSearchPeopleIds([]);
      setFaceMatches(matches);
      setFindPersonMessage(
        matchedPeople.length
          ? `${matchedPeople.length} matched ${
              matchedPeople.length === 1 ? "person" : "people"
            } shown below.`
          : `${matchIds.length} matched ${
              matchIds.length === 1 ? "person" : "people"
            } shown below.`,
      );
    } catch (error) {
      setFindPersonError(
        error instanceof Error
          ? error.message
          : "Could not search for this person.",
      );
    } finally {
      setIsFindingPerson(false);
    }
  };

  const handleSubmitSearch = () => {
    const activeQuery = query.trim();

    if (activeQuery) {
      onTextSearch?.(activeQuery, selectedSearchPeople);
      onClose();
      return;
    }

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
        aria-label="Close SaathiDesk AI"
      />

      <section
        className="relative z-10 flex h-full w-full max-w-[min(100vw,760px)] flex-col border-l border-zinc-200 bg-white shadow-xl transition-transform"
        onClick={(event) => event.stopPropagation()}
        aria-label="SaathiDesk AI photo search"
      >
        <header className="flex items-start justify-between px-6 pb-3 pt-7 sm:px-12 sm:pt-10">
          <h2 className="text-3xl font-normal tracking-normal text-zinc-900 sm:text-4xl">
            Search
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-800 transition hover:bg-zinc-950/5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            aria-label="Close SaathiDesk AI"
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
                  <Search className="h-5 w-5 shrink-0" strokeWidth={1.5} />
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
                  onClick={() => {
                    onTextSearch?.("wedding dress", selectedSearchPeople);
                    onClose();
                  }}
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

                {!isFindYourselfOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFindYourselfOpen(true);
                      setFindPersonError("");
                      setFindPersonMessage("");
                    }}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-4 text-base font-light text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300 sm:w-fit"
                  >
                    <User className="h-5 w-5" />
                    Find yourself
                  </button>
                ) : (
                  <div className="origin-top rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition duration-200 animate-in fade-in zoom-in-95">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-800">
                        Find yourself
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (isFindingPerson) return;
                          setIsFindYourselfOpen(false);
                          setFindPersonError("");
                          setFindPersonMessage("");
                        }}
                        disabled={isFindingPerson}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-40"
                        aria-label="Collapse find yourself upload"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <FindYourselfUpload
                      compact
                      isSubmitting={isFindingPerson}
                      error={findPersonError}
                      onErrorChange={setFindPersonError}
                      onSubmit={findPersonByUpload}
                      submitLabel="Find yourself"
                      submittingLabel="Finding..."
                    />
                    {findPersonMessage ? (
                      <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                        {findPersonMessage}
                      </p>
                    ) : null}
                  </div>
                )}

                {faceMatches !== null ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-950">
                        {visibleSearchPeople.length
                          ? `${visibleSearchPeople.length} matched ${
                              visibleSearchPeople.length === 1
                                ? "person"
                                : "people"
                            }`
                          : "No labeled people found"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {visibleSearchPeople.length
                          ? "Only these people are shown below. Select anyone you want to search."
                          : "The closest photo has no labeled people yet."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFaceMatches(null);
                        setFindPersonMessage("");
                      }}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-600 transition hover:text-zinc-950"
                    >
                      Show all people
                    </button>
                  </div>
                ) : null}

                {isLoadingPeople ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading people...
                  </div>
                ) : visibleSearchPeople.length ? (
                  <div className="grid grid-cols-4 gap-x-2 gap-y-5 sm:flex sm:flex-wrap sm:gap-x-7 sm:gap-y-7">
                    {visibleSearchPeople.map((person) => (
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
                  setFaceMatches(null);
                  setFindPersonMessage("");
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
                    resultsTitle ||
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
          shareToken={shareToken}
          downloadsEnabled={downloadsEnabled}
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
  shareToken?: string;
  downloadsEnabled?: boolean;
  selectedEventSlug: string | null;
  selectedPeopleIds?: string[];
  peopleMatchMode?: PeopleMatchMode;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onPersonOpen?: (person: Person) => void;
  onPeopleSelectionApply?: (people: Person[], mode: PeopleMatchMode) => void;
  onTextSearch?: (query: string, people: Person[]) => void;
  galleryFooterVisible?: boolean;
  mobileGalleryActionsVisible?: boolean;
}

export function ApsaraMomentsRoot({
  albumSlug,
  shareToken = "",
  downloadsEnabled = true,
  selectedEventSlug,
  selectedPeopleIds = [],
  peopleMatchMode = "all",
  isOpen: controlledIsOpen,
  onOpenChange,
  onPersonOpen,
  onPeopleSelectionApply,
  onTextSearch,
  galleryFooterVisible = false,
  mobileGalleryActionsVisible = false,
}: ApsaraMomentsRootProps) {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;
  const setIsOpen = onOpenChange ?? setUncontrolledIsOpen;

  return (
    <>
      <ApsaraFloatingTrigger
        onClick={() => setIsOpen(true)}
        galleryFooterVisible={galleryFooterVisible}
        mobileGalleryActionsVisible={mobileGalleryActionsVisible}
      />
      <ApsaraMomentsOverlay
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        albumSlug={albumSlug}
        shareToken={shareToken}
        downloadsEnabled={downloadsEnabled}
        selectedEventSlug={selectedEventSlug}
        selectedPeopleIds={selectedPeopleIds}
        peopleMatchMode={peopleMatchMode}
        onPersonOpen={onPersonOpen}
        onPeopleSelectionApply={onPeopleSelectionApply}
        onTextSearch={onTextSearch}
      />
    </>
  );
}

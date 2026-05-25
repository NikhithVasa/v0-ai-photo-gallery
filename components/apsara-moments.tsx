"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  MessageCircle,
  Search,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import type { PeopleMatchMode } from "@/components/photos-grid";
import type { Photo } from "@/lib/types";

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

interface ApsaraPromptChipsProps {
  onChipClick: (text: string) => void;
}

function ApsaraPromptChips({ onChipClick }: ApsaraPromptChipsProps) {
  const chips = [
    "Candid smiling moments",
    "Photos with parents",
    "Bride and groom portraits",
    "Dance floor",
    "Family near mandap",
  ];

  return (
    <div className="flex gap-2 overflow-x-auto px-5 pb-4">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onChipClick(chip)}
          className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300"
        >
          {chip}
        </button>
      ))}
    </div>
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
}

export function ApsaraMomentsOverlay({
  isOpen,
  onClose,
  albumSlug,
  selectedEventSlug,
  selectedPeopleIds = [],
  peopleMatchMode = "all",
}: ApsaraMomentsOverlayProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Photo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(
    null
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setHasSearched(false);
      setSelectedPhotoIndex(null);
      return;
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

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
    if (!activeQuery) return;

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
            people: selectedPeopleIds,
            together: peopleMatchMode === "all",
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
        className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-zinc-200 bg-white shadow-xl transition-transform"
        onClick={(event) => event.stopPropagation()}
        aria-label="Apsara AI photo search"
      >
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-700">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-zinc-950">
                Apsara AI
              </h2>
              <p className="text-xs text-zinc-500">
                Search your gallery in natural language.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            aria-label="Close Apsara AI"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-5 max-w-[88%] rounded-2xl rounded-tl-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm">
            What photo are you looking for?
          </div>

          {isSearching && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching photos...
            </div>
          )}

          {!isSearching && hasSearched && results.length === 0 && (
            <div className="rounded-md border border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
              No photos found. Try a person, event, outfit color, or moment.
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <div className="space-y-4">
              <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-md bg-zinc-950 px-4 py-3 text-sm text-white">
                {query}
              </div>
              <p className="text-sm text-zinc-500">
                Found {results.length} {results.length === 1 ? "photo" : "photos"}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {results.map((photo, index) => (
                  <ApsaraPhotoCard
                    key={photo.id}
                    photo={photo}
                    onClick={() => setSelectedPhotoIndex(index)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {!hasSearched && <ApsaraPromptChips onChipClick={handleSearch} />}

        <form
          className="border-t border-zinc-200 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSearch();
          }}
        >
          <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-zinc-300">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find photos of Nikhith dancing..."
              className="min-w-0 flex-1 bg-transparent px-1 text-sm text-zinc-950 outline-none placeholder:text-zinc-400"
              aria-label="Search photos with Apsara AI"
              disabled={isSearching}
            />
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Search photos"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </button>
          </div>
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
}

export function ApsaraMomentsRoot({
  albumSlug,
  selectedEventSlug,
  selectedPeopleIds = [],
  peopleMatchMode = "all",
  isOpen: controlledIsOpen,
  onOpenChange,
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
      />
    </>
  );
}

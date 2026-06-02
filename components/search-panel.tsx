"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { MessageCircle, X, Search, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Photo } from "@/lib/types";

interface SearchPanelProps {
  albumSlug: string;
  selectedEventSlug: string | null;
  selectedPeopleIds: string[];
  isOpen: boolean;
  onClose: () => void;
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

export function SearchPanel({
  albumSlug,
  selectedEventSlug,
  selectedPeopleIds,
  isOpen,
  onClose,
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setResults([]);
    setHasSearched(false);
  }, [albumSlug, selectedEventSlug, selectedPeopleIds]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: query.trim(),
            event: selectedEventSlug,
            people: selectedPeopleIds,
            together: true,
            limit: 100,
          }),
        }
      );

      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  const handleDownload = async (photo: Photo) => {
    try {
      const url = await getDownloadUrl(albumSlug, photo);
      if (!url) return;
      triggerDownload(url, photo.fileName || `photo-${photo.id}.jpg`);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className="fixed right-0 top-0 h-full w-full max-w-[min(32rem,100vw)] border-l border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border p-4">
            <h2 className="min-w-0 truncate text-lg font-semibold text-foreground">Apsara AI</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Search Input */}
          <div className="p-4 border-b border-border">
            <div className="flex min-w-0 gap-2">
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Apsara AI: photos of Nikhith dancing with Kishore"
                className="min-w-0 flex-1"
              />
              <Button onClick={handleSearch} disabled={isLoading || !query.trim()}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "photos of person 93",
                "photos dancing",
                "photos eating",
                "emotional moments",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setQuery(example)}
                  className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-md hover:bg-accent transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && hasSearched && results.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No photos found for your search.
              </div>
            )}

            {!isLoading && results.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Found {results.length} {results.length === 1 ? "photo" : "photos"}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="group relative rounded-lg overflow-hidden border border-border bg-muted"
                    >
                      <div className="aspect-square relative">
                        {result.thumbnailUrl || result.previewUrl ? (
                          <Image
                            src={result.thumbnailUrl || result.previewUrl || ""}
                            alt="Search result"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-secondary">
                            <span className="text-muted-foreground text-xs">
                              No preview
                            </span>
                          </div>
                        )}
                      </div>

                      {(result.personSearchText ||
                        result.qwenDescription ||
                        result.caption) && (
                        <div className="p-2 bg-card">
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {result.personSearchText ||
                              result.qwenDescription ||
                              result.caption}
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => handleDownload(result)}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Download photo"
                      >
                        <Download className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isLoading && !hasSearched && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-2">Try searching for:</p>
                <ul className="text-sm space-y-1">
                  <li>photos of person 93</li>
                  <li>photos of nikhith dancing</li>
                  <li>photos of nikhith with kishore</li>
                  <li>photos of nikhith being emotional</li>
                  <li>photos with side face</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FloatingSearchButtonProps {
  albumSlug: string;
  selectedEventSlug: string | null;
  selectedPeopleIds?: string[];
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export function FloatingSearchButton({
  albumSlug,
  selectedEventSlug,
  selectedPeopleIds = [],
  isOpen: controlledIsOpen,
  onOpenChange,
}: FloatingSearchButtonProps) {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;
  const setIsOpen = onOpenChange ?? setUncontrolledIsOpen;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background sm:bottom-6 sm:right-6"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="font-medium">Apsara AI</span>
      </button>

      <SearchPanel
        albumSlug={albumSlug}
        selectedEventSlug={selectedEventSlug}
        selectedPeopleIds={selectedPeopleIds}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

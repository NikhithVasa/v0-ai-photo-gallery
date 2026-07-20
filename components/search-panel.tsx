"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Clock3,
  Database,
  Download,
  Loader2,
  MessageCircle,
  Search,
  Server,
  Terminal,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { SITE_NAME } from "@/lib/seo";
import type { Photo } from "@/lib/types";

interface SearchPanelProps {
  albumSlug: string;
  selectedEventSlug: string | null;
  selectedPeopleIds: string[];
  isOpen: boolean;
  onClose: () => void;
}

type SearchMode = "semantic" | "keyword" | "person_filter";

interface SearchDebugTopResult {
  rank: number;
  photoId: string;
  fileName: string | null;
  eventSlug: string | null;
  semanticScore: number | null;
  vectorDistance: number | null;
  captionSnippet: string | null;
}

interface SearchDiagnostics {
  requestId: string;
  albumSlug: string;
  query: string;
  eventSlug: string | null;
  limit: number;
  together: boolean;
  embedding: {
    provider: "openrouter";
    model: string;
    configured: boolean;
    attempted: boolean;
    ok: boolean;
    durationMs: number | null;
    httpStatus: number | null;
    dimension: number | null;
    expectedDimension: number;
    normBefore: number | null;
    normAfter: number | null;
    vectorPreview: number[] | null;
    error: string | null;
  };
  database: {
    embeddingCoverage: {
      completedPhotos: number;
      photosWithImageEmbedding: number;
      photosMissingImageEmbedding: number;
      eventCompletedPhotos: number;
      eventPhotosWithImageEmbedding: number;
      eventPhotosMissingImageEmbedding: number;
      durationMs: number;
    };
    semanticSearch: {
      attempted: boolean;
      durationMs: number | null;
      rowsReturned: number;
      topResults: SearchDebugTopResult[];
      fallbackReason: string | null;
    };
    keywordFallback: {
      attempted: boolean;
      durationMs: number | null;
      keyword: string | null;
      rowsReturned: number;
      topResults: SearchDebugTopResult[];
    };
  };
  final: {
    searchMode: SearchMode;
    returnedResults: number;
    resolvedPeople: number;
    totalDurationMs: number;
    semanticError: string | null;
  };
}

interface SearchResponse {
  query?: string;
  searchMode?: SearchMode;
  semanticModel?: string | null;
  semanticError?: string | null;
  debugRequestId?: string;
  debug?: SearchDiagnostics;
  results?: Photo[];
  error?: string;
}

function formatDuration(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toLocaleString()} ms` : "not run";
}

function formatPercent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
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

function SearchDiagnosticsPanel({
  diagnostics,
  error,
  isLoading,
}: {
  diagnostics: SearchDiagnostics | null;
  error: string | null;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <div>
          <p className="font-medium text-foreground">Tracing AI search</p>
          <p className="text-xs text-muted-foreground">
            Calling OpenRouter, checking embedding coverage, then querying PGVector.
          </p>
        </div>
      </div>
    );
  }

  if (error && !diagnostics) {
    return (
      <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Search request failed
        </div>
        <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
          {error}
        </p>
      </div>
    );
  }

  if (!diagnostics) return null;

  const { embedding, database, final } = diagnostics;
  const coverage = database.embeddingCoverage;
  const semantic = database.semanticSearch;
  const keyword = database.keywordFallback;
  const usedOpenRouter = embedding.attempted && embedding.ok;
  const usedPgVector =
    final.searchMode === "semantic" &&
    semantic.attempted &&
    semantic.rowsReturned > 0;
  const eventCoverage = formatPercent(
    coverage.eventPhotosWithImageEmbedding,
    coverage.eventCompletedPhotos,
  );

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (copyError) {
      console.error(`[${SITE_NAME} AI Search] Copy diagnostics failed`, copyError);
    }
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mb-4 overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Search diagnostics
            </span>
            <Badge
              variant={usedPgVector ? "default" : "secondary"}
              className="font-mono uppercase"
            >
              {final.searchMode}
            </Badge>
          </div>
          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
            request {diagnostics.requestId}
          </p>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="shrink-0 gap-1">
            Details
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border">
        <div className="bg-card p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {usedOpenRouter ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            )}
            OpenRouter embedding
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {usedOpenRouter ? "Used successfully" : "Not used"}
          </p>
          <p className="mt-1 break-words font-mono text-[10px] text-muted-foreground">
            {embedding.model}
          </p>
        </div>

        <div className="bg-card p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Database className="h-3.5 w-3.5 text-primary" />
            PGVector cosine search
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {usedPgVector ? "Used successfully" : "Not used"}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {semantic.rowsReturned} semantic rows
          </p>
        </div>

        <div className="bg-card p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Server className="h-3.5 w-3.5 text-primary" />
            Event vector coverage
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {coverage.eventPhotosWithImageEmbedding}/
            {coverage.eventCompletedPhotos} ({eventCoverage})
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {coverage.eventPhotosMissingImageEmbedding} missing
          </p>
        </div>

        <div className="bg-card p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5 text-primary" />
            Total duration
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {formatDuration(final.totalDurationMs)}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {final.returnedResults} results returned
          </p>
        </div>
      </div>

      <CollapsibleContent>
        <div className="space-y-4 p-3 text-xs">
          <section>
            <h3 className="mb-2 font-semibold text-foreground">
              OpenRouter → Gemini embedding
            </h3>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-muted-foreground">
              <dt>Configured</dt>
              <dd className="font-mono">{String(embedding.configured)}</dd>
              <dt>Attempted / succeeded</dt>
              <dd className="font-mono">
                {String(embedding.attempted)} / {String(embedding.ok)}
              </dd>
              <dt>HTTP status</dt>
              <dd className="font-mono">{embedding.httpStatus ?? "—"}</dd>
              <dt>Dimensions</dt>
              <dd className="font-mono">
                {embedding.dimension ?? "—"} / expected {embedding.expectedDimension}
              </dd>
              <dt>Embedding duration</dt>
              <dd className="font-mono">{formatDuration(embedding.durationMs)}</dd>
              <dt>Vector norm before / after</dt>
              <dd className="font-mono">
                {embedding.normBefore ?? "—"} / {embedding.normAfter ?? "—"}
              </dd>
            </dl>
            {embedding.vectorPreview && (
              <p className="mt-2 break-all rounded bg-muted p-2 font-mono text-[10px]">
                vector preview: [{embedding.vectorPreview.join(", ")}]
              </p>
            )}
            {embedding.error && (
              <p className="mt-2 break-words rounded bg-destructive/10 p-2 font-mono text-destructive">
                {embedding.error}
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-foreground">
              PGVector database search
            </h3>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-muted-foreground">
              <dt>Semantic query attempted</dt>
              <dd className="font-mono">{String(semantic.attempted)}</dd>
              <dt>Semantic query duration</dt>
              <dd className="font-mono">{formatDuration(semantic.durationMs)}</dd>
              <dt>Semantic rows</dt>
              <dd className="font-mono">{semantic.rowsReturned}</dd>
              <dt>Coverage query duration</dt>
              <dd className="font-mono">{formatDuration(coverage.durationMs)}</dd>
              <dt>Fallback reason</dt>
              <dd className="max-w-56 break-words text-right font-mono">
                {semantic.fallbackReason ?? "none"}
              </dd>
              <dt>Keyword fallback</dt>
              <dd className="font-mono">
                {keyword.attempted
                  ? `${keyword.rowsReturned} rows in ${formatDuration(keyword.durationMs)}`
                  : "not used"}
              </dd>
            </dl>
          </section>

          {semantic.topResults.length > 0 && (
            <section>
              <h3 className="mb-2 font-semibold text-foreground">
                Top PGVector matches
              </h3>
              <div className="space-y-1.5">
                {semantic.topResults.slice(0, 10).map((result) => (
                  <div
                    key={`${result.rank}-${result.photoId}`}
                    className="rounded border border-border bg-muted/40 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium text-foreground">
                        #{result.rank} {result.fileName || result.photoId}
                      </span>
                      <span className="shrink-0 font-mono text-[10px]">
                        score {result.semanticScore ?? "—"}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      distance {result.vectorDistance ?? "—"} · {result.eventSlug || "all"}
                    </p>
                    {result.captionSnippet && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                        {result.captionSnippet}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground">Raw diagnostics</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={copyDiagnostics}
              >
                <Clipboard className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="max-h-80 overflow-auto rounded bg-muted p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
          </section>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
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
  const [diagnostics, setDiagnostics] = useState<SearchDiagnostics | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setResults([]);
    setHasSearched(false);
    setDiagnostics(null);
    setSearchError(null);
  }, [albumSlug, selectedEventSlug, selectedPeopleIds]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    const startedAt = performance.now();
    const requestPayload = {
      query: query.trim(),
      event: selectedEventSlug,
      people: selectedPeopleIds,
      together: true,
      limit: 100,
    };

    setIsLoading(true);
    setHasSearched(true);
    setSearchError(null);
    setDiagnostics(null);
    console.groupCollapsed(
      `[${SITE_NAME} AI Search] Request: ${requestPayload.query}`,
    );
    console.info("Request payload", {
      albumSlug,
      ...requestPayload,
    });
    console.info(
      "Expected path",
      "OpenRouter google/gemini-embedding-2 (768D) → PostgreSQL pgvector cosine distance",
    );
    console.groupEnd();

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        }
      );

      const data = (await response.json()) as SearchResponse;
      if (!response.ok) {
        throw new Error(data.error || `Search failed with HTTP ${response.status}`);
      }

      setResults(data.results || []);
      setDiagnostics(data.debug || null);

      console.groupCollapsed(
        `[${SITE_NAME} AI Search] Result: ${data.searchMode || "unknown"} · ${
          data.results?.length || 0
        } photos`,
      );
      console.info("HTTP", {
        status: response.status,
        clientDurationMs: Number((performance.now() - startedAt).toFixed(2)),
        debugRequestId: data.debugRequestId,
      });
      console.info("Final search mode", {
        searchMode: data.searchMode,
        semanticModel: data.semanticModel,
        semanticError: data.semanticError,
      });
      if (data.debug) {
        console.info("OpenRouter embedding", data.debug.embedding);
        console.info(
          "Embedding coverage",
          data.debug.database.embeddingCoverage,
        );
        console.info("PGVector semantic search", data.debug.database.semanticSearch);
        console.info("Keyword fallback", data.debug.database.keywordFallback);
        console.table(data.debug.database.semanticSearch.topResults);
        console.info("Complete diagnostics", data.debug);
      } else {
        console.warn("The API returned no structured search diagnostics.");
      }
      console.groupEnd();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${SITE_NAME} AI Search] Failed`, {
        error: message,
        clientDurationMs: Number((performance.now() - startedAt).toFixed(2)),
        albumSlug,
        requestPayload,
      });
      setSearchError(message);
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
        className="fixed right-0 top-0 h-full w-full max-w-[min(40rem,100vw)] border-l border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border p-4">
            <h2 className="min-w-0 truncate text-lg font-semibold text-foreground">{SITE_NAME} AI</h2>
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
                placeholder={`Ask ${SITE_NAME} AI: photos of Nikhith dancing with Kishore`}
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
            <SearchDiagnosticsPanel
              diagnostics={diagnostics}
              error={searchError}
              isLoading={isLoading}
            />

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
        <span className="font-medium">{SITE_NAME} AI</span>
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

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Download,
  Gem,
  ImageOff,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { RetryingImage } from "@/components/retrying-image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { photoPreviewImageUrl } from "@/lib/photo-image-url";
import { cn } from "@/lib/utils";
import type {
  AiReviewPersonGroup,
  AiReviewPhoto,
  AlbumDetail,
  CullingCluster,
  CullingClusterItem,
} from "@/lib/types";

type ReviewMode =
  | "all"
  | "problems"
  | "low_score"
  | "duplicates"
  | "photo_type"
  | "by_person";

interface AiCullingPageProps {
  albumSlug: string;
}

interface ReviewResponse {
  photos: AiReviewPhoto[];
}

interface BestByPersonResponse {
  groups: AiReviewPersonGroup[];
}

interface CullingClustersResponse {
  clusters: CullingCluster[];
}

interface CullingClusterItemsResponse {
  items: CullingClusterItem[];
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

const aiInferenceFetcher = async (url: string) => {
  const data = await fetcher(url);
  console.log(`[AI Culling] AI/LLM inference JSON (${url}):`, data);
  return data;
};

const MODES: Array<{
  key: ReviewMode;
  label: string;
  icon: typeof Sparkles;
  limit?: number;
}> = [
  { key: "all", label: "All photos", icon: ImageOff, limit: 250 },
  { key: "problems", label: "Needs review", icon: AlertTriangle, limit: 200 },
  { key: "low_score", label: "Low score", icon: AlertTriangle, limit: 200 },
  { key: "duplicates", label: "Duplicates", icon: Copy, limit: 200 },
  { key: "photo_type", label: "Photo type/tag", icon: Gem, limit: 120 },
  { key: "by_person", label: "By Person", icon: Users },
];

const MODE_KEYS = new Set<ReviewMode>(MODES.map((item) => item.key));

function initialMode(value: string | null): ReviewMode {
  if (value === "best") return "all";
  return value && MODE_KEYS.has(value as ReviewMode)
    ? (value as ReviewMode)
    : "all";
}

function scoreLabel(value: number | null) {
  return value === null ? "-" : Math.round(value).toString();
}

function scoreClass(value: number | null) {
  if (value === null) return "bg-zinc-100 text-zinc-500 ring-zinc-200";
  const normalized = value > 10 ? value / 10 : value;
  if (normalized >= 8) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (normalized >= 6) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

function isClusterMode(mode: ReviewMode) {
  return (
    mode === "problems" ||
    mode === "low_score" ||
    mode === "duplicates"
  );
}

function clusterModeParam(mode: ReviewMode) {
  if (mode === "problems") return "needs_review";
  return mode;
}

function withShareParam(url: string, shareToken = "") {
  if (!shareToken) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}share=${encodeURIComponent(shareToken)}`;
}

function reviewUrl(
  albumSlug: string,
  mode: ReviewMode,
  eventSlug: string,
  shareToken = "",
) {
  if (mode === "by_person" || isClusterMode(mode)) return null;

  const selectedMode = MODES.find((item) => item.key === mode);
  const params = new URLSearchParams({
    mode: mode === "all" ? "all" : "decor",
    limit: String(selectedMode?.limit ?? 100),
  });

  if (eventSlug) params.set("event", eventSlug);

  return withShareParam(
    `/api/albums/${encodeURIComponent(albumSlug)}/ai/review?${params.toString()}`,
    shareToken,
  );
}

function clustersUrl(
  albumSlug: string,
  mode: ReviewMode,
  eventSlug: string,
  shareToken = "",
) {
  if (!isClusterMode(mode)) return null;

  const selectedMode = MODES.find((item) => item.key === mode);
  const params = new URLSearchParams({
    mode: clusterModeParam(mode),
    limit: String(selectedMode?.limit ?? 200),
  });

  if (eventSlug) {
    return withShareParam(
      `/api/albums/${encodeURIComponent(
        albumSlug,
      )}/events/${encodeURIComponent(eventSlug)}/culling/clusters?${params.toString()}`,
      shareToken,
    );
  }

  return withShareParam(
    `/api/albums/${encodeURIComponent(
      albumSlug,
    )}/culling/clusters?${params.toString()}`,
    shareToken,
  );
}

function bestByPersonUrl(
  albumSlug: string,
  mode: ReviewMode,
  eventSlug: string,
  shareToken = "",
) {
  if (mode !== "by_person") return null;

  const params = new URLSearchParams({
    perPerson: "10",
    peopleLimit: "32",
  });

  if (eventSlug) params.set("event", eventSlug);

  return withShareParam(
    `/api/albums/${encodeURIComponent(albumSlug)}/ai/best-by-person?${params.toString()}`,
    shareToken,
  );
}

function clusterToReviewPhoto(cluster: CullingCluster): AiReviewPhoto | null {
  if (!cluster.photo || !cluster.bestPhotoId) return null;

  return {
    photo: {
      id: cluster.photo.id,
      albumId: "",
      albumSlug: cluster.albumSlug,
      eventId: "",
      eventSlug: cluster.eventSlug,
      eventName: cluster.eventSlug,
      fileName: cluster.photo.fileName,
      caption: null,
      searchText: null,
      previewUrl: cluster.photo.previewUrl,
      thumbnailUrl: cluster.photo.thumbnailUrl,
      downloadUrl: null,
      width: null,
      height: null,
      thumbnailS3Key: cluster.photo.thumbnailS3Key,
      cleanPreviewS3Key: cluster.photo.cleanPreviewS3Key,
      watermarkedPreviewS3Key: cluster.photo.watermarkedPreviewS3Key,
    },
    ai: {
      albumScore: cluster.score,
      clarityScore: cluster.scoreDetails.technicalScore,
      backgroundScore: cluster.scoreDetails.faceScore,
      cameraGaze: cluster.scoreDetails.gazeScore
        ? String(Math.round(cluster.scoreDetails.gazeScore))
        : null,
      decorationKeywords: cluster.clusterType,
      reason: cluster.reason,
      qwenStatus: "completed",
      peopleCount: null,
      qwenJson: null,
    },
  };
}

function downloadSelected(albumSlug: string, photoIds: string[], shareToken = "") {
  if (!photoIds.length) return;

  const params = new URLSearchParams({ photos: photoIds.join(",") });
  if (shareToken) params.set("share", shareToken);
  window.location.href = `/api/albums/${encodeURIComponent(
    albumSlug,
  )}/downloads?${params.toString()}`;
}

function PhotoTile({
  item,
  state,
  isActive,
  onSelect,
  onKeep,
  onReject,
  shareToken = "",
}: {
  item: AiReviewPhoto;
  state: "kept" | "rejected" | null;
  isActive: boolean;
  onSelect: () => void;
  onKeep: () => void;
  onReject: () => void;
  shareToken?: string;
}) {
  const { photo, ai } = item;
  const imageUrl = photoPreviewImageUrl(photo, shareToken);

  return (
    <article
      className={cn(
        "break-inside-avoid overflow-hidden rounded-md bg-white shadow-sm ring-1 transition",
        isActive ? "ring-2 ring-zinc-950" : "ring-zinc-200 hover:ring-zinc-400",
        state === "kept" && "ring-emerald-500",
        state === "rejected" && "opacity-60 ring-rose-300",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="relative block aspect-[4/5] w-full cursor-pointer overflow-hidden bg-zinc-100 text-left"
      >
        {imageUrl ? (
          <RetryingImage
            src={imageUrl}
            alt={photo.caption || photo.fileName || "Photo"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-zinc-400">
            <ImageOff className="h-8 w-8" />
          </span>
        )}

        <span
          className={cn(
            "absolute left-2 top-2 rounded-full px-2 py-1 text-xs font-semibold shadow-sm ring-1",
            scoreClass(ai.albumScore),
          )}
        >
          {scoreLabel(ai.albumScore)}
        </span>

        {state && (
          <span
            className={cn(
              "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm",
              state === "kept" ? "bg-emerald-600" : "bg-rose-600",
            )}
          >
            {state === "kept" ? (
              <Check className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </span>
        )}
      </button>

      <div className="space-y-3 p-3">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          <span>Clarity {scoreLabel(ai.clarityScore)}</span>
          <span>Background {scoreLabel(ai.backgroundScore)}</span>
        </div>

        {ai.reason && (
          <p className="line-clamp-2 text-sm leading-5 text-zinc-700">
            {ai.reason}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={state === "kept" ? "default" : "outline"}
            size="sm"
            onClick={onKeep}
            className="h-8"
          >
            <Check className="h-4 w-4" />
            Keep
          </Button>
          <Button
            type="button"
            variant={state === "rejected" ? "destructive" : "outline"}
            size="sm"
            onClick={onReject}
            className="h-8"
          >
            <X className="h-4 w-4" />
            Reject
          </Button>
        </div>
      </div>
    </article>
  );
}

function ClusterCard({
  cluster,
  state,
  isActive,
  onSelect,
  onKeep,
  onReject,
  onBestChanged,
  shareToken = "",
}: {
  cluster: CullingCluster;
  state: "kept" | "rejected" | null;
  isActive: boolean;
  onSelect: () => void;
  onKeep: () => void;
  onReject: () => void;
  onBestChanged: () => void;
  shareToken?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUpdatingBest, setIsUpdatingBest] = useState(false);
  const itemsUrl = isExpanded
    ? withShareParam(
        `/api/culling/clusters/${encodeURIComponent(cluster.clusterId)}/items`,
        shareToken,
      )
    : null;
  const { data, isLoading, mutate } = useSWR<CullingClusterItemsResponse>(
    itemsUrl,
    aiInferenceFetcher,
  );
  const photo = cluster.photo;
  const imageUrl = photo
    ? photoPreviewImageUrl(photo, shareToken)
    : null;
  const alternateCount = Math.max(cluster.similarCount - 1, 0);

  const setAsBest = async (photoId: string) => {
    if (isUpdatingBest) return;

    setIsUpdatingBest(true);

    try {
      const response = await fetch(
        `/api/culling/clusters/${encodeURIComponent(cluster.clusterId)}/best`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo_id: photoId }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not set best");

      await mutate();
      onBestChanged();
    } catch (error) {
      console.error("Could not set cluster best photo:", error);
    } finally {
      setIsUpdatingBest(false);
    }
  };

  return (
    <article
      className={cn(
        "break-inside-avoid overflow-hidden rounded-md bg-white shadow-sm ring-1 transition",
        isActive ? "ring-2 ring-zinc-950" : "ring-zinc-200 hover:ring-zinc-400",
        state === "kept" && "ring-emerald-500",
        state === "rejected" && "opacity-60 ring-rose-300",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="relative block aspect-[4/5] w-full cursor-pointer overflow-hidden bg-zinc-100 text-left"
      >
        {imageUrl ? (
          <RetryingImage
            src={imageUrl}
            alt={photo?.fileName || "Best photo"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-zinc-400">
            <ImageOff className="h-8 w-8" />
          </span>
        )}

        <span
          className={cn(
            "absolute left-2 top-2 rounded-full px-2 py-1 text-xs font-semibold shadow-sm ring-1",
            scoreClass(cluster.score),
          )}
        >
          Score {scoreLabel(cluster.score)}
        </span>

        <span className="absolute bottom-2 left-2 rounded-full bg-zinc-950/85 px-2 py-1 text-xs font-semibold text-white shadow-sm">
          Best of {cluster.similarCount}
        </span>
      </button>

      <div className="space-y-3 p-3">
        <div>
          <p className="truncate text-sm font-semibold text-zinc-950">
            {photo?.fileName || "Best photo"}
          </p>
          <p className="text-xs font-medium text-zinc-500">
            {alternateCount} similar hidden
          </p>
        </div>

        {cluster.reason && (
          <p className="line-clamp-2 text-sm leading-5 text-zinc-700">
            {cluster.reason}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={state === "kept" ? "default" : "outline"}
            size="sm"
            onClick={onKeep}
            className="h-8"
          >
            <Check className="h-4 w-4" />
            Keep
          </Button>
          <Button
            type="button"
            variant={state === "rejected" ? "destructive" : "outline"}
            size="sm"
            onClick={onReject}
            className="h-8"
          >
            <X className="h-4 w-4" />
            Reject
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded((current) => !current)}
          className="w-full"
        >
          <Copy className="h-4 w-4" />
          {isExpanded
            ? "Hide alternates"
            : `View ${alternateCount} alternates`}
        </Button>

        {isExpanded && (
          <div className="space-y-2 border-t border-zinc-100 pt-3">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-32 rounded-md" />
                <Skeleton className="h-32 rounded-md" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {(data?.items ?? []).map((item) => {
                  const itemImage = photoPreviewImageUrl(item.photo, shareToken);

                  return (
                    <div
                      key={item.photoId}
                      className={cn(
                        "overflow-hidden rounded-md border bg-zinc-50",
                        item.isBest ? "border-emerald-300" : "border-zinc-200",
                      )}
                    >
                      <div className="relative aspect-[4/5] bg-zinc-100">
                        {itemImage ? (
                          <RetryingImage
                            src={itemImage}
                            alt={item.photo.fileName || "Alternate photo"}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                        {item.isBest && (
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Best
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5 p-2">
                        <p className="truncate text-xs font-semibold text-zinc-800">
                          {item.photo.fileName || `Rank ${item.rankInCluster}`}
                        </p>
                        <p className="text-[11px] font-medium text-zinc-500">
                          Score {scoreLabel(item.qualityScore)}
                        </p>
                        {!shareToken && !item.isBest && (
                          <button
                            type="button"
                            disabled={isUpdatingBest}
                            onClick={() => setAsBest(item.photoId)}
                            className="h-7 w-full rounded-md bg-white text-[11px] font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:text-zinc-950 disabled:opacity-50"
                          >
                            Set as best
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function CullingLightbox({
  item,
  photos,
  state,
  onKeep,
  onReject,
  onClose,
  onPrev,
  onNext,
  shareToken = "",
}: {
  item: AiReviewPhoto;
  photos: AiReviewPhoto[];
  state: "kept" | "rejected" | null;
  onKeep: () => void;
  onReject: () => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  shareToken?: string;
}) {
  useBodyScrollLock(true);

  const imageUrl = photoPreviewImageUrl(item.photo, shareToken);
  const index = photos.findIndex((p) => p.photo.id === item.photo.id);
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "ArrowLeft" && hasPrev) {
        onPrev();
      } else if (e.key === "ArrowRight" && hasNext) {
        onNext();
      } else if (e.key.toLowerCase() === "k") {
        onKeep();
      } else if (e.key.toLowerCase() === "r") {
        onReject();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasPrev, hasNext, onPrev, onNext, onKeep, onReject, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-zinc-950 text-white sm:flex-row"
      onClick={onClose}
    >
      {/* Photo View Area */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center bg-black p-3 sm:p-4 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {imageUrl ? (
          <RetryingImage
            src={imageUrl}
            alt={item.photo.fileName || "Photo"}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl transition-all sm:max-h-[85vh]"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-zinc-500">
            <ImageOff className="h-12 w-12" />
            <p>No preview available</p>
          </div>
        )}

        {/* Previous Button */}
        {hasPrev && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
        )}

        {/* Next Button */}
        {hasNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        )}

        {/* Help Badge for keyboard shortcuts */}
        <div className="absolute bottom-4 left-4 rounded bg-zinc-900/80 px-2.5 py-1 text-xs text-zinc-400 backdrop-blur-sm sm:block hidden border border-zinc-800">
          Use <kbd className="font-mono text-white bg-zinc-850 px-1 rounded">←</kbd> / <kbd className="font-mono text-white bg-zinc-850 px-1 rounded">→</kbd> to navigate • <kbd className="font-mono text-white bg-zinc-855 px-1 rounded">K</kbd> to Keep • <kbd className="font-mono text-white bg-zinc-855 px-1 rounded">R</kbd> to Reject
        </div>
      </div>

      {/* Sidebar Details Area */}
      <div
        className="flex max-h-[48svh] w-full shrink-0 flex-col border-t border-zinc-800 bg-zinc-900 text-zinc-100 sm:max-h-none sm:w-[400px] sm:border-l sm:border-t-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between border-b border-zinc-850 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-white" title={item.photo.fileName || ""}>
              {item.photo.fileName || "Photo details"}
            </h2>
            <p className="text-xs text-zinc-400">{item.photo.eventName || "Album Photo"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-450 hover:bg-zinc-800 hover:text-white transition"
            aria-label="Close details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Scrollable Content */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onKeep}
              className={cn(
                "flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all",
                state === "kept"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/30"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-750 hover:text-white border border-zinc-700"
              )}
            >
              <Check className="h-4 w-4" />
              {state === "kept" ? "Kept" : "Keep (K)"}
            </button>
            <button
              type="button"
              onClick={onReject}
              className={cn(
                "flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all",
                state === "rejected"
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-950/30"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-750 hover:text-white border border-zinc-700"
              )}
            >
              <X className="h-4 w-4" />
              {state === "rejected" ? "Rejected" : "Reject (R)"}
            </button>
          </div>

          {/* AI Scores Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Score", item.ai.albumScore],
              ["Clarity", item.ai.clarityScore],
              ["Background", item.ai.backgroundScore],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-center"
              >
                <p className="text-[11px] font-medium text-zinc-400">
                  {label as string}
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {scoreLabel(value as number | null)}
                </p>
              </div>
            ))}
          </div>

          {/* AI Reason/Analysis */}
          {item.ai.reason && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">
                AI Analysis
              </p>
              <p className="rounded-xl bg-zinc-950/20 p-3 text-sm leading-relaxed text-zinc-300 border border-zinc-800">
                {item.ai.reason}
              </p>
            </div>
          )}

          {item.ai.qwenJson && (
            <details className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/30">
              <summary className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-zinc-300">
                Normalized Qwen JSON
              </summary>
              <pre className="max-h-96 overflow-auto border-t border-zinc-800 p-4 text-xs leading-5 text-zinc-300">
                {JSON.stringify(item.ai.qwenJson, null, 2)}
              </pre>
            </details>
          )}

          {/* Other Attributes */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/20 p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Gaze direction</span>
              <span className="font-semibold text-zinc-200">{item.ai.cameraGaze || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">People count</span>
              <span className="font-semibold text-zinc-200">{scoreLabel(item.ai.peopleCount)}</span>
            </div>
            {item.ai.decorationKeywords && (
              <div className="border-t border-zinc-800/80 pt-3">
                <span className="block text-xs text-zinc-400 mb-1">Tags</span>
                <span className="font-medium text-zinc-300">{item.ai.decorationKeywords}</span>
              </div>
            )}
          </div>

          {/* Problem tags */}
          {item.problemReasons?.length ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">
                Issues flagged
              </p>
              <div className="flex flex-wrap gap-1.5">
                {item.problemReasons.map((reason) => (
                  <span
                    key={reason}
                    className="inline-flex rounded-full bg-rose-950/50 px-2.5 py-1 text-xs font-medium text-rose-350 ring-1 ring-rose-900/30"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AiCullingPage({ albumSlug }: AiCullingPageProps) {
  const searchParams = useSearchParams();
  const shareToken = searchParams.get("share") || "";
  const { mutate } = useSWRConfig();
  const [mode, setMode] = useState<ReviewMode>(() =>
    initialMode(searchParams.get("mode")),
  );
  const [eventSlug, setEventSlug] = useState("");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [keptPhotoIds, setKeptPhotoIds] = useState<string[]>([]);
  const [rejectedPhotoIds, setRejectedPhotoIds] = useState<string[]>([]);

  const { data: albumData, isLoading: isAlbumLoading } = useSWR<{
    album: AlbumDetail;
  }>(withShareParam(`/api/albums/${encodeURIComponent(albumSlug)}`, shareToken), fetcher);

  const reviewRequestUrl = reviewUrl(albumSlug, mode, eventSlug, shareToken);
  const clustersRequestUrl = clustersUrl(albumSlug, mode, eventSlug, shareToken);
  const personRequestUrl = bestByPersonUrl(albumSlug, mode, eventSlug, shareToken);

  const {
    data: clustersData,
    error: clustersError,
    isLoading: isClustersLoading,
  } = useSWR<CullingClustersResponse>(
    clustersRequestUrl,
    aiInferenceFetcher,
  );

  const {
    data: reviewData,
    error: reviewError,
    isLoading: isReviewLoading,
  } = useSWR<ReviewResponse>(reviewRequestUrl, aiInferenceFetcher);

  const {
    data: personData,
    error: personError,
    isLoading: isPersonLoading,
  } = useSWR<BestByPersonResponse>(personRequestUrl, aiInferenceFetcher);

  const photos = useMemo(() => {
    if (mode === "by_person") {
      return (personData?.groups ?? []).flatMap((group) => group.photos);
    }

    if (isClusterMode(mode)) {
      return (clustersData?.clusters ?? [])
        .map(clusterToReviewPhoto)
        .filter((item): item is AiReviewPhoto => Boolean(item));
    }

    return reviewData?.photos ?? [];
  }, [clustersData?.clusters, mode, personData?.groups, reviewData?.photos]);

  const clusters = clustersData?.clusters ?? [];

  const photoState = useMemo(() => {
    const kept = new Set(keptPhotoIds);
    const rejected = new Set(rejectedPhotoIds);

    return (photoId: string): "kept" | "rejected" | null => {
      if (kept.has(photoId)) return "kept";
      if (rejected.has(photoId)) return "rejected";
      return null;
    };
  }, [keptPhotoIds, rejectedPhotoIds]);

  const selectedItem = useMemo(() => {
    if (!photos.length) return null;
    return (
      photos.find((item) => item.photo.id === selectedPhotoId) ?? photos[0]
    );
  }, [photos, selectedPhotoId]);

  const isLoading =
    isAlbumLoading || isReviewLoading || isPersonLoading || isClustersLoading;
  const error = reviewError || personError || clustersError;
  const album = albumData?.album;

  const markKept = (photoId: string) => {
    setKeptPhotoIds((current) =>
      current.includes(photoId) ? current : [...current, photoId],
    );
    setRejectedPhotoIds((current) => current.filter((id) => id !== photoId));
  };

  const markRejected = (photoId: string) => {
    setRejectedPhotoIds((current) =>
      current.includes(photoId) ? current : [...current, photoId],
    );
    setKeptPhotoIds((current) => current.filter((id) => id !== photoId));
  };

  const autoSelectTop = () => {
    const ids = photos
      .slice()
      .sort(
        (left, right) =>
          (right.ai.albumScore ?? -1) - (left.ai.albumScore ?? -1) ||
          (right.ai.clarityScore ?? -1) - (left.ai.clarityScore ?? -1),
      )
      .slice(0, 100)
      .map((item) => item.photo.id);

    setKeptPhotoIds(ids);
    setRejectedPhotoIds((current) => current.filter((id) => !ids.includes(id)));
  };

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-[#fbfaf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href={withShareParam(
                  `/albums/${encodeURIComponent(albumSlug)}`,
                  shareToken,
                )}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                aria-label="Back to album"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>

              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
                  {album?.name || "Album"}
                </p>
                <h1 className="truncate text-xl font-semibold sm:text-2xl">
                  AI Culling Review
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={autoSelectTop}
                disabled={!photos.length}
              >
                <Sparkles className="h-4 w-4" />
                Auto-select 100
              </Button>
              <Button
                type="button"
                onClick={() => downloadSelected(albumSlug, keptPhotoIds, shareToken)}
                disabled={!keptPhotoIds.length}
              >
                <Download className="h-4 w-4" />
                Download Selected
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEventSlug("")}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                !eventSlug
                  ? "bg-zinc-950 text-white"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-zinc-950",
              )}
            >
              All
            </button>

            {album?.events.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setEventSlug(event.slug)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition",
                  eventSlug === event.slug
                    ? "bg-zinc-950 text-white"
                    : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-zinc-950",
                )}
              >
                {event.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[220px_1fr]">
        <nav className="border-b border-zinc-200 bg-white px-3 py-3 lg:min-h-[calc(100svh-97px)] lg:border-b-0 lg:border-r">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
            {MODES.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setMode(item.key);
                    setSelectedPhotoId(null);
                  }}
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition lg:justify-start",
                    mode === item.key
                      ? "bg-zinc-950 text-white"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 hidden space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm lg:block">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Kept</span>
              <span className="font-semibold">{keptPhotoIds.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Rejected</span>
              <span className="font-semibold">{rejectedPhotoIds.length}</span>
            </div>
          </div>
        </nav>

        <section className="min-h-[calc(100svh-97px)] px-3 py-4 sm:px-5">
          {isLoading ? (
            <div className="columns-2 gap-3 sm:columns-3 xl:columns-4">
              {Array.from({ length: 16 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="mb-3 h-72 w-full break-inside-avoid rounded-md"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm font-medium text-rose-700">
              {error instanceof Error ? error.message : "Failed to load"}
            </div>
          ) : mode === "by_person" ? (
            <div className="space-y-8">
              {(personData?.groups ?? []).map((group) => (
                <section key={group.person.id} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="relative h-11 w-11 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200">
                      {group.person.coverFaceUrl ? (
                        <RetryingImage
                          src={group.person.coverFaceUrl}
                          alt={group.person.displayName || group.person.defaultName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-zinc-400">
                          <Users className="h-5 w-5" />
                        </span>
                      )}
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold">
                        {group.person.displayName || group.person.defaultName}
                      </h2>
                      <p className="text-sm font-medium text-zinc-500">
                        {group.person.photoCount} photos
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    {group.photos.map((item) => (
                      <PhotoTile
                        key={`${group.person.id}-${item.photo.id}`}
                        item={item}
                        state={photoState(item.photo.id)}
                        isActive={selectedPhotoId === item.photo.id}
                        onSelect={() => setSelectedPhotoId(item.photo.id)}
                        onKeep={() => markKept(item.photo.id)}
                        onReject={() => markRejected(item.photo.id)}
                        shareToken={shareToken}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {!personData?.groups?.length && (
                <div className="rounded-md border border-zinc-200 bg-white px-6 py-12 text-center text-zinc-500">
                  No people found.
                </div>
              )}
            </div>
          ) : isClusterMode(mode) ? (
            clusters.length ? (
              <div className="columns-2 gap-3 sm:columns-3 xl:columns-4">
                {clusters.map((cluster) => {
                  const reviewItem = clusterToReviewPhoto(cluster);
                  if (!reviewItem) return null;

                  return (
                    <div key={cluster.clusterId} className="mb-3">
                      <ClusterCard
                        cluster={cluster}
                        state={photoState(reviewItem.photo.id)}
                        isActive={selectedPhotoId === reviewItem.photo.id}
                        onSelect={() => setSelectedPhotoId(reviewItem.photo.id)}
                        onKeep={() => markKept(reviewItem.photo.id)}
                        onReject={() => markRejected(reviewItem.photo.id)}
                        onBestChanged={async () => {
                          if (clustersRequestUrl) {
                            await mutate(clustersRequestUrl);
                          }
                          setSelectedPhotoId(null);
                        }}
                        shareToken={shareToken}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-zinc-200 bg-white px-6 py-12 text-center text-zinc-500">
                No culling clusters found.
              </div>
            )
          ) : photos.length ? (
            <div className="columns-2 gap-3 sm:columns-3 xl:columns-4">
              {photos.map((item) => (
                <div key={item.photo.id} className="mb-3">
                  <PhotoTile
                    item={item}
                    state={photoState(item.photo.id)}
                    isActive={selectedPhotoId === item.photo.id}
                    onSelect={() => setSelectedPhotoId(item.photo.id)}
                    onKeep={() => markKept(item.photo.id)}
                    onReject={() => markRejected(item.photo.id)}
                    shareToken={shareToken}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-zinc-200 bg-white px-6 py-12 text-center text-zinc-500">
              No photos found.
            </div>
          )}
        </section>
      </div>

      {selectedPhotoId !== null && selectedItem && selectedItem.photo.id === selectedPhotoId && (
        <CullingLightbox
          item={selectedItem}
          photos={photos}
          state={photoState(selectedItem.photo.id)}
          onKeep={() => markKept(selectedItem.photo.id)}
          onReject={() => markRejected(selectedItem.photo.id)}
          onClose={() => setSelectedPhotoId(null)}
          onPrev={() => {
            const index = photos.findIndex((item) => item.photo.id === selectedPhotoId);
            if (index > 0) {
              setSelectedPhotoId(photos[index - 1].photo.id);
            }
          }}
          onNext={() => {
            const index = photos.findIndex((item) => item.photo.id === selectedPhotoId);
            if (index < photos.length - 1) {
              setSelectedPhotoId(photos[index + 1].photo.id);
            }
          }}
          shareToken={shareToken}
        />
      )}
    </main>
  );
}

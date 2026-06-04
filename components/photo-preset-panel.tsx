"use client";

import { Check, Loader2, Palette, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { Preset } from "@/lib/preset-types";
import type { Photo } from "@/lib/types";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

export function PhotoPresetPanel({
  albumSlug,
  photo,
  onClose,
}: {
  albumSlug: string;
  photo: Photo;
  onClose: () => void;
}) {
  const { mutate: mutateGlobal } = useSWRConfig();
  const { data, error: libraryError, isLoading } = useSWR<{
    presets: Preset[];
  }>("/api/presets?scope=library", fetcher);
  const [search, setSearch] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [intensity, setIntensity] = useState(75);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isShowingOriginal, setIsShowingOriginal] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const presets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data?.presets ?? [];

    return (data?.presets ?? []).filter((preset) =>
      [
        preset.name,
        preset.creatorName,
        preset.category,
        ...preset.tags,
        ...preset.bestFor,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [data?.presets, search]);

  const selectedPreset = data?.presets.find(
    (preset) => preset.id === selectedPresetId,
  );
  const originalUrl = photo.previewUrl || photo.thumbnailUrl;

  useEffect(() => {
    setSelectedPresetId("");
    setPreviewUrl(null);
    setIsShowingOriginal(false);
    setError("");
    setSuccess("");
  }, [photo.id]);

  useEffect(() => {
    if (!selectedPresetId) {
      setPreviewUrl(null);
      setIsShowingOriginal(false);
      setIsPreviewing(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsPreviewing(true);
      setError("");
      setSuccess("");

      try {
        const response = await fetch(
          `/api/presets/${encodeURIComponent(selectedPresetId)}/preview`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ albumSlug, photoId: photo.id, intensity }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error || "Could not generate preset preview.");
        }

        const nextUrl = URL.createObjectURL(await response.blob());
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return nextUrl;
        });
        setIsShowingOriginal(false);
      } catch (previewError) {
        if (controller.signal.aborted) return;
        setError(
          previewError instanceof Error
            ? previewError.message
            : "Could not generate preset preview.",
        );
      } finally {
        if (!controller.signal.aborted) setIsPreviewing(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [albumSlug, intensity, photo.id, selectedPresetId]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const applyPreset = async () => {
    if (!selectedPresetId || isApplying) return;
    setIsApplying(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/presets/${encodeURIComponent(selectedPresetId)}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ albumSlug, photoId: photo.id, intensity }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        photo?: { editedUrl?: string | null };
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not apply this preset.");
      }

      if (payload.photo?.editedUrl) {
        setPreviewUrl((current) => {
          if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
          return payload.photo?.editedUrl ?? null;
        });
      }
      setIsShowingOriginal(false);
      setSuccess(
        payload.message ||
          "Preset applied successfully. Your original photo was not changed.",
      );
      await mutateGlobal(
        (key) =>
          typeof key === "string" &&
          key.startsWith(`/api/albums/${encodeURIComponent(albumSlug)}/photos`),
      );
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : "Could not apply this preset.",
      );
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <aside
      className="absolute bottom-0 right-0 top-0 z-50 flex w-full cursor-default flex-col border-l border-zinc-200 bg-white text-zinc-950 shadow-2xl sm:w-[440px]"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
            Photo editor
          </p>
          <h2 className="truncate text-lg font-semibold">Apply a Preset</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
          aria-label="Close preset editor"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-zinc-100">
          {previewUrl || originalUrl ? (
            <img
              src={
                isShowingOriginal
                  ? originalUrl || previewUrl || ""
                  : previewUrl || originalUrl || ""
              }
              alt={photo.fileName || "Selected photo"}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-400">
              No preview available
            </div>
          )}
          {isPreviewing && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/65 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {previewUrl && (
            <>
              <span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
                {isShowingOriginal ? "Original" : "Preset preview"}
              </span>
              <div className="absolute right-3 top-3 flex rounded-full bg-black/65 p-1 text-[11px] font-semibold text-white">
                <button
                  type="button"
                  onClick={() => setIsShowingOriginal(true)}
                  className={`cursor-pointer rounded-full px-2.5 py-1 transition ${
                    isShowingOriginal ? "bg-white text-zinc-950" : ""
                  }`}
                >
                  Original
                </button>
                <button
                  type="button"
                  onClick={() => setIsShowingOriginal(false)}
                  className={`cursor-pointer rounded-full px-2.5 py-1 transition ${
                    !isShowingOriginal ? "bg-white text-zinc-950" : ""
                  }`}
                >
                  Preview
                </button>
              </div>
            </>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="preset-intensity" className="text-sm font-semibold">
              Intensity
            </label>
            <span className="text-sm font-semibold text-zinc-500">
              {intensity}%
            </span>
          </div>
          <input
            id="preset-intensity"
            type="range"
            min="0"
            max="100"
            value={intensity}
            onChange={(event) => setIntensity(Number(event.target.value))}
            disabled={!selectedPresetId}
            className="w-full cursor-pointer accent-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>

        <div>
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your presets"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
            />
          </label>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {presets.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`cursor-pointer overflow-hidden rounded-xl border text-left transition ${
                    isSelected
                      ? "border-zinc-950 ring-2 ring-zinc-950/15"
                      : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <div className="aspect-[4/3] bg-zinc-100">
                    {preset.previewAfterUrl ? (
                      <img
                        src={preset.previewAfterUrl}
                        alt={preset.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Palette className="h-5 w-5 text-zinc-400" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-xs font-semibold">{preset.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                      {preset.category}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your presets
          </div>
        )}
        {libraryError && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            We couldn&apos;t load your preset library.
          </p>
        )}
        {!isLoading && !libraryError && !presets.length && (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm leading-6 text-zinc-500">
            {search
              ? "No presets match your search."
              : "Save a marketplace preset or upload your own to use it here."}
          </p>
        )}
        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        {success && (
          <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            {success}
          </p>
        )}
      </div>

      <div className="border-t border-zinc-200 p-5">
        <button
          type="button"
          onClick={applyPreset}
          disabled={!selectedPreset || isApplying || isPreviewing}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isApplying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Palette className="h-4 w-4" />
          )}
          Apply and Create Edited Copy
        </button>
        <p className="mt-2 text-center text-[11px] text-zinc-500">
          Your original photo is never overwritten.
        </p>
      </div>
    </aside>
  );
}

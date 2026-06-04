"use client";

import { Check, Loader2, Palette } from "lucide-react";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { Preset } from "@/lib/preset-types";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

export function ApplyPresetSelectionDialog({
  albumSlug,
  photoIds,
  onComplete,
}: {
  albumSlug: string;
  photoIds: string[];
  onComplete: () => void | Promise<void>;
}) {
  const { mutate: mutateGlobal } = useSWRConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [intensity, setIntensity] = useState(75);
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [status, setStatus] = useState<"idle" | "applying" | "completed">(
    "idle",
  );
  const [error, setError] = useState("");
  const { data, error: libraryError, isLoading } = useSWR<{
    presets: Preset[];
  }>(isOpen ? "/api/presets?scope=library" : null, fetcher);

  const selectedPreset = data?.presets.find(
    (preset) => preset.id === selectedPresetId,
  );
  const progress = photoIds.length
    ? Math.round(((completedCount + failedCount) / photoIds.length) * 100)
    : 0;

  const reset = () => {
    setSelectedPresetId("");
    setIntensity(75);
    setCompletedCount(0);
    setFailedCount(0);
    setStatus("idle");
    setError("");
  };

  const applyToSelection = async () => {
    if (!selectedPresetId || !photoIds.length || status === "applying") return;

    setStatus("applying");
    setCompletedCount(0);
    setFailedCount(0);
    setError("");

    let completed = 0;
    let failed = 0;

    for (const photoId of photoIds) {
      try {
        const response = await fetch(
          `/api/presets/${encodeURIComponent(selectedPresetId)}/apply`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ albumSlug, photoId, intensity }),
          },
        );
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Could not apply preset.");
        }
        completed += 1;
        setCompletedCount(completed);
      } catch {
        failed += 1;
        setFailedCount(failed);
      }
    }

    setStatus("completed");
    if (failed) {
      setError(
        `${failed} ${failed === 1 ? "photo" : "photos"} could not be edited. Originals were not changed.`,
      );
    }
    await mutateGlobal(
      (key) =>
        typeof key === "string" &&
        key.startsWith(`/api/albums/${encodeURIComponent(albumSlug)}/photos`),
    );
    await onComplete();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && status === "applying") return;
        setIsOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={!photoIds.length}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Palette className="h-4 w-4" />
          Apply Preset
        </button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={status !== "applying"}
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>
            Apply preset to {photoIds.length}{" "}
            {photoIds.length === 1 ? "photo" : "photos"}?
          </DialogTitle>
          <DialogDescription>
            Edited copies will be created. Original photos will not be changed.
          </DialogDescription>
        </DialogHeader>

        {status === "completed" ? (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <Check className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">
                  Preset applied to {completedCount}{" "}
                  {completedCount === 1 ? "photo" : "photos"}.
                </p>
                <p className="mt-1 text-sm">
                  The edited copies are now in this album.
                </p>
              </div>
            </div>
            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div>
              <p className="mb-3 text-sm font-semibold">Choose a preset</p>
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
              {!isLoading && !libraryError && !data?.presets.length && (
                <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
                  Save a marketplace preset or upload your own before applying
                  one here.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data?.presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={status === "applying"}
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={`cursor-pointer overflow-hidden rounded-xl border text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      selectedPresetId === preset.id
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
                      <p className="truncate text-xs font-semibold">
                        {preset.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                        {preset.category}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="batch-preset-intensity" className="text-sm font-semibold">
                  Intensity
                </label>
                <span className="text-sm font-semibold text-zinc-500">
                  {intensity}%
                </span>
              </div>
              <input
                id="batch-preset-intensity"
                type="range"
                min="0"
                max="100"
                value={intensity}
                onChange={(event) => setIntensity(Number(event.target.value))}
                disabled={!selectedPreset || status === "applying"}
                className="w-full cursor-pointer accent-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
              />
              <div className="mt-1 flex justify-between text-[11px] text-zinc-400">
                <span>Subtle</span>
                <span>Balanced</span>
                <span>Strong</span>
              </div>
            </div>

            {status === "applying" && (
              <div className="rounded-2xl bg-zinc-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold">Applying preset...</span>
                  <span className="text-zinc-500">
                    {completedCount + failedCount} of {photoIds.length}
                  </span>
                </div>
                <Progress value={progress} />
                <p className="mt-3 text-xs text-zinc-500">
                  Keep this page open until the selected photos finish.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {status === "completed" ? (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="h-10 cursor-pointer rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={status === "applying"}
                className="h-10 cursor-pointer rounded-xl border border-zinc-200 px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyToSelection}
                disabled={!selectedPreset || status === "applying"}
                className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "applying" && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Apply to {photoIds.length}{" "}
                {photoIds.length === 1 ? "Photo" : "Photos"}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

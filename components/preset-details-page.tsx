"use client";

import Link from "next/link";
import { Bookmark, Check, ImagePlus, Palette } from "lucide-react";
import useSWR from "swr";
import { PresetBeforeAfter } from "@/components/preset-before-after";
import { PresetPageShell } from "@/components/preset-page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import type { Preset } from "@/lib/preset-types";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

export function PresetDetailsPage({ presetId }: { presetId: string }) {
  const { data, error, isLoading, mutate } = useSWR<{ preset: Preset }>(
    `/api/presets/${presetId}`,
    fetcher,
  );
  const preset = data?.preset;

  const toggleSave = async () => {
    if (!preset || preset.isOwner) return;
    await fetch(`/api/presets/${preset.id}/save`, {
      method: preset.isSaved ? "DELETE" : "POST",
    });
    await mutate();
  };

  return (
    <PresetPageShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {isLoading && <Skeleton className="h-[70vh] rounded-3xl" />}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center text-rose-700">
            We couldn&apos;t load this preset right now.
          </div>
        )}
        {preset && (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <PresetBeforeAfter
              beforeUrl={preset.previewBeforeUrl}
              afterUrl={preset.previewAfterUrl}
              alt={preset.name}
              className="aspect-[4/3] rounded-3xl shadow-xl"
            />
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-700">
                {preset.category} · Free to use
              </p>
              <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
                {preset.name}
              </h1>
              <p className="mt-3 text-sm font-medium text-zinc-500">
                By {preset.creatorName}
              </p>
              <p className="mt-6 text-sm leading-7 text-zinc-600">
                {preset.description || "A LUT-powered editing preset designed for beautiful, consistent photo color."}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {[preset.category, ...preset.tags].slice(0, 8).map((tag) => (
                  <span key={tag} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 ring-1 ring-zinc-200">
                    {tag}
                  </span>
                ))}
              </div>

              {!!preset.bestFor.length && (
                <div className="mt-7">
                  <h2 className="text-sm font-semibold">Best for</h2>
                  <div className="mt-3 space-y-2">
                    {preset.bestFor.map((item) => (
                      <p key={item} className="flex items-center gap-2 text-sm text-zinc-600">
                        <Check className="h-4 w-4 text-emerald-600" />
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 grid gap-3">
                <button
                  type="button"
                  onClick={toggleSave}
                  disabled={preset.isOwner}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-600"
                >
                  <Bookmark className={`h-4 w-4 ${preset.isSaved ? "fill-current" : ""}`} />
                  {preset.isOwner ? "Uploaded by You" : preset.isSaved ? "Saved to My Presets" : "Save to My Presets"}
                </button>
                <Link
                  href="/albums"
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                >
                  <ImagePlus className="h-4 w-4" />
                  Open a Photo to Apply
                </Link>
              </div>

              <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-600">
                <p className="flex items-center gap-2 font-semibold text-zinc-950">
                  <Palette className="h-4 w-4" />
                  Safe editing
                </p>
                Applying this preset creates an edited copy. Your original photo is never overwritten.
              </div>
            </aside>
          </div>
        )}
      </div>
    </PresetPageShell>
  );
}

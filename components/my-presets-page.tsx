"use client";

import Link from "next/link";
import { Upload } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { PresetCard } from "@/components/preset-card";
import { PresetPageShell } from "@/components/preset-page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import type { Preset } from "@/lib/preset-types";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

export function MyPresetsPage() {
  const [tab, setTab] = useState<"saved" | "mine">("saved");
  const { data, error, isLoading, mutate } = useSWR<{ presets: Preset[] }>(
    `/api/presets?scope=${tab}`,
    fetcher,
  );

  const removePreset = async (preset: Preset) => {
    if (tab === "mine" && !window.confirm(`Remove "${preset.name}"?`)) return;
    await fetch(
      tab === "mine" ? `/api/presets/${preset.id}` : `/api/presets/${preset.id}/save`,
      { method: "DELETE" },
    );
    await mutate();
  };

  return (
    <PresetPageShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-700">
              Personal library
            </p>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl">My Presets</h1>
            <p className="mt-3 text-sm text-zinc-500">
              Your saved marketplace looks and uploaded editing styles.
            </p>
          </div>
          <Link
            href="/presets/upload"
            className="flex h-11 w-fit items-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            <Upload className="h-4 w-4" />
            Upload Preset
          </Link>
        </div>

        <div className="mt-8 flex gap-2 rounded-full bg-zinc-100 p-1 sm:w-fit">
          {[
            { id: "saved", label: "Saved" },
            { id: "mine", label: "Uploaded by Me" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as "saved" | "mine")}
              className={`flex-1 rounded-full px-5 py-2 text-sm font-semibold transition sm:flex-none ${
                tab === item.id ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[3/4] rounded-2xl" />
            ))}
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-10 text-center text-sm text-rose-700">
            We couldn&apos;t load your presets right now.
          </div>
        )}

        {!isLoading && !error && !data?.presets.length && (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white px-6 py-16 text-center">
            <h2 className="text-xl font-semibold">You don&apos;t have any presets here yet.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
              Save presets from the marketplace or upload your own editing style.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/presets" className="rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-semibold">
                Browse Marketplace
              </Link>
              <Link href="/presets/upload" className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white">
                Upload Preset
              </Link>
            </div>
          </div>
        )}

        {!!data?.presets.length && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.presets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} onDelete={removePreset} />
            ))}
          </div>
        )}
      </div>
    </PresetPageShell>
  );
}

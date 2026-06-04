"use client";

import Link from "next/link";
import { Search, SlidersHorizontal, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { PresetCard } from "@/components/preset-card";
import { PresetPageShell } from "@/components/preset-page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import type { Preset } from "@/lib/preset-types";

const categories = [
  "All",
  "Wedding",
  "Portrait",
  "Cinematic",
  "Moody",
  "Film",
  "Outdoor",
  "Black & White",
  "Golden Hour",
];

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

export function PresetMarketplacePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("popular");
  const url = useMemo(() => {
    const params = new URLSearchParams({ scope: "marketplace", sort });
    if (search.trim()) params.set("search", search.trim());
    if (category !== "All") params.set("category", category);
    return `/api/presets?${params}`;
  }, [category, search, sort]);
  const { data, error, isLoading, mutate } = useSWR<{ presets: Preset[] }>(
    url,
    fetcher,
    { keepPreviousData: true },
  );

  const toggleSave = async (preset: Preset) => {
    await fetch(`/api/presets/${preset.id}/save`, {
      method: preset.isSaved ? "DELETE" : "POST",
    });
    await mutate();
  };

  return (
    <PresetPageShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl bg-zinc-950 px-6 py-10 text-white sm:px-10 sm:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.25),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(244,114,182,0.2),transparent_40%)]" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                Preset Marketplace
              </p>
              <h1 className="mt-3 max-w-2xl font-serif text-4xl leading-tight sm:text-6xl">
                Discover your next signature look.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-300 sm:text-base">
                Preview, save, and apply LUT-powered photography presets without changing your original photos.
              </p>
            </div>
            <Link
              href="/presets/upload"
              className="flex h-11 w-fit items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
            >
              <Upload className="h-4 w-4" />
              Upload Preset
            </Link>
          </div>
        </section>

        <section className="mt-8 space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
            <label className="relative block">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search presets, creators, styles..."
                className="h-12 w-full rounded-2xl border border-zinc-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            <label className="relative">
              <SlidersHorizontal className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="h-12 w-full appearance-none rounded-2xl border border-zinc-200 bg-white pl-11 pr-4 text-sm font-medium outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
              >
                <option value="popular">Most Popular</option>
                <option value="newest">Newest</option>
              </select>
            </label>
          </div>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  category === item
                    ? "bg-zinc-950 text-white"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:text-zinc-950"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {isLoading && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[3/4] rounded-2xl" />
            ))}
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-10 text-center text-sm text-rose-700">
            We couldn&apos;t load presets right now.
            <button type="button" onClick={() => mutate()} className="ml-2 font-semibold underline">
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && !data?.presets.length && (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white px-5 py-14 text-center">
            <h2 className="text-lg font-semibold">No presets found{search ? ` for “${search}”` : ""}.</h2>
            <p className="mt-2 text-sm text-zinc-500">Try Wedding, Moody, Cinematic, or Golden Hour.</p>
          </div>
        )}

        {!!data?.presets.length && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.presets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} onSave={toggleSave} />
            ))}
          </div>
        )}
      </div>
    </PresetPageShell>
  );
}

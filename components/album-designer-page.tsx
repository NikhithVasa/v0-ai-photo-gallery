"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Images,
  LayoutTemplate,
  Loader2,
  Palette,
  Save,
  SlidersHorizontal,
  Type,
} from "lucide-react";
import useSWR from "swr";
import { PhotosGrid } from "@/components/photos-grid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type {
  AlbumDesignSettings,
  AlbumDesignTitleFont,
  AlbumDetail,
  PhotoSortMode,
} from "@/lib/types";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
};

const fontOptions: Array<{
  value: AlbumDesignTitleFont;
  label: string;
  family: string;
}> = [
  { value: "inter", label: "Inter", family: "var(--font-inter), sans-serif" },
  { value: "playfair", label: "Playfair Display", family: "var(--font-playfair), serif" },
  { value: "cormorant", label: "Cormorant Garamond", family: "var(--font-cormorant), serif" },
  { value: "geist", label: "Geist", family: "Geist, var(--font-inter), sans-serif" },
];

const sortOptions: Array<{ value: PhotoSortMode; label: string }> = [
  { value: "title_asc", label: "Image name (A-Z)" },
  { value: "title_desc", label: "Image name (Z-A)" },
  { value: "original_oldest", label: "Captured time (Old-New)" },
  { value: "original_newest", label: "Captured time (New-Old)" },
  { value: "added_oldest", label: "Upload time (Old-New)" },
  { value: "added_newest", label: "Upload time (New-Old)" },
  { value: "rating", label: "Rating" },
];

const controlTileClassName =
  "rounded-[18px] border border-zinc-200/70 bg-white/85 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur";

const inspectorSectionClassName =
  "rounded-[26px] border border-white/80 bg-white/85 p-4 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950/[0.03] backdrop-blur-xl";

function titleStyle(settings: AlbumDesignSettings): CSSProperties {
  const font =
    fontOptions.find((option) => option.value === settings.titleFont) ??
    fontOptions[1];

  return {
    fontFamily: font.family,
    fontSize: `${settings.titleFontSize}em`,
  };
}

async function saveDesignSettings(
  albumSlug: string,
  settings: AlbumDesignSettings,
) {
  const response = await fetch(
    `/api/albums/${encodeURIComponent(albumSlug)}/design`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as
    | { designSettings?: AlbumDesignSettings }
    | { error?: string };

  if (!response.ok || !("designSettings" in payload) || !payload.designSettings) {
    throw new Error("error" in payload ? payload.error : "Failed to save design");
  }

  return payload.designSettings;
}

function DesignSlider({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className={controlTileClassName}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Label className="text-sm font-medium text-zinc-800">{label}</Label>
        <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-xs font-semibold tabular-nums text-white shadow-sm">
          {value}{suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(nextValue) => onChange(nextValue[0] ?? value)}
        aria-label={label}
      />
    </div>
  );
}

export function AlbumDesignerPage({ albumSlug }: { albumSlug: string }) {
  const { data, error, isLoading, mutate } = useSWR<{ album: AlbumDetail }>(
    `/api/albums/${encodeURIComponent(albumSlug)}`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const album = data?.album;
  const [settings, setSettings] = useState<AlbumDesignSettings | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [selectedEventSlug, setSelectedEventSlug] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("Loading design...");

  useEffect(() => {
    if (!album) return;
    setSettings(album.designSettings);
    setSavedSnapshot(JSON.stringify(album.designSettings));
    setStatus("All changes are saved");
  }, [album]);

  useEffect(() => {
    if (!album?.events.length) return;
    if (!selectedEventSlug) return;
    if (album.events.some((event) => event.slug === selectedEventSlug)) return;
    setSelectedEventSlug(null);
  }, [album?.events, selectedEventSlug]);

  const snapshot = settings ? JSON.stringify(settings) : "";
  const hasUnsavedChanges = Boolean(settings && snapshot !== savedSnapshot);
  const selectedEvent = album?.events.find((event) => event.slug === selectedEventSlug);
  const previewScopeLabel = selectedEvent?.name ?? "All photos";

  const updateSettings = <K extends keyof AlbumDesignSettings>(
    key: K,
    value: AlbumDesignSettings[K],
  ) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
    setStatus("Preview updated");
  };

  const save = async () => {
    if (!settings || isSaving) return;

    setIsSaving(true);
    setStatus("Saving design...");

    try {
      const saved = await saveDesignSettings(albumSlug, settings);
      setSettings(saved);
      setSavedSnapshot(JSON.stringify(saved));
      setStatus("All changes are saved");
      await mutate(
        (current) =>
          current
            ? {
                album: {
                  ...current.album,
                  designSettings: saved,
                  photoSortMode: saved.imageSortMode,
                },
              }
            : current,
        { revalidate: false },
      );
    } catch (saveError) {
      console.error("Failed to save album design:", saveError);
      setStatus(saveError instanceof Error ? saveError.message : "Failed to save design");
    } finally {
      setIsSaving(false);
    }
  };

  const coverTitleStyle = useMemo(
    () => (settings ? titleStyle(settings) : undefined),
    [settings],
  );

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-center text-white">
        <div>
          <p className="text-lg font-semibold">Could not open designer</p>
          <p className="mt-2 text-sm text-white/60">
            {error instanceof Error ? error.message : "Failed to load album."}
          </p>
          <Button asChild className="mt-5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100">
            <Link href={`/albums/${encodeURIComponent(albumSlug)}`}>Back to album</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (isLoading || !album || !settings) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-zinc-950">
      <header className="sticky top-0 z-30 border-b border-white/80 bg-[#f5f5f7]/86 px-4 py-3 text-zinc-950 shadow-[0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              asChild
              className="shrink-0 rounded-full bg-white/70 text-zinc-700 shadow-sm ring-1 ring-zinc-950/10 hover:bg-white hover:text-zinc-950"
            >
              <Link href={`/albums/${encodeURIComponent(albumSlug)}`} aria-label="Back to album">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Album designer
              </p>
              <h1 className="truncate text-xl font-semibold text-zinc-950 sm:text-2xl">
                {album.name}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span
              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 ${
                hasUnsavedChanges
                  ? "bg-amber-50 text-amber-800 ring-amber-200"
                  : "bg-emerald-50 text-emerald-800 ring-emerald-200"
              }`}
              aria-live="polite"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {status}
            </span>
            <Button
              type="button"
              onClick={save}
              disabled={isSaving || !hasUnsavedChanges}
              className="rounded-full bg-zinc-950 px-4 text-white shadow-[0_12px_30px_rgba(24,24,27,0.18)] hover:bg-zinc-800 disabled:bg-zinc-300 disabled:text-zinc-500"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save design
            </Button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-h-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.98),transparent_34%),linear-gradient(135deg,#f5f5f7,#eef0f3_52%,#ffffff)] p-3 sm:p-6 lg:h-[calc(100vh-73px)] lg:overflow-y-auto">
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 flex flex-col gap-3 rounded-[26px] border border-white/80 bg-white/72 p-3 text-zinc-950 shadow-[0_18px_60px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950/[0.03] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-[0_12px_26px_rgba(24,24,27,0.18)]">
                  <Images className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Live preview
                  </p>
                  <p className="text-sm font-medium text-zinc-900">{previewScopeLabel}</p>
                </div>
              </div>

              <div className="flex max-w-full gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedEventSlug(null)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    !selectedEventSlug
                      ? "bg-zinc-950 text-white shadow-[0_10px_24px_rgba(24,24,27,0.16)]"
                      : "bg-white/75 text-zinc-600 ring-1 ring-zinc-950/10 hover:bg-white hover:text-zinc-950"
                  }`}
                >
                  All
                </button>
                {album.events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEventSlug(event.slug)}
                    className={`max-w-[220px] shrink-0 truncate rounded-full px-4 py-2 text-sm font-semibold transition ${
                      selectedEventSlug === event.slug
                        ? "bg-zinc-950 text-white shadow-[0_10px_24px_rgba(24,24,27,0.16)]"
                        : "bg-white/75 text-zinc-600 ring-1 ring-zinc-950/10 hover:bg-white hover:text-zinc-950"
                    }`}
                  >
                    {event.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[30px] border border-white/90 bg-white/72 shadow-[0_28px_90px_rgba(15,23,42,0.14)] ring-1 ring-zinc-950/[0.04] backdrop-blur-xl">
              <div className="flex min-h-52 items-center justify-center bg-[linear-gradient(135deg,#171717,#2f3034_55%,#09090b)] px-5 py-12 text-center text-white sm:min-h-72">
                <div>
                  <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
                    Cover typography
                  </p>
                  <h2
                    className="max-w-4xl break-words text-4xl font-semibold uppercase tracking-[0.08em] sm:text-6xl"
                    style={coverTitleStyle}
                  >
                    {album.name}
                  </h2>
                </div>
              </div>

              <div className="px-2 py-3 sm:px-4 sm:py-5">
                <PhotosGrid
                  albumSlug={albumSlug}
                  selectedEventSlug={selectedEventSlug}
                  selectedPeopleIds={[]}
                  peopleMatchMode="all"
                  events={album.events}
                  shareSettings={null}
                  hidePeople
                  showAiPrivacyNotice={false}
                  canManageSort={false}
                  canUploadPhotos={false}
                  designSettings={settings}
                />
              </div>
            </div>
          </div>
        </section>

        <aside className="border-t border-white/80 bg-[#f5f5f7]/92 p-4 backdrop-blur-xl lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] lg:overflow-y-auto lg:border-l lg:border-t-0 lg:border-white/80 lg:p-5">
          <div className="space-y-5 pb-6">
            <section className={`${inspectorSectionClassName} lg:sticky lg:top-4 lg:z-20`}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-[0_12px_26px_rgba(24,24,27,0.18)]">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-950">Gallery layout</h2>
                  <p className="text-xs text-zinc-500">Album-wide photo presentation.</p>
                </div>
              </div>

              <div className="space-y-3">
                <DesignSlider
                  label="Grid Space"
                  value={settings.gridSpace}
                  min={0}
                  max={50}
                  step={1}
                  suffix="px"
                  onChange={(value) => updateSettings("gridSpace", value)}
                />
                <DesignSlider
                  label="Image Radius"
                  value={settings.imageRadius}
                  min={0}
                  max={32}
                  step={1}
                  suffix="px"
                  onChange={(value) => updateSettings("imageRadius", value)}
                />
                <DesignSlider
                  label="Side Padding"
                  value={settings.sidePadding}
                  min={0}
                  max={40}
                  step={1}
                  suffix="px"
                  onChange={(value) => updateSettings("sidePadding", value)}
                />
                <DesignSlider
                  label="Row Height"
                  value={settings.rowHeight}
                  min={160}
                  max={620}
                  step={10}
                  suffix="px"
                  onChange={(value) => updateSettings("rowHeight", value)}
                />

                <div className={controlTileClassName}>
                  <Label className="mb-3 block text-sm font-medium text-zinc-800">Layout</Label>
                  <RadioGroup
                    value={settings.layout}
                    onValueChange={(value) =>
                      updateSettings("layout", value as AlbumDesignSettings["layout"])
                    }
                    className="grid grid-cols-2 gap-2"
                  >
                    {[
                      { value: "horizontal", label: "Horizontal", icon: LayoutTemplate },
                      { value: "vertical", label: "Vertical", icon: Images },
                    ].map((option) => {
                      const Icon = option.icon;
                      return (
                        <Label
                          key={option.value}
                          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[16px] border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white has-[[data-state=checked]]:border-zinc-950 has-[[data-state=checked]]:bg-white has-[[data-state=checked]]:text-zinc-950 has-[[data-state=checked]]:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                        >
                          <RadioGroupItem value={option.value} />
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </Label>
                      );
                    })}
                  </RadioGroup>
                </div>

                <div className={controlTileClassName}>
                  <Label className="mb-3 block text-sm font-medium text-zinc-800">Images Sort By</Label>
                  <Select
                    value={settings.imageSortMode}
                    onValueChange={(value) => updateSettings("imageSortMode", value as PhotoSortMode)}
                  >
                    <SelectTrigger className="h-11 w-full rounded-[16px] border-zinc-200 bg-white/85 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className={inspectorSectionClassName}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-[0_12px_26px_rgba(24,24,27,0.18)]">
                  <Type className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-950">Typography</h2>
                  <p className="text-xs text-zinc-500">Cover title presentation.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className={controlTileClassName}>
                  <Label className="mb-3 block text-sm font-medium text-zinc-800">Title Font</Label>
                  <Select
                    value={settings.titleFont}
                    onValueChange={(value) => updateSettings("titleFont", value as AlbumDesignTitleFont)}
                  >
                    <SelectTrigger className="h-11 w-full rounded-[16px] border-zinc-200 bg-white/85 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span style={{ fontFamily: option.family }}>Aa {option.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <DesignSlider
                  label="Font Size"
                  value={Number(settings.titleFontSize.toFixed(2))}
                  min={0.7}
                  max={1.8}
                  step={0.05}
                  onChange={(value) => updateSettings("titleFontSize", value)}
                />
              </div>
            </section>

            <section className="rounded-[22px] border border-dashed border-zinc-300/80 bg-white/60 p-4 text-sm text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="mb-2 flex items-center gap-2 font-semibold text-zinc-700">
                <Palette className="h-4 w-4" />
                Album-wide storage
              </div>
              These settings apply to the whole album and every share link that opens it.
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}
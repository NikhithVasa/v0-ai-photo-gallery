"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ImageUp,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AuthAvatarMenu } from "@/components/auth-avatar-menu";

interface CoverUpload {
  key: string;
  contentType: string;
  uploadUrl: string;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeEvents(events: string[]) {
  return events.map((event) => event.trim()).filter(Boolean);
}

export function AddAlbumPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [customerName, setCustomerName] = useState(
    searchParams.get("customerName") || "",
  );
  const [albumName, setAlbumName] = useState("");
  const [description, setDescription] = useState("");
  const [albumDate, setAlbumDate] = useState(todayIso());
  const [expiresAt, setExpiresAt] = useState(addDaysIso(90));
  const [events, setEvents] = useState(["Ceremony", "Reception"]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const cleanEvents = useMemo(() => normalizeEvents(events), [events]);
  const canCreate = Boolean(
    customerName.trim() && albumName.trim() && albumDate && expiresAt && !isCreating,
  );

  const chooseCover = (files: FileList | null) => {
    const file = Array.from(files ?? []).find((item) => item.type.startsWith("image/"));
    if (!file) return;

    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
  };

  const updateEvent = (index: number, value: string) => {
    setEvents((current) =>
      current.map((eventName, currentIndex) =>
        currentIndex === index ? value : eventName,
      ),
    );
  };

  const removeEvent = (index: number) => {
    setEvents((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const addEvent = () => {
    setEvents((current) => [...current, ""]);
  };

  const createAlbum = async () => {
    if (!canCreate) return;

    setIsCreating(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          albumName: albumName.trim(),
          description: description.trim(),
          albumDate,
          expiresAt,
          events: cleanEvents,
          cover: coverFile
            ? {
                fileName: coverFile.name,
                size: coverFile.size,
                contentType: coverFile.type || "application/octet-stream",
              }
            : undefined,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        album?: { slug: string; name: string };
        coverUpload?: CoverUpload | null;
      };

      if (!response.ok || !payload.album) {
        throw new Error(payload.error || "Could not create album");
      }

      if (coverFile && payload.coverUpload) {
        const uploadResponse = await fetch(payload.coverUpload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": payload.coverUpload.contentType },
          body: coverFile,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Cover upload failed (${uploadResponse.status})`);
        }
      }

      toast({
        title: "Album created",
        description: `${payload.album.name} is ready for events and photos.`,
      });

      router.push(`/albums/${encodeURIComponent(payload.album.slug)}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Album creation failed",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-[#f7f6f2]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/albums"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              aria-label="Back to albums"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
                Admin
              </p>
              <h1 className="truncate text-lg font-semibold sm:text-xl">
                New album
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={createAlbum}
              disabled={!canCreate}
              className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-zinc-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Create Album</span>
              <span className="sm:hidden">Create</span>
            </button>
            <AuthAvatarMenu />
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-zinc-200 bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(68,87,255,0.08),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(20,184,166,0.08),transparent_28%)]" />
        <div className="relative mx-auto grid min-h-[520px] max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:px-8">
          <div className="min-w-0 flex flex-col justify-center">
            <div className="max-w-3xl min-w-0">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm font-medium text-zinc-500 shadow-sm">
                <Sparkles className="h-4 w-4 text-[#4457ff]" />
                Gallery setup
              </p>
              <input
                value={albumName}
                onChange={(event) => setAlbumName(event.target.value)}
                placeholder="Album name"
                aria-label="Album name"
                className="w-full min-w-0 border-0 bg-transparent text-5xl font-bold tracking-normal text-zinc-900 outline-none placeholder:text-zinc-300 sm:text-7xl"
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Add a clean description for this album"
                aria-label="Album description"
                rows={3}
                className="mt-6 w-full min-w-0 resize-none border-0 bg-transparent text-xl leading-tight tracking-normal text-zinc-500 outline-none placeholder:text-zinc-300 sm:text-2xl"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              chooseCover(event.dataTransfer.files);
            }}
            className="group relative min-h-[420px] overflow-hidden rounded-[30px] border border-zinc-200 bg-zinc-100 text-left shadow-[0_24px_80px_rgba(24,24,27,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_32px_90px_rgba(24,24,27,0.18)] focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {coverPreviewUrl ? (
              <Image
                src={coverPreviewUrl}
                alt="Album cover preview"
                fill
                sizes="(min-width: 1024px) 440px, 100vw"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 grid grid-cols-3 gap-3 p-5 opacity-80">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div
                    key={index}
                    className={`rounded-[18px] border border-zinc-200 bg-white ${
                      index === 0 || index === 4 ? "row-span-2" : ""
                    }`}
                  />
                ))}
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-white/10 opacity-80" />
            <div className="absolute bottom-5 left-5 right-5 flex min-w-0 items-center justify-between gap-4">
              <div className="min-w-0 text-white">
                <p className="text-sm font-medium text-white/75">Cover photo</p>
                <p className="truncate text-xl font-semibold">Drop or select cover</p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950 shadow-lg">
                <ImageUp className="h-5 w-5" />
              </span>
            </div>
          </button>

          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => chooseCover(event.target.files)}
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:px-8">
        <div className="space-y-5">
          <div className="rounded-[26px] border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-950">Customer</p>
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="New customer name"
              aria-label="New customer name"
              className="mt-3 h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-base font-medium outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          <div className="rounded-[26px] border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-950">Dates</p>
            <div className="mt-3 grid gap-3">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-400">
                  Album date
                </span>
                <input
                  type="date"
                  value={albumDate}
                  onChange={(event) => setAlbumDate(event.target.value)}
                  className="mt-1 h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-medium outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-400">
                  Show until
                </span>
                <input
                  type="date"
                  value={expiresAt}
                  min={albumDate || undefined}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  className="mt-1 h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-medium outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
                />
              </label>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="rounded-[30px] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-950">Events</p>
              <p className="mt-1 text-sm text-zinc-500">
                Add the event tabs that should appear inside the album.
              </p>
            </div>
            <button
              type="button"
              onClick={addEvent}
              className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:text-zinc-950"
            >
              <Plus className="h-4 w-4" />
              Event
            </button>
          </div>

          <div className="grid gap-3">
            {events.map((eventName, index) => (
              <div
                key={index}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50 p-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-zinc-500 shadow-sm">
                  {index + 1}
                </span>
                <input
                  value={eventName}
                  onChange={(event) => updateEvent(index, event.target.value)}
                  placeholder="Event name"
                  aria-label={`Event ${index + 1} name`}
                  className="h-10 min-w-0 border-0 bg-transparent text-base font-medium outline-none placeholder:text-zinc-300"
                />
                <button
                  type="button"
                  onClick={() => removeEvent(index)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white hover:text-rose-600"
                  aria-label={`Remove event ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] bg-[#f3f5ff] p-4 text-sm text-zinc-600">
            <div className="flex items-center gap-2 font-semibold text-zinc-900">
              <CalendarDays className="h-4 w-4 text-[#4457ff]" />
              Expiration behavior
            </div>
            <p className="mt-2 leading-6">
              Customer-facing galleries show only until the selected expiration
              date. Admin album lists keep expired albums visible with an
              expired badge.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import {
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  LayoutTemplate,
  Pencil,
  Images,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { PeopleGrid } from "@/components/people-grid";
import { PersonView } from "@/components/person-view";
import { PhotosGrid, type PeopleMatchMode } from "@/components/photos-grid";
import { PhotoCard, PhotoLightbox, type PhotoOpenRect } from "./photo-card";
import { ApsaraMomentsRoot } from "@/components/apsara-moments";
import { AuthAvatarMenu } from "@/components/auth-avatar-menu";
import { ApplyPresetSelectionDialog } from "@/components/apply-preset-selection-dialog";
import { usePasscodeVerification } from "@/hooks/use-passcode-verification";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AlbumDetail, AlbumShareSettings, Person, Photo } from "@/lib/types";

type Tab = "photos" | "people";
type DownloadFormat = "original" | "png" | "jpeg";

const DOWNLOAD_FORMATS: Array<{ format: DownloadFormat; label: string }> = [
  { format: "original", label: "Original" },
  { format: "png", label: "PNG" },
  { format: "jpeg", label: "JPEG" },
];

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const message =
      data && typeof data.error === "string" ? data.error : "Request failed";
    console.error("Album request failed:", {
      url,
      status: response.status,
      message,
    });
    throw new Error(`${message} (${response.status})`);
  }

  return data;
};

interface AlbumGalleryPageProps {
  albumSlug: string;
}

interface AlbumStatsResponse {
  stats: {
    photoCount: number;
    peopleCount: number;
    events: {
      eventId: string;
      photoCount: number;
      peopleCount: number;
      pendingAiCount?: number;
    }[];
  };
}

interface PublicShareResponse {
  share: AlbumShareSettings;
}

interface AlbumSummaryForGate {
  slug: string;
  name: string;
  coverPhotoUrl?: string | null;
}

function eventQuery(selectedEventSlug: string | null, shareToken = "") {
  const params = new URLSearchParams();
  if (selectedEventSlug) params.set("event", selectedEventSlug);
  if (shareToken) params.set("share", shareToken);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function withShareParam(url: string, shareToken = "") {
  if (!shareToken) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}share=${encodeURIComponent(shareToken)}`;
}

function albumApiUrl(albumSlug: string, path = "", shareToken = "") {
  return withShareParam(
    `/api/albums/${encodeURIComponent(albumSlug)}${path}`,
    shareToken,
  );
}

function triggerBrowserDownload(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function formatAlbumDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function todayIsoDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function PasswordGate({
  albumSlug,
  albumName,
  onVerified,
}: {
  albumSlug: string;
  albumName: string;
  onVerified: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: albumsData } = useSWR<{ albums: AlbumSummaryForGate[] }>(
    "/api/albums",
    fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );

  const coverPhotoUrl = useMemo(() => {
    return (
      albumsData?.albums?.find((album) => album.slug === albumSlug)
        ?.coverPhotoUrl ?? null
    );
  }, [albumsData?.albums, albumSlug]);

  const verify = async () => {
    if (!password || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/verify-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );

      const data = (await response.json()) as { ok?: boolean };

      if (!response.ok || !data.ok) {
        setError("Wrong code. Signed up already? Click ‘Login here’ below.");
        return;
      }

      onVerified();
    } catch {
      setError("Wrong code. Signed up already? Click ‘Login here’ below.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-100 text-zinc-950">
      {coverPhotoUrl && (
        <Image
          src={coverPhotoUrl}
          alt={albumName}
          fill
          sizes="100vw"
          className="object-cover"
          priority
          unoptimized
        />
      )}

      <div className="absolute inset-0 bg-white/78 backdrop-blur-[1px]" />

      <div className="relative z-10 flex min-h-screen items-start justify-center px-5 pt-10 sm:pt-12">
        <div className="w-full max-w-[480px] text-center">
          <p className="mb-14 font-serif text-[18px] uppercase tracking-[0.28em] text-zinc-950">
            {albumName}
          </p>

          <h1 className="mb-14 text-[22px] font-semibold uppercase tracking-[0.22em] text-zinc-950">
            Enter code to view this gallery
          </h1>

          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") verify();
              }}
              placeholder="Access Code"
              aria-label="Access code"
              aria-invalid={Boolean(error)}
              className={`h-12 w-full border bg-white/70 px-4 text-[16px] tracking-wide text-zinc-950 outline-none backdrop-blur-sm placeholder:text-zinc-500 focus:border-zinc-950 ${
                error ? "border-red-500" : "border-zinc-300"
              }`}
            />

            {error && (
              <p className="text-left text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={verify}
              disabled={!password || isSubmitting}
              className="flex h-12 w-full cursor-pointer items-center justify-center bg-zinc-800 text-[13px] font-semibold uppercase tracking-[0.28em] text-white transition hover:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white/90" />
                  <span className="sr-only">Checking code</span>
                </span>
              ) : (
                "Continue"
              )}
            </button>
          </div>

          <div className="mt-20 space-y-4 text-center">
            <p className="text-[15px] tracking-wide text-zinc-950">
              Signed up already?{" "}
              <Link
                href="/login"
                className="text-zinc-950 transition hover:text-[#868686]"
              >
                Login here
              </Link>
            </p>

            <p className="mx-auto max-w-[440px] text-[14px] leading-5 tracking-wide text-zinc-500">
              Click ‘Login here’ if you signed up using your email, Facebook, or
              Google account.
            </p>

            <p className="text-[14px] tracking-wide">
              <Link
                href="/legal/terms-of-service"
                className="text-[#868686] transition hover:text-black"
              >
                Terms of Service
              </Link>{" "}
              <span className="text-[#868686]">and</span>{" "}
              <Link
                href="/legal/privacy-policy"
                className="text-[#868686] transition hover:text-black"
              >
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function SearchResultsGrid({
  albumSlug,
  shareToken = "",
  events,
  query,
  photos,
  isLoading,
  error,
  onClear,
  onPersonClick,
  shareSettings,
}: {
  albumSlug: string;
  shareToken?: string;
  events: AlbumDetail["events"];
  query: string;
  photos: Photo[];
  isLoading: boolean;
  error: string | null;
  onClear: () => void;
  onPersonClick?: (personId: string) => void;
  shareSettings?: AlbumShareSettings | null;
}) {
  const [lightboxState, setLightboxState] = useState<{
    index: number;
    originRect?: PhotoOpenRect;
  } | null>(null);

  const handleOpen = (index: number, originRect: PhotoOpenRect) => {
    setLightboxState({ index, originRect });
  };

  const handleNavigate = (index: number) => {
    setLightboxState({ index });
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 px-2 sm:flex-row sm:items-end sm:justify-between sm:px-0">
        <div>
          <p className="text-sm font-medium text-zinc-500">Search results</p>
          <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
            {query}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-10 w-fit cursor-pointer items-center justify-center rounded-full bg-white/80 px-4 text-sm font-medium text-zinc-600 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-inset ring-black/10 transition hover:bg-white hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
        >
          Back to photos
        </button>
      </div>

      {isLoading && (
        <div className="columns-2 gap-[3px] sm:columns-2 sm:gap-2 lg:columns-3">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="mb-[3px] break-inside-avoid sm:mb-2">
              <Skeleton className="h-56 w-full rounded-md sm:h-72" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-[24px] border border-rose-100 bg-white/85 px-5 py-8 text-center text-sm text-rose-700 shadow-[0_16px_45px_rgba(0,0,0,0.08)]">
          {error}
        </div>
      )}

      {!isLoading && !error && !photos.length && (
        <div className="rounded-[24px] border border-white/70 bg-white/85 px-6 py-12 text-center text-zinc-500 shadow-[0_16px_45px_rgba(0,0,0,0.08)]">
          No photos found for this search.
        </div>
      )}

      {!isLoading && !error && photos.length > 0 && (
        <div className="columns-2 gap-[3px] sm:columns-2 sm:gap-2 lg:columns-3">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="mb-2 break-inside-avoid overflow-hidden rounded-[22px] shadow-[0_16px_45px_rgba(0,0,0,0.12)] ring-1 ring-white/70 sm:mb-3"
            >
              <PhotoCard
                albumSlug={albumSlug}
                shareToken={shareToken}
                photo={photo}
                index={index}
                onOpen={handleOpen}
                shareSettings={shareSettings}
              />
            </div>
          ))}
        </div>
      )}

      {lightboxState !== null && (
        <PhotoLightbox
          albumSlug={albumSlug}
          shareToken={shareToken}
          photos={photos}
          currentIndex={lightboxState.index}
          events={events}
          originRect={lightboxState.originRect}
          onClose={() => setLightboxState(null)}
          onNavigate={handleNavigate}
          onPersonClick={onPersonClick}
          shareSettings={shareSettings}
        />
      )}
    </section>
  );
}

function PersonAvatar({
  person,
  size = "md",
}: {
  person: Person;
  size?: "sm" | "md";
}) {
  const dimension = size === "sm" ? "h-6 w-6" : "h-9 w-9";
  const displayName = person.displayName || person.defaultName;

  return (
    <span
      className={`relative inline-flex ${dimension} shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-white`}
    >
      {person.coverFaceUrl ? (
        <Image
          src={person.coverFaceUrl}
          alt={displayName}
          fill
          sizes={size === "sm" ? "24px" : "36px"}
          className="object-cover"
          unoptimized
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-zinc-400">
          <User className={size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5"} />
        </span>
      )}
    </span>
  );
}

function PeopleFilterButton({
  people,
  selectedPeople,
  selectedPeopleIds,
  onToggle,
  onClear,
}: {
  people: Person[];
  selectedPeople: Person[];
  selectedPeopleIds: string[];
  onToggle: (personId: string) => void;
  onClear: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedIdSet = useMemo(
    () => new Set(selectedPeopleIds),
    [selectedPeopleIds]
  );

  const previewPeople = selectedPeople.length
    ? selectedPeople.slice(0, 4)
    : people.slice(0, 4);

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return people;

    return people.filter((person) => {
      const name = `${person.displayName || ""} ${
        person.defaultName || ""
      } Person ${person.personNumber}`.toLowerCase();

      return name.includes(normalized);
    });
  }, [people, query]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-10 min-w-[128px] cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-medium shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-inset transition focus:outline-none focus:ring-2 focus:ring-zinc-950/20 ${
          selectedPeopleIds.length
            ? "bg-[#1d1d1f] text-white ring-[#1d1d1f]"
            : "bg-white/80 text-zinc-700 ring-black/10 hover:bg-white hover:text-zinc-950"
        }`}
        aria-expanded={isOpen}
        aria-label="Filter by people"
      >
        <Users className="h-4 w-4 shrink-0" />
        <span>People</span>

        {previewPeople.length > 0 && (
          <span className="hidden -space-x-2 md:flex">
            {previewPeople.map((person) => (
              <PersonAvatar key={person.id} person={person} size="sm" />
            ))}
          </span>
        )}

        {selectedPeopleIds.length > 0 && (
          <span className="rounded-full bg-white/20 px-1.5 text-xs">
            {selectedPeopleIds.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-3 w-[min(88vw,380px)] rounded-[24px] border border-white/80 bg-white/95 p-3 text-zinc-950 shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Filter people</p>
              <p className="text-xs text-zinc-500">
                {selectedPeopleIds.length
                  ? `${selectedPeopleIds.length} selected`
                  : "Select one or more"}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {selectedPeopleIds.length > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="cursor-pointer rounded-full px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                >
                  Clear
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                aria-label="Close people filter"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            className="mb-3 h-9"
          />

          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredPeople.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                No people found.
              </div>
            ) : (
              filteredPeople.map((person) => {
                const isSelected = selectedIdSet.has(person.id);
                const displayName = person.displayName || person.defaultName;

                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => onToggle(person.id)}
                    aria-pressed={isSelected}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 text-left transition ${
                      isSelected
                        ? "bg-[#1d1d1f] text-white"
                        : "hover:bg-zinc-100"
                    }`}
                  >
                    <PersonAvatar person={person} />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {displayName}
                      </span>
                      <span
                        className={`block text-xs ${
                          isSelected ? "text-white/65" : "text-zinc-500"
                        }`}
                      >
                        {person.photoCount} photos
                      </span>
                    </span>

                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PeopleMatchModeSelect({
  value,
  onChange,
}: {
  value: PeopleMatchMode;
  onChange: (value: PeopleMatchMode) => void;
}) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">People photo mode</span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value as PeopleMatchMode)}
        className="h-10 min-w-[196px] cursor-pointer appearance-none rounded-full bg-white/80 py-0 pl-4 pr-9 text-sm font-medium text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-inset ring-black/10 transition hover:bg-white hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
      >
        <option value="any">Show single person photos</option>
        <option value="all">Show multiple person photos</option>
      </select>

      <span className="pointer-events-none absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 border-b border-r border-zinc-500" />
    </label>
  );
}

function EventNameControl({
  eventName,
  isEditing,
  draft,
  isSaving,
  onStart,
  onDraftChange,
  onSave,
  onCancel,
}: {
  eventName: string;
  isEditing: boolean;
  draft: string;
  isSaving: boolean;
  onStart: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (isEditing) {
    return (
      <div className="flex max-w-full items-center gap-1.5">
        <Input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSave();
            if (event.key === "Escape") onCancel();
          }}
          className="h-8 w-48 max-w-[60vw] bg-white"
          aria-label="Event name"
          disabled={isSaving}
          autoFocus
        />

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || !draft.trim()}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-950/5 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Save event name"
        >
          <Check className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Cancel event name edit"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <p className="text-sm font-medium text-zinc-500">{eventName}</p>

      <button
        type="button"
        onClick={onStart}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300"
        aria-label={`Edit ${eventName} event name`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AlbumDownloadMenu({
  albumSlug,
  shareToken = "",
  events,
  selectedEventSlug,
  selectedPeopleIds,
  selectedPeople,
  peopleMatchMode,
  selectedDownloadPhotoIds,
  downloadsEnabled = true,
}: {
  albumSlug: string;
  shareToken?: string;
  events: AlbumDetail["events"];
  selectedEventSlug: string | null;
  selectedPeopleIds: string[];
  selectedPeople: Person[];
  peopleMatchMode: PeopleMatchMode;
  selectedDownloadPhotoIds: string[];
  downloadsEnabled?: boolean;
}) {
  if (!downloadsEnabled) return null;

  const downloadUrl = (options?: {
    eventSlug?: string | null;
    format?: DownloadFormat;
    people?: boolean;
    selected?: boolean;
  }) => {
    const params = new URLSearchParams();

    if (options?.eventSlug) params.set("event", options.eventSlug);
    if (options?.format && options.format !== "original") {
      params.set("format", options.format);
    }
    if (options?.selected && selectedDownloadPhotoIds.length) {
      params.set("photos", selectedDownloadPhotoIds.join(","));
    }

    if (options?.people && selectedPeopleIds.length) {
      params.set("people", selectedPeopleIds.join(","));
      if (selectedPeopleIds.length > 1) {
        params.set("peopleMode", peopleMatchMode);
      }
    }

    const query = params.toString();
    const url = `/api/albums/${encodeURIComponent(albumSlug)}/downloads${
      query ? `?${query}` : ""
    }`;
    return withShareParam(url, shareToken);
  };

  const selectedEvent = events.find((event) => event.slug === selectedEventSlug);
  const peopleLabel =
    selectedPeople.length === 1
      ? selectedPeople[0].displayName || selectedPeople[0].defaultName
      : `${selectedPeopleIds.length} people`;
  const formatItems = (options?: {
    eventSlug?: string | null;
    people?: boolean;
    selected?: boolean;
  }) =>
    DOWNLOAD_FORMATS.map(({ format, label }) => (
      <DropdownMenuItem
        key={format}
        onSelect={() => triggerBrowserDownload(downloadUrl({ ...options, format }))}
      >
        <Download className="h-4 w-4" />
        {label}
      </DropdownMenuItem>
    ));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-10 min-w-[132px] cursor-pointer items-center justify-center gap-2 rounded-full bg-white/80 px-4 text-sm font-medium text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-inset ring-black/10 transition hover:bg-white hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
          aria-label="Download photos"
        >
          <Download className="h-4 w-4 shrink-0" />
          <span>Download</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-72 rounded-[20px] border-white/80 bg-white/95 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl"
      >
        <DropdownMenuLabel>Download photos</DropdownMenuLabel>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download className="h-4 w-4" />
            Download all
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-36">
            {formatItems()}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {selectedDownloadPhotoIds.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Check className="h-4 w-4" />
              <span className="min-w-0 flex-1 truncate">
                Download selected photos
              </span>
              <span className="text-xs text-zinc-500">
                {selectedDownloadPhotoIds.length}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-36">
              {formatItems({ selected: true })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {events.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {events.map((event) => (
              <DropdownMenuSub key={event.id}>
                <DropdownMenuSubTrigger>
                  <Download className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">
                    Download {event.name}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {event.photoCount}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-36">
                  {formatItems({ eventSlug: event.slug })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </>
        )}

        {selectedPeopleIds.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Download className="h-4 w-4" />
                <span className="min-w-0 flex-1 truncate">
                  Download filtered people images
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-36">
                {formatItems({
                  eventSlug: selectedEventSlug,
                  people: true,
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <p className="px-2 pb-1 text-xs text-zinc-500">
              {peopleLabel}
              {selectedEvent ? ` in ${selectedEvent.name}` : ""}
            </p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface AlbumShareResponse {
  share: (AlbumShareSettings & { id?: string; url: string }) | null;
  defaults?: AlbumShareSettings;
}

const cornerOptions = [
  { id: "top_left", label: "Top left" },
  { id: "top_right", label: "Top right" },
  { id: "bottom_left", label: "Bottom left" },
  { id: "bottom_right", label: "Bottom right" },
];

function AlbumShareDialog({
  albumSlug,
  defaultWatermarkText,
}: {
  albumSlug: string;
  defaultWatermarkText: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [allowDownloads, setAllowDownloads] = useState(false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkText, setWatermarkText] = useState(defaultWatermarkText);
  const [watermarkMode, setWatermarkMode] =
    useState<AlbumShareSettings["watermarkMode"]>("corners");
  const [watermarkPositions, setWatermarkPositions] =
    useState<string[]>(["bottom_right"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [status, setStatus] = useState("");

  const { data, mutate } = useSWR<AlbumShareResponse>(
    isOpen ? `/api/albums/${encodeURIComponent(albumSlug)}/share` : null,
    fetcher,
    {
      dedupingInterval: 15 * 1000,
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    if (!isOpen || !data) return;

    const source = data.share ?? data.defaults;
    if (!source) return;

    setAllowDownloads(source.allowDownloads);
    setWatermarkEnabled(source.watermarkEnabled);
    setWatermarkText(source.watermarkText || defaultWatermarkText);
    setWatermarkMode(source.watermarkMode);
    setWatermarkPositions(
      source.watermarkPositions?.length
        ? source.watermarkPositions
        : ["bottom_right"],
    );
    setExpiresAt(source.expiresAt ?? "");

    setShareUrl(data.share?.url ?? "");
  }, [data, defaultWatermarkText, isOpen]);

  const toggleCorner = (position: string) => {
    setWatermarkPositions((current) => {
      const next = current.includes(position)
        ? current.filter((item) => item !== position)
        : [...current, position];
      return next.length ? next : ["bottom_right"];
    });
  };

  const save = async () => {
    setIsSaving(true);
    setStatus("");

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            allowDownloads,
            watermarkEnabled,
            watermarkText,
            watermarkMode,
            watermarkPositions,
            expiresAt: expiresAt || null,
          }),
        },
      );
      const payload = (await response.json()) as AlbumShareResponse | { error?: string };

      if (!response.ok || !("share" in payload) || !payload.share) {
        throw new Error("error" in payload ? payload.error : "Failed to save");
      }

      setShareUrl(payload.share.url);
      setStatus("Saved");
      await mutate(payload as AlbumShareResponse, { revalidate: false });
    } catch (error) {
      console.error("Failed to save share link:", error);
      setStatus("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard?.writeText(shareUrl);
    setStatus("Copied");
  };

  const deleteLink = async () => {
    if (!shareUrl || isDeleting) return;
    const confirmed = window.confirm("Delete this share link?");
    if (!confirmed) return;

    setIsDeleting(true);
    setStatus("");

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/share`,
        { method: "DELETE" },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete");
      }

      setShareUrl("");
      setStatus("Deleted");
      await mutate(
        {
          share: null,
          defaults: data?.defaults,
        },
        { revalidate: false },
      );
    } catch (error) {
      console.error("Failed to delete share link:", error);
      setStatus("Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex h-10 min-w-[104px] cursor-pointer items-center justify-center gap-2 rounded-full bg-white/80 px-4 text-sm font-medium text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-inset ring-black/10 transition hover:bg-white hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
          aria-label="Share album link"
        >
          <Share2 className="h-4 w-4 shrink-0" />
          <span>Share</span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Share album link</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-[18px] border border-zinc-200/70 bg-zinc-50/70 p-3">
            <Label htmlFor="share-allow-downloads" className="text-sm font-medium">
              Allow downloads
            </Label>
            <Switch
              id="share-allow-downloads"
              checked={allowDownloads}
              onCheckedChange={setAllowDownloads}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="share-expires-at">Expires on</Label>
            <Input
              id="share-expires-at"
              type="date"
              min={todayIsoDate()}
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>

          <div className="space-y-3 rounded-[18px] border border-zinc-200/70 bg-zinc-50/70 p-3">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="share-watermark" className="text-sm font-medium">
                Watermark
              </Label>
              <Switch
                id="share-watermark"
                checked={watermarkEnabled}
                onCheckedChange={setWatermarkEnabled}
              />
            </div>

            {watermarkEnabled && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="share-watermark-text">Company name</Label>
                  <Input
                    id="share-watermark-text"
                    value={watermarkText}
                    onChange={(event) => setWatermarkText(event.target.value)}
                  />
                </div>

                <RadioGroup
                  value={watermarkMode}
                  onValueChange={(value) => {
                    const nextMode = value as AlbumShareSettings["watermarkMode"];
                    setWatermarkMode(nextMode);
                    if (nextMode === "corners" && !watermarkPositions.length) {
                      setWatermarkPositions(["bottom_right"]);
                    }
                  }}
                  className="gap-2"
                >
                  <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-200/80 bg-white/80 px-3 py-2">
                    <RadioGroupItem value="full" />
                    <span className="text-sm font-medium">Full photo</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-200/80 bg-white/80 px-3 py-2">
                    <RadioGroupItem value="corners" />
                    <span className="text-sm font-medium">Corners</span>
                  </label>
                </RadioGroup>

                {watermarkMode === "corners" && (
                  <div className="grid grid-cols-2 gap-2">
                    {cornerOptions.map((option) => (
                      <label
                        key={option.id}
                        className="flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-200/80 bg-white/80 px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={watermarkPositions.includes(option.id)}
                          onCheckedChange={() => toggleCorner(option.id)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {shareUrl && (
            <div className="flex min-w-0 gap-2">
              <Input value={shareUrl} readOnly className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copyLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}

          {status && (
            <p className="text-sm font-medium text-zinc-500">{status}</p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            onClick={deleteLink}
            disabled={!shareUrl || isSaving || isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete link
          </Button>
          <Button type="button" onClick={save} disabled={isSaving || isDeleting}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AlbumGalleryPage({ albumSlug }: AlbumGalleryPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shareToken = searchParams.get("share") || "";
  const isShareView = Boolean(shareToken);
  const autoCoverScrollDoneRef = useRef(false);
  const autoCoverScrollTimerRef = useRef<number | null>(null);
  const coverScrollAnimationFrameRef = useRef<number | null>(null);
  const coverCollapseTimerRef = useRef<number | null>(null);
  const coverTouchStartYRef = useRef<number | null>(null);
  const coverGestureTriggeredRef = useRef(false);

  const [activeTab, setActiveTab] = useState<Tab>("photos");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [peopleMatchMode, setPeopleMatchMode] =
    useState<PeopleMatchMode>("all");
  const [selectedEventSlug, setSelectedEventSlug] = useState<string | null>(
    searchParams.get("event") || null
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const {
    isVerified: isPasswordVerified,
    markVerified: markPasswordVerified,
  } = usePasscodeVerification("album", albumSlug);
  const [isCoverDismissed, setIsCoverDismissed] = useState(false);
  const [isCoverCollapsing, setIsCoverCollapsing] = useState(false);
  const [isPhotoSelectionMode, setIsPhotoSelectionMode] = useState(false);
  const [selectedDownloadPhotoIds, setSelectedDownloadPhotoIds] = useState<string[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventNameDraft, setEventNameDraft] = useState("");
  const [isSavingEventName, setIsSavingEventName] = useState(false);
  const [apsaraTextSearch, setApsaraTextSearch] = useState<{
    query: string;
    photos: Photo[];
    isLoading: boolean;
    error: string | null;
  } | null>(null);

  const { data, error, isLoading, mutate } = useSWR<{ album: AlbumDetail }>(
    albumApiUrl(albumSlug, "", shareToken),
    fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );

  // Check if any event has photos but no people (AI still processing)
  const hasEventsLoadingAi = useMemo(() => {
    return data?.album?.events?.some(
      (event) => (event.photoCount ?? 0) > 0 && (event.peopleCount ?? 0) === 0
    );
  }, [data?.album?.events]);

  const { data: statsData, mutate: mutateStats } = useSWR<AlbumStatsResponse>(
    data?.album ? albumApiUrl(albumSlug, "/stats", shareToken) : null,
    fetcher,
    {
      dedupingInterval: hasEventsLoadingAi ? 10 * 1000 : 5 * 60 * 1000, // Refresh every 10s if AI is loading, else 5 minutes
      revalidateOnFocus: false,
    }
  );

  useEffect(() => {
    if (!data?.album) return;
    void mutate();
    void mutateStats();
  }, [data?.album?.id, mutate, mutateStats, selectedEventSlug]);

  const { data: peopleFilterData } = useSWR<{ people: Person[] }>(
    data?.album && (!data.album.passwordRequired || isPasswordVerified)
      ? albumApiUrl(albumSlug, "/people", shareToken)
      : null,
    fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );

  const album = useMemo(() => {
    if (!data?.album) return undefined;

    const eventStatsById = new Map(
      statsData?.stats.events.map((event) => [event.eventId, event]) ?? []
    );

    return {
      ...data.album,
      photoCount: statsData?.stats.photoCount ?? data.album.photoCount,
      peopleCount: statsData?.stats.peopleCount ?? data.album.peopleCount,
      events: data.album.events.map((event) => {
        const stats = eventStatsById.get(event.id);

        return {
          ...event,
          photoCount: stats?.photoCount ?? event.photoCount,
          peopleCount: stats?.peopleCount ?? event.peopleCount,
        };
      }),
    };
  }, [data?.album, statsData?.stats]);

  const filterPeople = peopleFilterData?.people ?? [];

  const selectedFilterPeople = useMemo(() => {
    const selectedIds = new Set(selectedPeopleIds);
    return filterPeople.filter((person) => selectedIds.has(person.id));
  }, [filterPeople, selectedPeopleIds]);

  const selectedEvent = useMemo(
    () => album?.events.find((event) => event.slug === selectedEventSlug),
    [album?.events, selectedEventSlug]
  );
  const albumDateLabel = formatAlbumDate(album?.albumDate);
  const coverTitle = album?.name || "";
  const coverCreditName = album?.customer?.name || album?.name || "";
  const { data: publicShareData } = useSWR<PublicShareResponse>(
    shareToken ? `/api/share/${encodeURIComponent(shareToken)}` : null,
    fetcher,
    {
      dedupingInterval: 60 * 1000,
      revalidateOnFocus: false,
    },
  );
  const shareSettings = publicShareData?.share ?? null;
  const downloadsEnabled = isShareView
    ? Boolean(shareSettings?.allowDownloads)
    : shareSettings?.allowDownloads ?? true;

  const cancelGalleryScrollAnimation = () => {
    if (coverScrollAnimationFrameRef.current === null) return;
    window.cancelAnimationFrame(coverScrollAnimationFrameRef.current);
    coverScrollAnimationFrameRef.current = null;
  };

  const clearAutoCoverScroll = () => {
    autoCoverScrollDoneRef.current = true;
    if (autoCoverScrollTimerRef.current !== null) {
      window.clearTimeout(autoCoverScrollTimerRef.current);
      autoCoverScrollTimerRef.current = null;
    }
  };

  const collapseCoverToGallery = () => {
    clearAutoCoverScroll();
    cancelGalleryScrollAnimation();
    if (coverCollapseTimerRef.current !== null) {
      window.clearTimeout(coverCollapseTimerRef.current);
      coverCollapseTimerRef.current = null;
    }
    setIsCoverCollapsing(true);

    coverCollapseTimerRef.current = window.setTimeout(() => {
      coverCollapseTimerRef.current = null;
      setIsCoverDismissed(true);
      setIsCoverCollapsing(false);
      window.scrollTo({ top: 0, left: 0 });
    }, 760);
  };

  const scrollToGalleryTop = (mode: "normal" | "soothing" = "normal") => {
    requestAnimationFrame(() => {
      clearAutoCoverScroll();
      if (mode === "soothing" && !isCoverDismissed) {
        collapseCoverToGallery();
        return;
      }
      cancelGalleryScrollAnimation();

      const shell = document.getElementById("album-gallery-shell");
      const targetTop = shell ? Math.max(shell.offsetTop - 8, 0) : 0;

      if (
        mode === "normal" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        window.scrollTo({
          top: targetTop,
          left: 0,
          behavior: "smooth",
        });
        return;
      }

      const startTop = window.scrollY;
      const distance = targetTop - startTop;
      const duration = 1300;
      const startedAt = performance.now();
      const easeInOutSine = (value: number) =>
        -(Math.cos(Math.PI * value) - 1) / 2;

      const animate = (now: number) => {
        const elapsed = Math.min((now - startedAt) / duration, 1);
        const progress = easeInOutSine(elapsed);

        window.scrollTo(0, startTop + distance * progress);

        if (elapsed < 1) {
          coverScrollAnimationFrameRef.current = window.requestAnimationFrame(animate);
          return;
        }

        coverScrollAnimationFrameRef.current = null;
        setIsCoverDismissed(true);
        requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
      };

      coverScrollAnimationFrameRef.current = window.requestAnimationFrame(animate);
    });
  };

  const triggerCoverGestureScroll = () => {
    if (isCoverDismissed || isCoverCollapsing || coverGestureTriggeredRef.current) {
      return;
    }

    coverGestureTriggeredRef.current = true;
    scrollToGalleryTop("soothing");
  };

  const handleCoverWheel = (event: ReactWheelEvent<HTMLElement>) => {
    if (event.deltaY > 4) {
      triggerCoverGestureScroll();
    }
  };

  const handleCoverTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    coverTouchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleCoverTouchMove = (event: ReactTouchEvent<HTMLElement>) => {
    const startY = coverTouchStartYRef.current;
    const currentY = event.touches[0]?.clientY;
    if (startY === null || currentY === undefined) return;

    if (Math.abs(currentY - startY) > 24) {
      triggerCoverGestureScroll();
    }
  };

  useEffect(() => {
    autoCoverScrollDoneRef.current = false;
    coverGestureTriggeredRef.current = false;
    coverTouchStartYRef.current = null;
    setIsCoverDismissed(false);
    setIsCoverCollapsing(false);
    setIsPhotoSelectionMode(false);
    setSelectedDownloadPhotoIds([]);
  }, [albumSlug]);

  useEffect(() => {
    if (downloadsEnabled) return;
    setIsPhotoSelectionMode(false);
    setSelectedDownloadPhotoIds([]);
  }, [downloadsEnabled]);

  useEffect(() => {
    if (isCoverDismissed) return;

    const dismissWhenGalleryIsReached = () => {
      const shell = document.getElementById("album-gallery-shell");
      if (!shell) return;

      if (window.scrollY >= Math.max(shell.offsetTop - 24, 0)) {
        clearAutoCoverScroll();
        cancelGalleryScrollAnimation();
        setIsCoverDismissed(true);
        setIsCoverCollapsing(false);
        requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
      }
    };

    window.addEventListener("scroll", dismissWhenGalleryIsReached, {
      passive: true,
    });
    return () => window.removeEventListener("scroll", dismissWhenGalleryIsReached);
  }, [isCoverDismissed]);

  useEffect(() => {
    if (!album || (album.passwordRequired && !isPasswordVerified)) return;
    if (autoCoverScrollDoneRef.current) return;

    const cancelAutoScroll = () => {
      clearAutoCoverScroll();
    };

    autoCoverScrollTimerRef.current = window.setTimeout(() => {
      autoCoverScrollTimerRef.current = null;

      if (autoCoverScrollDoneRef.current || window.scrollY > 24) return;

      autoCoverScrollDoneRef.current = true;
      scrollToGalleryTop("soothing");
    }, 5000);

    window.addEventListener("wheel", cancelAutoScroll, { passive: true });
    window.addEventListener("touchstart", cancelAutoScroll, { passive: true });
    window.addEventListener("pointerdown", cancelAutoScroll);
    window.addEventListener("keydown", cancelAutoScroll);

    return () => {
      if (autoCoverScrollTimerRef.current !== null) {
        window.clearTimeout(autoCoverScrollTimerRef.current);
        autoCoverScrollTimerRef.current = null;
      }
      if (coverCollapseTimerRef.current !== null) {
        window.clearTimeout(coverCollapseTimerRef.current);
        coverCollapseTimerRef.current = null;
      }
      cancelGalleryScrollAnimation();
      window.removeEventListener("wheel", cancelAutoScroll);
      window.removeEventListener("touchstart", cancelAutoScroll);
      window.removeEventListener("pointerdown", cancelAutoScroll);
      window.removeEventListener("keydown", cancelAutoScroll);
    };
  }, [album, isPasswordVerified]);

  useEffect(() => {
    const eventFromUrl = searchParams.get("event") || null;
    setSelectedEventSlug(eventFromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (!album || !selectedEventSlug) return;

    if (!album.events.some((event) => event.slug === selectedEventSlug)) {
      setSelectedEventSlug(null);
      router.replace(`/albums/${albumSlug}`, { scroll: false });
    }
  }, [album, albumSlug, router, selectedEventSlug]);

  useEffect(() => {
    if (selectedPeopleIds.length < 2 && peopleMatchMode !== "all") {
      setPeopleMatchMode("all");
    }
  }, [peopleMatchMode, selectedPeopleIds.length]);

  const changeEvent = (eventSlug: string | null) => {
    setSelectedEventSlug(eventSlug);
    setEditingEventId(null);
    setApsaraTextSearch(null);

    router.replace(`/albums/${albumSlug}${eventQuery(eventSlug, shareToken)}`, {
      scroll: false,
    });

    scrollToGalleryTop();
  };

  const goToNextEvent = () => {
    if (!album) return;
    if (activeTab !== "photos") return;
    if (selectedPerson) return;
    if (!selectedEventSlug) return;
    if (selectedPeopleIds.length > 0) return;

    const currentIndex = album.events.findIndex(
      (event) => event.slug === selectedEventSlug
    );

    if (currentIndex < 0) return;

    const nextEvent = album.events[currentIndex + 1];
    if (!nextEvent) return;

    changeEvent(nextEvent.slug);
  };

  const openPerson = (person: Person) => {
    setApsaraTextSearch(null);
    setSelectedPerson(person);
    setActiveTab("people");
    scrollToGalleryTop();
  };

  const filterByPerson = (personId: string) => {
    setApsaraTextSearch(null);
    setSelectedPeopleIds([personId]);
    setPeopleMatchMode("all");
    setSelectedPerson(null);
    setActiveTab("photos");
    scrollToGalleryTop();
  };

  const filterByPeopleSelection = (people: Person[], mode: PeopleMatchMode) => {
    const ids = people.map((person) => person.id);

    setApsaraTextSearch(null);
    setSelectedPeopleIds(ids);
    setPeopleMatchMode(ids.length > 1 ? mode : "all");
    setSelectedPerson(null);
    setActiveTab("photos");
    scrollToGalleryTop();
  };

  const toggleSelectedPersonId = (personId: string) => {
    setApsaraTextSearch(null);
    setSelectedPeopleIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]
    );
    setSelectedPerson(null);
    setActiveTab("photos");
    scrollToGalleryTop();
  };

  const toggleSelectedDownloadPhotoId = (photoId: string) => {
    setSelectedDownloadPhotoIds((current) =>
      current.includes(photoId)
        ? current.filter((id) => id !== photoId)
        : [...current, photoId]
    );
  };

  const runApsaraTextSearch = async (
    searchQuery: string,
    selectedPeople: Person[] = []
  ) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    const personIds = selectedPeople.map((person) => person.id);

    setSelectedPerson(null);
    setSelectedPeopleIds([]);
    setPeopleMatchMode("all");
    setActiveTab("photos");
    setApsaraTextSearch({
      query: trimmedQuery,
      photos: [],
      isLoading: true,
      error: null,
    });
    scrollToGalleryTop();

    try {
      const response = await fetch(
        albumApiUrl(albumSlug, "/search", shareToken),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: trimmedQuery,
            event: selectedEventSlug,
            people: personIds,
            together: true,
            limit: 100,
          }),
        }
      );

      if (!response.ok) throw new Error("Search request failed");

      const payload = (await response.json()) as { results?: Photo[] };

      setApsaraTextSearch({
        query: trimmedQuery,
        photos: payload.results ?? [],
        isLoading: false,
        error: null,
      });
    } catch (searchError) {
      console.error("SaathiDesk text search failed:", searchError);
      setApsaraTextSearch({
        query: trimmedQuery,
        photos: [],
        isLoading: false,
        error: "Failed to search photos. Please try again.",
      });
    }
  };

  const startEditingSelectedEvent = () => {
    if (!selectedEvent) return;

    setEditingEventId(selectedEvent.id);
    setEventNameDraft(selectedEvent.name);
  };

  const cancelEditingEvent = () => {
    setEditingEventId(null);
    setEventNameDraft("");
  };

  const saveEventName = async () => {
    if (!selectedEvent || !eventNameDraft.trim() || isSavingEventName) return;

    setIsSavingEventName(true);

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/events`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: selectedEvent.id,
            name: eventNameDraft.trim(),
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to update event name");

      const payload = (await response.json()) as {
        events?: AlbumDetail["events"];
      };

      if (payload.events) {
        await mutate(
          (current) =>
            current
              ? {
                  album: {
                    ...current.album,
                    events: payload.events ?? current.album.events,
                  },
                }
              : current,
          { revalidate: false }
        );
      } else {
        await mutate();
      }

      cancelEditingEvent();
    } catch (eventNameError) {
      console.error("Failed to update event name:", eventNameError);
    } finally {
      setIsSavingEventName(false);
    }
  };

  const eventLabel = selectedEvent?.name ?? "All events";
  const selectedEventStats = statsData?.stats.events.find(
    (event) => event.eventId === selectedEvent?.id
  );
  const isAiDataLoadingForEvent = Boolean(
    selectedEvent && (selectedEventStats?.pendingAiCount ?? 0) > 0
  );

  const eventHeader = selectedEvent && !isShareView ? (
    <EventNameControl
      eventName={selectedEvent.name}
      isEditing={editingEventId === selectedEvent.id}
      draft={eventNameDraft}
      isSaving={isSavingEventName}
      onStart={startEditingSelectedEvent}
      onDraftChange={setEventNameDraft}
      onSave={saveEventName}
      onCancel={cancelEditingEvent}
    />
  ) : (
    <p className="text-sm font-medium text-zinc-500">{eventLabel}</p>
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f5f5f7]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Skeleton className="mb-6 h-10 w-56" />
          <Skeleton className="mb-4 h-12 w-full rounded-full" />

          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-72 min-w-[min(42vw,180px)] flex-1 rounded-[22px] bg-white/70 shadow-[0_16px_45px_rgba(0,0,0,0.08)]"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !album) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] px-4 py-12 text-center text-zinc-600">
        Failed to load album.
        {error instanceof Error && (
          <span className="mt-2 block text-sm text-zinc-500">
            {error.message}
          </span>
        )}
      </main>
    );
  }

  if (album.passwordRequired && !isPasswordVerified) {
    return (
      <PasswordGate
        albumSlug={albumSlug}
        albumName={album.name}
        onVerified={markPasswordVerified}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      {!isCoverDismissed && (
        <section
          onWheel={handleCoverWheel}
          onTouchStart={handleCoverTouchStart}
          onTouchMove={handleCoverTouchMove}
          className={`relative flex flex-col items-center justify-center overflow-hidden bg-[#f5f5f7] px-5 text-center transition-[height,opacity,padding] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isCoverCollapsing ? "py-0 opacity-0" : "py-8 opacity-100 sm:py-10"
          }`}
          style={{ height: isCoverCollapsing ? 0 : "100svh" }}
        >
          {album.coverPhotoUrl && (
            <Image
              src={album.coverPhotoUrl}
              alt={album.name}
              fill
              sizes="100vw"
              className="object-cover opacity-35 saturate-[1.08] contrast-[1.03]"
              priority
              unoptimized
            />
          )}
          <div className="absolute inset-0 bg-[#f5f5f7]/68 backdrop-blur-[2px]" />

          <div
            className={`relative z-10 flex w-full max-w-6xl flex-col items-center pb-16 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isCoverCollapsing ? "-translate-y-8" : "translate-y-0"
            }`}
          >
            <div className="relative grid w-full items-center gap-5 sm:grid-cols-[1fr_minmax(250px,380px)_1fr] sm:gap-8 lg:gap-12">
              <div className="order-2 flex justify-center sm:order-1 sm:h-[340px] sm:items-center">
                <div className="text-center text-[11px] font-medium tracking-normal text-zinc-500 sm:w-[340px] sm:-rotate-90">
                  <span>Photos by</span>
                  <span className="ml-1 text-zinc-800">{coverCreditName}</span>
                </div>
              </div>

              <div className="order-1 flex justify-center sm:order-2">
                <div className="relative aspect-[4/5] w-[min(62vw,320px)] overflow-hidden rounded-[30px] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.22)] ring-1 ring-white/70 sm:w-[min(32vw,380px)] sm:rounded-[36px]">
                  {album.coverPhotoUrl ? (
                    <Image
                      src={album.coverPhotoUrl}
                      alt={album.name}
                      fill
                      sizes="(min-width: 768px) 380px, 62vw"
                      className="object-cover"
                      priority
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-300">
                      <Images className="h-20 w-20" strokeWidth={1.3} />
                    </div>
                  )}
                </div>
              </div>

              <div className="order-3 flex justify-center text-center sm:justify-start sm:text-left">
                <div className="flex min-w-0 flex-col items-center gap-2 text-zinc-950 sm:flex-row sm:items-center sm:gap-4">
                  <h1 className="max-w-full break-words text-center text-2xl font-semibold uppercase tracking-[0.08em] sm:max-w-[18rem] sm:text-left sm:text-4xl lg:text-5xl">
                    {coverTitle}
                  </h1>

                  {albumDateLabel && (
                    <>
                      <span className="hidden h-px w-10 shrink-0 bg-zinc-400 sm:block" />
                      <p className="text-base font-medium text-zinc-500 sm:text-lg">
                        {albumDateLabel}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {album.description && (
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-500">
                {album.description}
              </p>
            )}

            {album.isExpired && (
              <div className="mt-5 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-rose-700">
                Album expired
              </div>
            )}

            <button
              type="button"
              onClick={() => scrollToGalleryTop("soothing")}
              className="absolute bottom-5 left-1/2 flex h-12 w-12 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:-translate-y-0.5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300 sm:bottom-7"
              aria-label="Scroll to gallery"
            >
              <ChevronDown className="h-6 w-6" />
            </button>
          </div>
        </section>
      )}

      <header id="album-gallery-shell" className="sticky top-0 z-30 px-3 pt-3 sm:px-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-[28px] border border-white/70 bg-white/[0.82] px-3 py-3 shadow-[0_18px_55px_rgba(0,0,0,0.12)] backdrop-blur-2xl sm:px-4">
          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                  Photographer
                </p>
                <h1 className="truncate text-[17px] font-semibold tracking-normal text-[#1d1d1f] sm:text-xl">
                  {album.customer?.name || coverCreditName}
                </h1>
                <p className="truncate text-xs font-medium text-zinc-500">
                  {album.name} · {album.peopleCount} people
                </p>
              </div>

              {!selectedPerson && (
                <div
                  className="grid shrink-0 grid-cols-2 gap-1 rounded-full bg-zinc-950/[0.04] p-1 ring-1 ring-black/5 sm:hidden"
                  role="tablist"
                >
                  <button
                    role="tab"
                    aria-selected={activeTab === "photos"}
                    onClick={() => {
                      setSelectedPerson(null);
                      setApsaraTextSearch(null);
                      setActiveTab("photos");
                      scrollToGalleryTop();
                    }}
                    className={`flex h-8 min-w-20 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition ${
                      activeTab === "photos"
                        ? "bg-white text-[#1d1d1f] shadow-sm"
                        : "text-zinc-500"
                    }`}
                  >
                    <Images className="h-4 w-4" />
                    Photos
                  </button>

                  <button
                    role="tab"
                    aria-selected={activeTab === "people"}
                    onClick={() => {
                      setSelectedPerson(null);
                      setApsaraTextSearch(null);
                      setActiveTab("people");
                      scrollToGalleryTop();
                    }}
                    className={`flex h-8 min-w-20 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition ${
                      activeTab === "people"
                        ? "bg-white text-[#1d1d1f] shadow-sm"
                        : "text-zinc-500"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    People
                  </button>
                </div>
              )}
            </div>

              {!selectedPerson && activeTab === "photos" && (
                <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:pb-0 xl:ml-2">
                  <PeopleFilterButton
                    people={filterPeople}
                    selectedPeople={selectedFilterPeople}
                    selectedPeopleIds={selectedPeopleIds}
                    onToggle={toggleSelectedPersonId}
                    onClear={() => setSelectedPeopleIds([])}
                  />

                  {selectedPeopleIds.length > 1 && (
                    <PeopleMatchModeSelect
                      value={peopleMatchMode}
                      onChange={setPeopleMatchMode}
                    />
                  )}
                </div>
              )}

            <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 xl:justify-end xl:pb-0">
              <AlbumDownloadMenu
                albumSlug={albumSlug}
                shareToken={shareToken}
                events={album.events}
                selectedEventSlug={selectedEventSlug}
                selectedPeopleIds={selectedPeopleIds}
                selectedPeople={selectedFilterPeople}
                peopleMatchMode={peopleMatchMode}
                selectedDownloadPhotoIds={selectedDownloadPhotoIds}
                downloadsEnabled={downloadsEnabled}
              />

              {downloadsEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPhotoSelectionMode((current) => !current);
                    setActiveTab("photos");
                    setSelectedPerson(null);
                    setApsaraTextSearch(null);
                    scrollToGalleryTop();
                  }}
                  className={`flex h-10 min-w-[112px] cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-medium shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-inset transition focus:outline-none focus:ring-2 focus:ring-zinc-950/20 ${
                    isPhotoSelectionMode
                      ? "bg-[#1d1d1f] text-white ring-[#1d1d1f]"
                      : "bg-white/80 text-zinc-700 ring-black/10 hover:bg-white hover:text-zinc-950"
                  }`}
                  aria-pressed={isPhotoSelectionMode}
                  aria-label="Select photos"
                >
                  <Check className="h-4 w-4 shrink-0" />
                  <span>
                    {isPhotoSelectionMode
                      ? `${selectedDownloadPhotoIds.length} Selected`
                      : "Select"}
                  </span>
                </button>
              )}

              {!isShareView && (
                <AlbumShareDialog
                  albumSlug={albumSlug}
                  defaultWatermarkText={album.customer?.name || album.name}
                />
              )}

              {!isShareView && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-10 min-w-[116px] cursor-pointer items-center justify-center gap-2 rounded-full bg-white/80 px-4 text-sm font-medium text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-inset ring-black/10 transition hover:bg-white hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                      aria-label="AI review"
                    >
                      <Sparkles className="h-4 w-4 shrink-0" />
                      <span>AI Review</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>AI Review</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/albums/${encodeURIComponent(
                          albumSlug,
                        )}/culling?mode=best`}
                      >
                        <Sparkles className="h-4 w-4" />
                        Pick Best Photos
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/albums/${encodeURIComponent(
                          albumSlug,
                        )}/culling?mode=problems`}
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Needs Review
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/albums/${encodeURIComponent(
                          albumSlug,
                        )}/culling?mode=by_person`}
                      >
                        <Users className="h-4 w-4" />
                        Best by Person
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {!isShareView && (
                <Link
                  href={`/albums/${encodeURIComponent(albumSlug)}/collage`}
                  className="flex h-10 min-w-[136px] items-center justify-center gap-2 rounded-full bg-white/80 px-4 text-sm font-medium text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-inset ring-black/10 transition hover:bg-white hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  aria-label="Create collage"
                >
                  <LayoutTemplate className="h-4 w-4 shrink-0" />
                  <span>Collage</span>
                </Link>
              )}

              {!isShareView && (
                <Link
                  href={`/albums/${encodeURIComponent(albumSlug)}/events/new`}
                  className="flex h-10 min-w-[132px] items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-4 text-sm font-medium text-white shadow-[0_10px_28px_rgba(0,0,0,0.16)] transition hover:bg-black focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  aria-label="Manage events"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Events</span>
                </Link>
              )}

              {!selectedPerson && (
                <div
                  className="hidden shrink-0 items-center gap-1 rounded-full bg-zinc-950/[0.04] p-1 ring-1 ring-black/5 sm:flex"
                  role="tablist"
                >
                  <button
                    role="tab"
                    aria-selected={activeTab === "photos"}
                    onClick={() => {
                      setSelectedPerson(null);
                      setApsaraTextSearch(null);
                      setActiveTab("photos");
                      scrollToGalleryTop();
                    }}
                    className={`flex h-8 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium transition ${
                      activeTab === "photos"
                        ? "bg-white text-[#1d1d1f] shadow-sm"
                        : "text-zinc-500 hover:text-zinc-950"
                    }`}
                  >
                    <Images className="h-4 w-4" />
                    Photos
                  </button>

                  <button
                    role="tab"
                    aria-selected={activeTab === "people"}
                    onClick={() => {
                      setSelectedPerson(null);
                      setApsaraTextSearch(null);
                      setActiveTab("people");
                      scrollToGalleryTop();
                    }}
                    className={`flex h-8 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium transition ${
                      activeTab === "people"
                        ? "bg-white text-[#1d1d1f] shadow-sm"
                        : "text-zinc-500 hover:text-zinc-950"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    People
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/80 text-zinc-500 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-inset ring-black/10 transition hover:bg-white hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>

              {!isShareView && <AuthAvatarMenu />}
            </div>
          </div>

          {!selectedPerson && activeTab === "photos" && (
            <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => changeEvent(null)}
                className={`max-w-full shrink-0 cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                  !selectedEventSlug
                    ? "bg-[#1d1d1f] text-white"
                    : "bg-white/70 text-zinc-600 ring-1 ring-black/10 hover:bg-white hover:text-zinc-950"
                }`}
              >
                All
                <span className="ml-2 text-xs opacity-70">
                  {album.photoCount}
                </span>
              </button>

              {album.events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => changeEvent(event.slug)}
                  className={`max-w-[240px] shrink-0 cursor-pointer truncate rounded-full px-4 py-2 text-sm font-medium transition ${
                    selectedEventSlug === event.slug
                      ? "bg-[#1d1d1f] text-white"
                      : "bg-white/70 text-zinc-600 ring-1 ring-black/10 hover:bg-white hover:text-zinc-950"
                  }`}
                >
                  {event.name}
                  <span className="ml-2 text-xs opacity-70">
                    {event.photoCount}
                  </span>
                </button>
              ))}

              {!isShareView && (
                <Link
                  href={`/albums/${encodeURIComponent(albumSlug)}/events/new`}
                  className="flex max-w-full shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-zinc-600 ring-1 ring-black/10 transition hover:bg-white hover:text-zinc-950"
                >
                  <Plus className="h-4 w-4" />
                  Manage Events
                </Link>
              )}
            </div>
          )}

        </div>
      </header>

      <div className="mx-auto max-w-7xl px-2 py-6 sm:px-4 sm:py-8 lg:px-6">
        {selectedPerson ? (
          <PersonView
            albumSlug={albumSlug}
            shareToken={shareToken}
            selectedEventSlug={null}
            events={album.events}
            person={selectedPerson}
            onBack={() => {
              setSelectedPerson(null);
              setActiveTab("people");
              scrollToGalleryTop();
            }}
            shareSettings={shareSettings}
          />
        ) : activeTab === "people" ? (
          <section className="space-y-5 px-2 sm:px-0">
            <div>
              <p className="text-sm font-medium text-zinc-500">All people</p>
              <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                People
              </h2>
            </div>

            <PeopleGrid
              albumSlug={albumSlug}
              shareToken={shareToken}
              selectedEventSlug={null}
              events={album.events}
              onPersonClick={openPerson}
              onPeopleSelectionApply={filterByPeopleSelection}
              readOnly={isShareView}
            />
          </section>
        ) : apsaraTextSearch ? (
          <SearchResultsGrid
            albumSlug={albumSlug}
            shareToken={shareToken}
            events={album.events}
            query={apsaraTextSearch.query}
            photos={apsaraTextSearch.photos}
            isLoading={apsaraTextSearch.isLoading}
            error={apsaraTextSearch.error}
            onClear={() => setApsaraTextSearch(null)}
            onPersonClick={filterByPerson}
            shareSettings={shareSettings}
          />
        ) : (
          <section className="space-y-5">
            <div className="px-2 sm:px-0">
              {eventHeader}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                  Photos
                </h2>

                {downloadsEnabled && isPhotoSelectionMode && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-zinc-500">
                      {selectedDownloadPhotoIds.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedDownloadPhotoIds([])}
                      disabled={!selectedDownloadPhotoIds.length}
                      className="h-10 cursor-pointer rounded-full bg-white/80 px-4 text-sm font-medium text-zinc-600 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-inset ring-black/10 transition hover:bg-white hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Clear
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          disabled={!selectedDownloadPhotoIds.length}
                          className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-zinc-950 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Download Selected
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        {DOWNLOAD_FORMATS.map((item) => {
                          const params = new URLSearchParams({
                            photos: selectedDownloadPhotoIds.join(","),
                          });

                          if (item.format !== "original") {
                            params.set("format", item.format);
                          }
                          if (shareToken) {
                            params.set("share", shareToken);
                          }

                          return (
                            <DropdownMenuItem
                              key={item.format}
                              onSelect={() =>
                                triggerBrowserDownload(
                                  `/api/albums/${encodeURIComponent(
                                    albumSlug,
                                  )}/downloads?${params.toString()}`,
                                )
                              }
                            >
                              <Download className="h-4 w-4" />
                              {item.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {!isShareView && (
                      <ApplyPresetSelectionDialog
                        albumSlug={albumSlug}
                        photoIds={selectedDownloadPhotoIds}
                        onComplete={async () => {
                          await mutateStats();
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
              {isAiDataLoadingForEvent && (
                <div className="mt-4 rounded-2xl border border-[#d8ddff] bg-[#f3f5ff] px-4 py-3 text-sm text-zinc-700">
                  AI data is loading for this event. Photos are available now;
                  people and search details will appear after processing finishes.
                </div>
              )}
            </div>

            <PhotosGrid
              albumSlug={albumSlug}
              shareToken={shareToken}
              selectedEventSlug={selectedEventSlug}
              selectedPeopleIds={selectedPeopleIds}
              peopleMatchMode={peopleMatchMode}
              onPersonClick={filterByPerson}
              onReachedEnd={goToNextEvent}
              isSelectionMode={downloadsEnabled && isPhotoSelectionMode}
              selectedPhotoIds={selectedDownloadPhotoIds}
              onTogglePhoto={toggleSelectedDownloadPhotoId}
              events={album.events}
              shareSettings={shareSettings}
            />
          </section>
        )}
      </div>

      <ApsaraMomentsRoot
        albumSlug={albumSlug}
        shareToken={shareToken}
        downloadsEnabled={downloadsEnabled}
        selectedEventSlug={selectedEventSlug}
        selectedPeopleIds={selectedPeopleIds}
        peopleMatchMode={peopleMatchMode}
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onPersonOpen={openPerson}
        onPeopleSelectionApply={filterByPeopleSelection}
        onTextSearch={runApsaraTextSearch}
      />
    </main>
  );
}

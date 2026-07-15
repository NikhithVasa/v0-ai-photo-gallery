"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowLeft, Copy, Loader2, Lock, Share2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Switch } from "@/components/ui/switch";
import { PhotoCard, PhotoLightbox, type PhotoOpenRect } from "./photo-card";
import { RetryableAvatarImage } from "@/components/retryable-avatar-image";
import { Skeleton } from "@/components/ui/skeleton";
import { photoAspectRatio, photoFlexBasis } from "@/lib/photo-layout";
import {
  DEFAULT_SHARE_BACKGROUND_COLOR,
  SHARE_BACKGROUND_COLORS,
} from "@/lib/share-theme";
import type { AlbumEvent, AlbumShareSettings, Person, Photo } from "@/lib/types";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

const swrOptions = {
  dedupingInterval: 60 * 60 * 1000,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

interface PersonViewProps {
  albumSlug: string;
  shareToken?: string;
  selectedEventSlug: string | null;
  events: AlbumEvent[];
  person: Person;
  onBack: () => void;
  shareSettings?: AlbumShareSettings | null;
}

function todayIsoDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function PersonShareDialog({
  albumSlug,
  person,
  onlyPerson,
  shareToken = "",
}: {
  albumSlug: string;
  person: Person;
  onlyPerson: boolean;
  shareToken?: string;
}) {
  const isClientShare = Boolean(shareToken);
  const defaultPersonName = person.displayName || person.defaultName;
  const [isOpen, setIsOpen] = useState(false);
  const [personName, setPersonName] = useState(defaultPersonName);
  const [linkName, setLinkName] = useState(`${defaultPersonName}'s photos`);
  const [backgroundColor, setBackgroundColor] = useState(
    DEFAULT_SHARE_BACKGROUND_COLOR,
  );
  const [allowDownloads, setAllowDownloads] = useState(false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [allowEventTabs, setAllowEventTabs] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPersonName(defaultPersonName);
    setLinkName(`${defaultPersonName}'s photos`);
    setBackgroundColor(DEFAULT_SHARE_BACKGROUND_COLOR);
    setAllowDownloads(false);
    setWatermarkEnabled(false);
    setAllowEventTabs(true);
    setPasscode("");
    setExpiresAt("");
    setShareUrl("");
    setStatus("");
  }, [defaultPersonName, isOpen]);

  const createLink = async () => {
    if (!personName.trim() || !linkName.trim() || isSaving) return;
    const nextPasscode = passcode.trim();
    if (nextPasscode && nextPasscode.length < 4) {
      setStatus("Passcode must be at least 4 characters");
      return;
    }

    setIsSaving(true);
    setStatus("");

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/share/person${
          shareToken ? `?share=${encodeURIComponent(shareToken)}` : ""
        }`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personId: person.id,
            personName,
            linkName,
            onlyPerson,
            backgroundColor,
            allowDownloads,
            watermarkEnabled,
            allowEventTabs,
            passcode: nextPasscode || null,
            expiresAt: expiresAt || null,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        share?: { url?: string };
        error?: string;
      };

      if (!response.ok || !payload.share?.url) {
        throw new Error(payload.error || "Failed to create share link");
      }

      setShareUrl(payload.share.url);
      setStatus("Link created");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to create share link",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard?.writeText(shareUrl);
    setStatus("Copied");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="rounded-full">
          <Share2 className="h-4 w-4" />
          Share person
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share person photos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!isClientShare && <div className="space-y-1.5">
            <Label htmlFor="person-share-name">Person name</Label>
            <Input
              id="person-share-name"
              value={personName}
              onChange={(event) => setPersonName(event.target.value)}
              placeholder="Person name"
              maxLength={120}
            />
          </div>}

          <div className="space-y-1.5">
            <Label htmlFor="person-share-link-name">Shared link name</Label>
            <Input
              id="person-share-link-name"
              value={linkName}
              onChange={(event) => setLinkName(event.target.value)}
              placeholder="Gallery name shown to visitors"
              maxLength={120}
            />
          </div>

          <p className="text-xs leading-5 text-zinc-500">
            {onlyPerson
              ? "This link includes photos where this person appears alone."
              : "This link includes photos containing this person."}
          </p>

          {!isClientShare && <div className="space-y-3 rounded-[18px] border border-zinc-200/70 bg-zinc-50/70 p-3">
            <Label className="text-sm font-medium">Background</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
              {SHARE_BACKGROUND_COLORS.map((color) => {
                const isSelected = backgroundColor === color.value;

                return (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setBackgroundColor(color.value)}
                    aria-label={`${color.label} background`}
                    aria-pressed={isSelected}
                    className={`flex aspect-square min-h-8 cursor-pointer items-center justify-center rounded-full shadow-sm ring-offset-2 transition focus:outline-none focus:ring-2 focus:ring-zinc-950/20 ${
                      isSelected
                        ? "ring-2 ring-zinc-950"
                        : "ring-1 ring-black/10 hover:ring-zinc-400"
                    }`}
                    style={{ backgroundColor: color.value }}
                  >
                    {isSelected && (
                      <span className="h-2 w-2 rounded-full bg-zinc-950" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>}

          {!isClientShare && <div className="space-y-2">
            <div className="flex items-center justify-between gap-4 rounded-[18px] border border-zinc-200/70 bg-zinc-50/70 p-3">
              <Label htmlFor="person-share-downloads">Allow downloads</Label>
              <Switch
                id="person-share-downloads"
                checked={allowDownloads}
                onCheckedChange={setAllowDownloads}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-[18px] border border-zinc-200/70 bg-zinc-50/70 p-3">
              <Label htmlFor="person-share-watermark">Watermark</Label>
              <Switch
                id="person-share-watermark"
                checked={watermarkEnabled}
                onCheckedChange={setWatermarkEnabled}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-[18px] border border-zinc-200/70 bg-zinc-50/70 p-3">
              <Label htmlFor="person-share-event-tabs">Allow event tabs</Label>
              <Switch
                id="person-share-event-tabs"
                checked={allowEventTabs}
                onCheckedChange={setAllowEventTabs}
              />
            </div>
          </div>}

          {!isClientShare && <Accordion
            type="single"
            collapsible
            className="rounded-[18px] border border-zinc-200/70 bg-zinc-50/70 px-3"
          >
            <AccordionItem value="passcode" className="border-none">
              <AccordionTrigger className="py-3 hover:no-underline">
                <span className="flex min-w-0 items-center gap-2">
                  <Lock className="h-4 w-4 shrink-0 text-zinc-500" />
                  <span>Passcode</span>
                  <span className="truncate font-mono text-xs font-normal text-zinc-500">
                    {passcode || "No passcode set"}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                <Label htmlFor="person-share-passcode">Share link passcode</Label>
                <Input
                  id="person-share-passcode"
                  value={passcode}
                  onChange={(event) => {
                    setPasscode(event.target.value);
                    if (status) setStatus("");
                  }}
                  placeholder="Add a passcode"
                  maxLength={64}
                  autoComplete="off"
                  className="font-mono"
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>}

          {!isClientShare && <div className="space-y-1.5">
            <Label htmlFor="person-share-expires-at">Expires on</Label>
            <Input
              id="person-share-expires-at"
              type="date"
              min={todayIsoDate()}
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>}

          {shareUrl && (
            <div className="flex min-w-0 gap-2">
              <Input value={shareUrl} readOnly className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyLink}
                aria-label="Copy person share link"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}

          {status && <p className="text-sm text-zinc-500">{status}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={createLink}
            disabled={!personName.trim() || !linkName.trim() || isSaving}
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function personPhotosUrl(
  albumSlug: string,
  shareToken: string,
  personId: string,
  selectedEventSlug: string | null,
  onlyPerson: boolean,
) {
  const base = `/api/albums/${encodeURIComponent(
    albumSlug
  )}/people/${encodeURIComponent(personId)}/photos`;
  const params = new URLSearchParams();

  if (selectedEventSlug) params.set("event", selectedEventSlug);
  if (shareToken) params.set("share", shareToken);
  if (onlyPerson) params.set("peopleMode", "only");

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function PersonView({
  albumSlug,
  shareToken = "",
  selectedEventSlug,
  events,
  person,
  onBack,
  shareSettings,
}: PersonViewProps) {
  const [activeEventSlug, setActiveEventSlug] = useState<string | null>(
    selectedEventSlug
  );
  const [onlyPerson, setOnlyPerson] = useState(false);

  const { data, error, isLoading } = useSWR<{ photos: Photo[] }>(
    personPhotosUrl(albumSlug, shareToken, person.id, activeEventSlug, onlyPerson),
    fetcher,
    swrOptions
  );

  const [lightboxState, setLightboxState] = useState<{
    index: number;
    originRect?: PhotoOpenRect;
  } | null>(null);

  const handleOpen = useCallback((index: number, originRect: PhotoOpenRect) => {
    setLightboxState({ index, originRect });
  }, []);

  const handleNavigate = useCallback((index: number) => {
    setLightboxState({ index });
  }, []);

  const totalPhotoCount = person.photoCount ?? 0;

  const eventsWithStats = useMemo(() => {
    return events.map((event) => {
      const stat = person.eventStats?.find(
        (item) => item.eventSlug === event.slug
      );

      return {
        event,
        photoCount: stat?.photoCount ?? 0,
      };
    });
  }, [events, person.eventStats]);

  return (
    <div className="space-y-6 px-2 sm:px-0">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="cursor-pointer"
            aria-label="Back to people"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-border bg-muted">
              <div className="flex h-full w-full items-center justify-center bg-secondary">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              {person.coverFaceUrl ? (
                <RetryableAvatarImage
                  src={person.coverFaceUrl}
                  alt={person.displayName || person.defaultName}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {person.displayName || person.defaultName}
              </h2>
              <p className="text-sm text-muted-foreground">
                {totalPhotoCount}{" "}
                {totalPhotoCount === 1 ? "photo" : "photos"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyPerson((current) => !current)}
            aria-pressed={onlyPerson}
            className={`h-10 rounded-full px-4 text-sm font-medium ring-1 transition ${
              onlyPerson
                ? "bg-zinc-950 text-white ring-zinc-950"
                : "bg-white text-zinc-700 ring-zinc-200 hover:text-zinc-950"
            }`}
          >
            Only them
          </button>
          <PersonShareDialog
            albumSlug={albumSlug}
            person={person}
            onlyPerson={onlyPerson}
            shareToken={shareToken}
          />
          {data?.photos ? (
            <span className="text-sm text-muted-foreground">
              Showing {data.photos.length}{" "}
              {data.photos.length === 1 ? "photo" : "photos"}
            </span>
          ) : null}
        </div>

        {!!events.length && (
          <div className="flex max-w-full flex-wrap gap-2 pb-1">
            <button
              type="button"
              onClick={() => setActiveEventSlug(null)}
              className={`max-w-full cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                activeEventSlug === null
                  ? "bg-zinc-950 text-white ring-zinc-950"
                  : "bg-white text-zinc-700 ring-zinc-200 hover:text-zinc-950"
              }`}
            >
              All
              <span className="ml-2 opacity-70">{totalPhotoCount}</span>
            </button>

            {eventsWithStats.map(({ event, photoCount }) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setActiveEventSlug(event.slug)}
                disabled={photoCount === 0}
                className={`max-w-full whitespace-normal break-words rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                  activeEventSlug === event.slug
                    ? "cursor-pointer bg-zinc-950 text-white ring-zinc-950"
                    : photoCount > 0
                      ? "cursor-pointer bg-white text-zinc-700 ring-zinc-200 hover:text-zinc-950"
                      : "cursor-not-allowed bg-zinc-100 text-zinc-400 ring-zinc-200"
                }`}
                title={`${event.name}: ${photoCount} photos`}
              >
                {event.name}
                <span className="ml-2 opacity-70">{photoCount}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="py-12 text-center text-muted-foreground">
          Failed to load photos for this person.
        </div>
      )}

      {isLoading && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-56 min-w-[min(42vw,180px)] flex-1 rounded-md sm:h-72 lg:h-80"
              style={{
                flexBasis:
                  i % 5 === 0
                    ? "430px"
                    : i % 3 === 0
                      ? "240px"
                      : i % 2 === 0
                        ? "520px"
                        : "320px",
              }}
            />
          ))}
        </div>
      )}

      {data?.photos && (
        <>
          {data.photos.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {onlyPerson
                ? "No photos found with only this person."
                : "No photos found for this person."}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="min-w-[min(42vw,180px)] max-w-full"
                  style={{
                    flexBasis: photoFlexBasis(photo),
                    flexGrow: photoAspectRatio(photo),
                  }}
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

              <div className="h-0 flex-[999_1_20rem]" />
            </div>
          )}

          {lightboxState !== null && (
            <PhotoLightbox
              albumSlug={albumSlug}
              shareToken={shareToken}
              photos={data.photos}
              currentIndex={lightboxState.index}
              events={events}
              originRect={lightboxState.originRect}
              onClose={() => setLightboxState(null)}
              onNavigate={handleNavigate}
              shareSettings={shareSettings}
            />
          )}
        </>
      )}
    </div>
  );
}

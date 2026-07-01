"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ImageUp,
  Loader2,
  Maximize2,
  PlayCircle,
  Sparkles,
  Upload,
  User,
  VideoIcon,
} from "lucide-react";
import { AuthAvatarMenu } from "@/components/auth-avatar-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { Person } from "@/lib/types";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

interface AlbumEventSummary {
  id: string;
  slug: string;
  name: string;
}

interface VideoMatch {
  id: string;
  startSec: number | null;
  endSec: number | null;
  startTime: string | null;
  endTime: string | null;
  maxSimilarity: number | null;
  avgSimilarity: number | null;
  framesMatched: number | null;
  verified: boolean | null;
  personId: string | null;
  targetIndex: number | null;
  targetS3Key: string | null;
}

interface VideoTargetImage {
  key: string;
  index: number;
  personId: string | null;
  url: string | null;
}

interface AlbumVideo {
  id: string;
  albumId: string;
  eventId: string | null;
  eventSlug: string | null;
  eventName: string | null;
  fileName: string | null;
  originalS3Key: string | null;
  videoUrl: string | null;
  durationSec: number;
  detectionParams: Record<string, unknown>;
  targetPersonId: string | null;
  targetImages: VideoTargetImage[];
  detectionStatus: string;
  detectionError: string | null;
  matchCount: number;
  matches: VideoMatch[];
  runpodJobId: string | null;
  createdAt: string | null;
  completedAt: string | null;
}

interface VideosResponse {
  album: {
    id: string;
    slug: string;
    name: string;
  };
  events: AlbumEventSummary[];
  videos: AlbumVideo[];
}

interface PeopleResponse {
  people: Person[];
}

interface PreparedVideoUpload {
  video: {
    id: string;
    fileName: string;
    contentType: string;
    originalS3Key: string;
    eventSlug: string;
    eventName: string;
  };
  uploadUrl: string;
}

interface PreparedTargetUpload {
  s3Key: string;
  contentType: string;
  uploadUrl: string;
}

interface AlbumVideosPageProps {
  albumSlug: string;
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "--:--";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "processing") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
}

function personName(person: Person) {
  return person.displayName || person.defaultName || `Person ${person.personNumber}`;
}

function selectedPersonIdsFromVideo(video?: AlbumVideo | null) {
  const value = video?.detectionParams?.selected_person_ids;
  if (!Array.isArray(value)) return video?.targetPersonId ? [video.targetPersonId] : [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function targetPersonIdsFromVideo(video?: AlbumVideo | null) {
  const value = video?.detectionParams?.target_person_ids;
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" && item.length > 0 ? item : null));
  }
  return selectedPersonIdsFromVideo(video);
}

const targetColors = ["#f7d35f", "#78dcca", "#f29ab2", "#9db7ff", "#f5a85f", "#d5a8ff"];

export function AlbumVideosPage({ albumSlug }: AlbumVideosPageProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const timelineVideoRef = useRef<HTMLVideoElement>(null);
  const [selectedEventSlug, setSelectedEventSlug] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [aiVideo, setAiVideo] = useState<AlbumVideo | null>(null);
  const [timelineVideo, setTimelineVideo] = useState<AlbumVideo | null>(null);
  const [activeTimelineTargetIndex, setActiveTimelineTargetIndex] = useState<number | null>(null);
  const [pendingSeekSec, setPendingSeekSec] = useState<number | null>(null);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [selfieFiles, setSelfieFiles] = useState<File[]>([]);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isRunningAi, setIsRunningAi] = useState(false);

  const videosUrl = `/api/albums/${encodeURIComponent(albumSlug)}/videos`;
  const { data, error, isLoading, mutate } = useSWR<VideosResponse>(videosUrl, fetcher, {
    refreshInterval: (latest) =>
      latest?.videos.some((video) => video.detectionStatus === "processing") ? 5000 : 0,
  });
  const { data: peopleData } = useSWR<PeopleResponse>(
    `/api/albums/${encodeURIComponent(albumSlug)}/people`,
    fetcher,
  );

  const events = data?.events ?? [];
  const videos = data?.videos ?? [];
  const people = peopleData?.people ?? [];
  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);

  useEffect(() => {
    if (!selectedEventSlug && events[0]) {
      setSelectedEventSlug(events[0].slug);
    }
  }, [events, selectedEventSlug]);

  useEffect(() => {
    if (!selectedVideoId && videos[0]) {
      setSelectedVideoId(videos[0].id);
    }
  }, [selectedVideoId, videos]);

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) ?? videos[0] ?? null,
    [selectedVideoId, videos],
  );

  const selectedAiPeople = useMemo(() => {
    const ids = new Set(selectedPersonIds);
    return people.filter((person) => ids.has(person.id));
  }, [people, selectedPersonIds]);

  const allKnownPeopleSelected = people.length > 0 && selectedPersonIds.length === people.length;

  const selectedVideoPeople = useMemo(() => {
    const ids = new Set(selectedPersonIdsFromVideo(selectedVideo));
    return people.filter((person) => ids.has(person.id));
  }, [people, selectedVideo]);

  const timelineVideoPeople = useMemo(() => {
    const ids = new Set(selectedPersonIdsFromVideo(timelineVideo));
    return people.filter((person) => ids.has(person.id));
  }, [people, timelineVideo]);

  const timelineTargets = useMemo(() => {
    if (!timelineVideo) return [];
    const targetPersonIds = targetPersonIdsFromVideo(timelineVideo);

    return (timelineVideo.targetImages ?? []).map((target, index) => {
      const personId = target.personId ?? targetPersonIds[index] ?? null;
      const person = personId ? peopleById.get(personId) ?? null : null;
      return {
        index: target.index,
        key: target.key,
        personId,
        imageUrl: person?.coverFaceUrl || target.url,
        label: person ? personName(person) : `Uploaded target ${index + 1}`,
      };
    });
  }, [peopleById, timelineVideo]);

  const activeTimelineTarget = useMemo(
    () => timelineTargets.find((target) => target.index === activeTimelineTargetIndex) ?? null,
    [activeTimelineTargetIndex, timelineTargets],
  );

  const visibleTimelineMatches = useMemo(() => {
    if (!timelineVideo) return [] as VideoMatch[];
    if (!activeTimelineTarget) return timelineVideo.matches;

    const filtered = timelineVideo.matches.filter((match) => (
      match.targetIndex === activeTimelineTarget.index ||
      match.targetS3Key === activeTimelineTarget.key ||
      (Boolean(activeTimelineTarget.personId) && match.personId === activeTimelineTarget.personId)
    ));

    return filtered.length ? filtered : timelineVideo.matches;
  }, [activeTimelineTarget, timelineVideo]);

  useEffect(() => {
    setActiveTimelineTargetIndex(null);
  }, [timelineVideo?.id]);

  useEffect(() => {
    if (!timelineVideo || pendingSeekSec === null) return;
    const timer = window.setTimeout(() => {
      void seekAndPlay(pendingSeekSec);
      setPendingSeekSec(null);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [pendingSeekSec, timelineVideo]);

  function togglePersonSelection(personId: string) {
    setSelectedPersonIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId],
    );
  }

  function selectAllKnownPeople() {
    setSelectedPersonIds(people.map((person) => person.id));
  }

  async function seekAndPlay(seconds?: number | null) {
    const video = timelineVideoRef.current;
    if (!video || seconds === null || seconds === undefined) return;
    video.currentTime = Math.max(0, seconds);
    try {
      await video.play();
    } catch {
      // Browser autoplay policies can block programmatic play until user interaction.
    }
  }

  function openTimelineAt(video: AlbumVideo, seconds?: number | null) {
    setTimelineVideo(video);
    if (seconds !== null && seconds !== undefined) {
      setPendingSeekSec(seconds);
    }
  }

  function targetForMatch(match: VideoMatch) {
    return timelineTargets.find((target) => (
      match.targetIndex === target.index ||
      match.targetS3Key === target.key ||
      (Boolean(target.personId) && match.personId === target.personId)
    )) ?? null;
  }

  async function uploadVideo(file: File) {
    if (!selectedEventSlug) {
      toast({ title: "Choose an event", description: "Videos are stored inside an album event." });
      return;
    }

    setIsUploadingVideo(true);
    try {
      const prepareResponse = await fetch(videosUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug: selectedEventSlug,
          fileName: file.name,
          size: file.size,
          contentType: file.type || "video/mp4",
        }),
      });
      const prepared = (await prepareResponse.json()) as PreparedVideoUpload & { error?: string };
      if (!prepareResponse.ok) throw new Error(prepared.error || "Could not prepare upload");

      const uploadResponse = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": prepared.video.contentType },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("S3 upload failed");

      toast({ title: "Video uploaded", description: prepared.video.fileName });
      setSelectedVideoId(prepared.video.id);
      await mutate();
    } catch (uploadError) {
      toast({
        title: "Upload failed",
        description: uploadError instanceof Error ? uploadError.message : "Could not upload video",
        variant: "destructive",
      });
    } finally {
      setIsUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

  async function uploadSelfieTarget(video: AlbumVideo, file: File) {
    const prepareResponse = await fetch(
      `/api/albums/${encodeURIComponent(albumSlug)}/video-targets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug: video.eventSlug,
          fileName: file.name,
          size: file.size,
          contentType: file.type || "image/jpeg",
        }),
      },
    );
    const prepared = (await prepareResponse.json()) as PreparedTargetUpload & { error?: string };
    if (!prepareResponse.ok) throw new Error(prepared.error || "Could not prepare selfie upload");

    const uploadResponse = await fetch(prepared.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": prepared.contentType },
      body: file,
    });
    if (!uploadResponse.ok) throw new Error("Selfie upload failed");

    return prepared.s3Key;
  }

  async function uploadSelfieTargets(video: AlbumVideo) {
    if (!selfieFiles.length) return [] as string[];
    return Promise.all(selfieFiles.map((file) => uploadSelfieTarget(video, file)));
  }

  async function runAi() {
    if (!aiVideo) return;
    if (!selectedPersonIds.length && !selfieFiles.length) {
      toast({
        title: "Choose a target",
        description: "Select one or more people from the album or upload one or more selfies.",
        variant: "destructive",
      });
      return;
    }

    setIsRunningAi(true);
    try {
      const selfieS3Keys = await uploadSelfieTargets(aiVideo);
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/videos/${encodeURIComponent(aiVideo.id)}/ai`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personIds: selectedPersonIds,
            selfieS3Keys,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not start video AI");

      toast({ title: "Video AI started", description: "The timeline will update when the worker finishes." });
      setAiVideo(null);
  setSelfieFiles([]);
      setSelectedPersonIds([]);
      if (selfieInputRef.current) selfieInputRef.current.value = "";
      await mutate();
    } catch (runError) {
      toast({
        title: "AI failed to start",
        description: runError instanceof Error ? runError.message : "Could not start video AI",
        variant: "destructive",
      });
    } finally {
      setIsRunningAi(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f2ea] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="rounded-full">
              <Link href={`/albums/${encodeURIComponent(albumSlug)}`} aria-label="Back to album">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Album videos</p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {data?.album.name || "Videos"}
              </h1>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="video-event" className="text-xs text-zinc-600">Event</Label>
              <select
                id="video-event"
                value={selectedEventSlug}
                onChange={(event) => setSelectedEventSlug(event.target.value)}
                className="h-10 min-w-[180px] rounded-full border border-black/10 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-950/20"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.slug}>{event.name}</option>
                ))}
              </select>
            </div>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadVideo(file);
              }}
            />
            <Button
              type="button"
              className="h-10 rounded-full bg-zinc-950 px-4 text-white hover:bg-zinc-800"
              disabled={isUploadingVideo || !events.length}
              onClick={() => videoInputRef.current?.click()}
            >
              {isUploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload Video
            </Button>
            <AuthAvatarMenu />
          </div>
        </header>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4" />
            {error.message}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {isLoading && !videos.length ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-64 animate-pulse rounded-2xl bg-white/70" />
              ))
            ) : videos.length ? (
              videos.map((video) => (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => setSelectedVideoId(video.id)}
                  className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    selectedVideo?.id === video.id ? "border-zinc-950" : "border-black/10"
                  }`}
                >
                  <div className="relative aspect-video bg-zinc-900">
                    {video.videoUrl ? (
                      <video
                        src={video.videoUrl}
                        preload="metadata"
                        muted
                        playsInline
                        className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-400">
                        <VideoIcon className="h-12 w-12" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 to-transparent p-3 text-white">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <PlayCircle className="h-4 w-4" />
                        {formatDuration(video.durationSec)}
                      </span>
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold capitalize ${statusTone(video.detectionStatus)}`}>
                        {video.detectionStatus}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="absolute right-3 top-3 rounded-full bg-white text-zinc-950 shadow hover:bg-zinc-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        setAiVideo(video);
                        setSelectedPersonIds(selectedPersonIdsFromVideo(video));
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Run AI
                    </Button>
                  </div>
                  <div className="grid gap-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{video.fileName || "Untitled video"}</p>
                        <p className="text-xs text-zinc-500">{video.eventName || video.eventSlug || "No event"}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                        {video.matchCount} matches
                      </span>
                    </div>
                    {video.detectionError && (
                      <p className="line-clamp-2 text-xs text-rose-600">{video.detectionError}</p>
                    )}
                    <p className="text-xs text-zinc-500">Added {formatDate(video.createdAt)}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="col-span-full flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-black/15 bg-white/60 p-8 text-center">
                <VideoIcon className="h-12 w-12 text-zinc-400" />
                <h2 className="mt-4 text-lg font-semibold">No videos yet</h2>
                <p className="mt-1 max-w-md text-sm text-zinc-500">
                  Upload a video into an album event, then run face occurrence AI to create a timeline.
                </p>
              </div>
            )}
          </div>

          <aside className="sticky top-4 grid max-h-[calc(100vh-2rem)] content-start gap-4 overflow-auto rounded-2xl border border-black/10 bg-white/75 p-4 shadow-sm backdrop-blur">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Timeline</p>
              <h2 className="mt-1 text-xl font-semibold">{selectedVideo?.fileName || "Select a video"}</h2>
            </div>

            {selectedVideo ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-zinc-100 p-3">
                    <Clock3 className="mx-auto mb-1 h-4 w-4 text-zinc-500" />
                    {formatDuration(selectedVideo.durationSec)}
                  </div>
                  <div className="rounded-xl bg-zinc-100 p-3">
                    <CheckCircle2 className="mx-auto mb-1 h-4 w-4 text-zinc-500" />
                    {selectedVideo.matchCount} matches
                  </div>
                  <div className="rounded-xl bg-zinc-100 p-3 capitalize">
                    <Sparkles className="mx-auto mb-1 h-4 w-4 text-zinc-500" />
                    {selectedVideo.detectionStatus}
                  </div>
                </div>

                <Button
                  type="button"
                  className="h-11 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800"
                  onClick={() => openTimelineAt(selectedVideo)}
                  disabled={!selectedVideo.videoUrl}
                >
                  <Maximize2 className="h-4 w-4" />
                  Open timeline player
                </Button>

                {selectedVideoPeople.length > 0 && (
                  <div className="flex flex-wrap gap-2 rounded-xl bg-zinc-100 p-2">
                    {selectedVideoPeople.map((person) => (
                      <span key={person.id} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm">
                        {person.coverFaceUrl ? (
                          <img src={person.coverFaceUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                        ) : null}
                        {personName(person)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="relative h-5 overflow-hidden rounded-full bg-zinc-100">
                  {selectedVideo.matches.map((match) => {
                    const duration = Math.max(selectedVideo.durationSec, 1);
                    const start = Math.max(0, Number(match.startSec ?? 0));
                    const end = Math.max(start + 0.5, Number(match.endSec ?? start + 0.5));
                    return (
                      <div
                        key={match.id}
                        className="absolute top-0 h-full rounded-full bg-zinc-950"
                        style={{
                          left: `${Math.min(100, (start / duration) * 100)}%`,
                          width: `${Math.max(1, Math.min(100, ((end - start) / duration) * 100))}%`,
                        }}
                      />
                    );
                  })}
                </div>

                <div className="grid gap-2">
                  {selectedVideo.matches.length ? (
                    selectedVideo.matches.map((match, index) => (
                      <button
                        key={match.id}
                        type="button"
                        onClick={() => openTimelineAt(selectedVideo, match.startSec)}
                        className="rounded-xl border border-black/10 bg-white p-3 text-left transition hover:border-zinc-950/30"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold">Match {index + 1}</span>
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                            {match.startTime || formatDuration(match.startSec)} - {match.endTime || formatDuration(match.endSec)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600">
                          <span>{match.framesMatched ?? 0} frames</span>
                          <span>max {Number(match.maxSimilarity ?? 0).toFixed(3)}</span>
                          <span>avg {Number(match.avgSimilarity ?? 0).toFixed(3)}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-black/15 p-4 text-sm text-zinc-500">
                      {selectedVideo.detectionStatus === "processing"
                        ? "AI is processing this video. The timeline will refresh automatically."
                        : "No timeline matches yet. Run AI from the video thumbnail."}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </aside>
        </section>
      </div>

      <Dialog open={Boolean(aiVideo)} onOpenChange={(open) => !open && setAiVideo(null)}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Run video face AI</DialogTitle>
            <DialogDescription>
              Choose one or more album people, upload a selfie, or use both as target images for this video.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Album people</Label>
                <span className="text-xs font-medium text-zinc-500">
                  {selectedPersonIds.length} selected
                </span>
              </div>
              {people.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={allKnownPeopleSelected ? "default" : "outline"}
                    size="sm"
                    className="h-9 rounded-full px-3 text-xs"
                    onClick={selectAllKnownPeople}
                  >
                    All known people
                  </Button>
                  {selectedPersonIds.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-full px-3 text-xs"
                      onClick={() => setSelectedPersonIds([])}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              )}
              <div className="grid max-h-72 gap-2 overflow-auto rounded-xl border border-black/10 p-2 sm:grid-cols-2">
                {people.length ? people.map((person) => {
                  const active = selectedPersonIds.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => togglePersonSelection(person.id)}
                      className={`flex items-center gap-3 rounded-xl border p-2 text-left transition ${
                        active ? "border-zinc-950 bg-zinc-950 text-white" : "border-transparent hover:bg-zinc-100"
                      }`}
                    >
                      {person.coverFaceUrl ? (
                        <img
                          src={person.coverFaceUrl}
                          alt={personName(person)}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-zinc-500">
                          <User className="h-5 w-5" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{personName(person)}</span>
                        <span className={`block text-xs ${active ? "text-white/70" : "text-zinc-500"}`}>
                          {person.photoCount} photos
                        </span>
                      </span>
                    </button>
                  );
                }) : (
                  <p className="p-3 text-sm text-zinc-500">No indexed people yet. Upload a selfie instead.</p>
                )}
              </div>
              {selectedAiPeople.length > 1 && (
                <div className="flex flex-wrap gap-2 rounded-xl bg-zinc-100 p-2">
                  {selectedAiPeople.map((person) => (
                    <span key={person.id} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm">
                      {personName(person)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2 rounded-xl border border-black/10 p-4">
              <Label htmlFor="selfie-upload">Selfie target</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  ref={selfieInputRef}
                  id="selfie-upload"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/*"
                  onChange={(event) => setSelfieFiles(Array.from(event.target.files ?? []))}
                />
                <div className="flex min-w-0 items-center gap-2 text-sm text-zinc-500">
                  <ImageUp className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {selfieFiles.length
                      ? `${selfieFiles.length} target image${selfieFiles.length === 1 ? "" : "s"} selected`
                      : "Optional additional target images"}
                  </span>
                </div>
              </div>
              {selfieFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selfieFiles.map((file) => (
                    <button
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      type="button"
                      onClick={() => setSelfieFiles((current) => current.filter((item) => item !== file))}
                      className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200"
                    >
                      {file.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAiVideo(null)} disabled={isRunningAi}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void runAi()} disabled={isRunningAi}>
              {isRunningAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Start AI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(timelineVideo)} onOpenChange={(open) => !open && setTimelineVideo(null)}>
        <DialogContent className="grid h-[calc(100vh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden border-black/10 bg-[#111111] p-4 text-white sm:max-w-none">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-xl text-white">{timelineVideo?.fileName || "Video timeline"}</DialogTitle>
            <DialogDescription className="text-zinc-300">
              Click an interval to jump to that moment and play the video.
            </DialogDescription>
          </DialogHeader>

          {timelineVideo ? (
            <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3">
                <div className="min-h-0 overflow-hidden rounded-2xl bg-black">
                  {timelineVideo.videoUrl ? (
                    <video
                      ref={timelineVideoRef}
                      src={timelineVideo.videoUrl}
                      controls
                      playsInline
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-500">
                      <VideoIcon className="h-16 w-16" />
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  {timelineTargets.length > 0 && (
                    <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTimelineTargetIndex(null)}
                        className={`flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border text-xs font-bold transition sm:h-12 sm:min-w-12 ${
                          activeTimelineTargetIndex === null
                            ? "border-[#f7d35f] bg-[#f7d35f] text-black"
                            : "border-white/15 bg-white/10 text-white hover:bg-white/15"
                        }`}
                        aria-label="Show all targets"
                      >
                        All
                      </button>
                      {timelineTargets.map((target) => {
                        const active = activeTimelineTargetIndex === target.index;
                        return (
                          <button
                            key={`${target.key}-${target.index}`}
                            type="button"
                            onClick={() => setActiveTimelineTargetIndex(active ? null : target.index)}
                            className={`group relative flex h-14 w-14 shrink-0 cursor-pointer flex-col items-center justify-center rounded-full border-2 transition sm:h-16 sm:w-16 ${
                              active ? "border-[#f7d35f]" : "border-white/20 hover:border-white/60"
                            }`}
                            title={target.label}
                            aria-label={`Filter timeline to ${target.label}`}
                          >
                            {target.imageUrl ? (
                              <img src={target.imageUrl} alt="" className="h-full w-full rounded-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-white">
                                <User className="h-4 w-4" />
                              </span>
                            )}
                            <span
                              className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
                              style={{ backgroundColor: targetColors[target.index % targetColors.length] }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mb-3 flex items-center justify-between text-xs text-zinc-300">
                    <span>0:00</span>
                    <span>{formatDuration(timelineVideo.durationSec)}</span>
                  </div>
                  <div className="relative h-20 overflow-hidden rounded-2xl bg-white/10 sm:h-16">
                    {visibleTimelineMatches.map((match, index) => {
                      const duration = Math.max(timelineVideo.durationSec, 1);
                      const start = Math.max(0, Number(match.startSec ?? 0));
                      const end = Math.max(start + 0.5, Number(match.endSec ?? start + 0.5));
                      const target = targetForMatch(match) ?? activeTimelineTarget;
                      const targetIndex = target?.index ?? match.targetIndex ?? 0;
                      const color = targetColors[targetIndex % targetColors.length];
                      const label = target?.label;
                      return (
                        <div
                          key={match.id}
                          className="absolute top-2"
                          style={{
                            left: `${Math.min(100, (start / duration) * 100)}%`,
                            width: `${Math.max(1, Math.min(100, ((end - start) / duration) * 100))}%`,
                          }}
                        >
                          {label ? (
                            <div className="mb-1 max-w-[9rem] truncate rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm sm:max-w-[12rem]">
                              {label}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            aria-label={`Play match ${index + 1}${label ? ` for ${label}` : ""}`}
                            className="h-8 w-full rounded-full shadow-[0_0_24px_rgba(247,211,95,0.25)] transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-white"
                            style={{ backgroundColor: color }}
                            onClick={() => void seekAndPlay(match.startSec)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <aside className="min-h-0 overflow-auto rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs text-zinc-200">
                  <div className="rounded-xl bg-white/10 p-3">{formatDuration(timelineVideo.durationSec)}</div>
                  <div className="rounded-xl bg-white/10 p-3">{visibleTimelineMatches.length} matches</div>
                  <div className="rounded-xl bg-white/10 p-3 capitalize">{timelineVideo.detectionStatus}</div>
                </div>

                {timelineVideoPeople.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2 rounded-xl bg-white/10 p-2">
                    {timelineVideoPeople.map((person) => (
                      <span key={person.id} className="inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 text-xs font-semibold text-white">
                        {person.coverFaceUrl ? (
                          <img src={person.coverFaceUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                        ) : null}
                        {personName(person)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid gap-2">
                  {visibleTimelineMatches.length ? visibleTimelineMatches.map((match, index) => (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => void seekAndPlay(match.startSec)}
                      className="rounded-xl border border-white/10 bg-black/25 p-3 text-left transition hover:border-[#f7d35f]/60 hover:bg-black/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: targetColors[(match.targetIndex ?? 0) % targetColors.length] }}
                          />
                          Match {index + 1}
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-zinc-200">
                          {match.startTime || formatDuration(match.startSec)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-400">
                        {match.startTime || formatDuration(match.startSec)} - {match.endTime || formatDuration(match.endSec)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-300">
                        <span>{match.framesMatched ?? 0} frames</span>
                        <span>max {Number(match.maxSimilarity ?? 0).toFixed(3)}</span>
                        <span>avg {Number(match.avgSimilarity ?? 0).toFixed(3)}</span>
                      </div>
                    </button>
                  )) : (
                    <div className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-zinc-400">
                      No AI intervals are available for this video yet.
                    </div>
                  )}
                </div>
              </aside>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

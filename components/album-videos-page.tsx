"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  ArrowLeft,
  ImageUp,
  Loader2,
  PlayCircle,
  Share2,
  Sparkles,
  Upload,
  User,
  X,
  VideoIcon,
} from "lucide-react";
import { AdaptiveVideoPlayer } from "@/components/adaptive-video-player";
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
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import type { Person } from "@/lib/types";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

const VIDEO_UPLOAD_CONCURRENCY = 4;
const FALLBACK_VIDEO_PART_SIZE_BYTES = 10 * 1024 * 1024;

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

interface DiscoveredVideoPerson {
  index: number;
  label: string;
  known: boolean;
  framesMatched: number | null;
  thumbnailS3Key: string | null;
  imageUrl: string | null;
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
  hlsUrl?: string | null;
  durationSec: number;
  detectionParams: Record<string, unknown>;
  targetPersonId: string | null;
  targetImages: VideoTargetImage[];
  discoveredPeople: DiscoveredVideoPerson[];
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
  error?: string;
  video: {
    id: string;
    fileName: string;
    contentType: string;
    originalS3Key: string;
    eventSlug: string;
    eventName: string;
  };
  multipart?: boolean;
  uploadUrl?: string;
  uploadId?: string;
  key?: string;
  partSize?: number;
}

function uploadToUrl(
  url: string,
  file: File,
  contentType: string,
  onProgress: (progress: number) => void,
) {
  return new Promise<boolean>((resolve) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () => resolve(request.status >= 200 && request.status < 300);
    request.onerror = () => resolve(false);
    request.onabort = () => resolve(false);
    request.send(file);
  });
}

interface MultipartUploadPart {
  ETag: string;
  PartNumber: number;
}

async function runWithConcurrency(
  total: number,
  concurrency: number,
  worker: (index: number) => Promise<void>,
) {
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.max(1, Math.min(concurrency, total)) },
    async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= total) return;
        await worker(index);
      }
    },
  );

  await Promise.all(runners);
}

async function postMultipartAction<T>(
  albumSlug: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(
    `/api/albums/${encodeURIComponent(albumSlug)}/videos/multipart`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Multipart upload failed");
  return data as T;
}

function uploadPartToUrl(
  url: string,
  blob: Blob,
  onProgress: (loadedBytes: number) => void,
) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(event.loaded);
    };
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`S3 part upload failed (${request.status})`));
        return;
      }

      const eTag = request.getResponseHeader("ETag");
      if (!eTag) {
        reject(new Error("S3 did not expose the ETag header. Check bucket CORS."));
        return;
      }

      onProgress(blob.size);
      resolve(eTag);
    };
    request.onerror = () => reject(new Error("S3 part upload failed"));
    request.onabort = () => reject(new Error("S3 part upload was cancelled"));
    request.send(blob);
  });
}

async function uploadMultipartVideo({
  albumSlug,
  file,
  prepared,
  onProgress,
}: {
  albumSlug: string;
  file: File;
  prepared: PreparedVideoUpload;
  onProgress: (progress: number) => void;
}) {
  const uploadId = prepared.uploadId;
  const key = prepared.key || prepared.video.originalS3Key;
  if (!uploadId || !key) throw new Error("Multipart upload was not prepared");

  const partSize = Math.max(
    5 * 1024 * 1024,
    prepared.partSize || FALLBACK_VIDEO_PART_SIZE_BYTES,
  );
  const partCount = Math.ceil(file.size / partSize);
  const loadedBytesByPart = Array.from({ length: partCount }, () => 0);
  const parts: MultipartUploadPart[] = [];

  await runWithConcurrency(partCount, VIDEO_UPLOAD_CONCURRENCY, async (index) => {
    const partNumber = index + 1;
    const start = index * partSize;
    const end = Math.min(file.size, start + partSize);
    const { url } = await postMultipartAction<{ url: string }>(albumSlug, {
      action: "sign-part",
      videoId: prepared.video.id,
      key,
      uploadId,
      partNumber,
    });

    const eTag = await uploadPartToUrl(url, file.slice(start, end), (loadedBytes) => {
      loadedBytesByPart[index] = loadedBytes;
      const uploadedBytes = loadedBytesByPart.reduce((total, value) => total + value, 0);
      onProgress(Math.min(99, Math.round((uploadedBytes / file.size) * 100)));
    });
    parts[index] = { ETag: eTag, PartNumber: partNumber };
  });

  await postMultipartAction<{ ok: true }>(albumSlug, {
    action: "complete",
    videoId: prepared.video.id,
    key,
    uploadId,
    parts,
  });
  onProgress(100);
}

interface PreparedTargetUpload {
  s3Key: string;
  contentType: string;
  uploadUrl: string;
}

interface AlbumVideosPageProps {
  albumSlug: string;
  timelineVideoId?: string;
}

interface TimelineTarget {
  id: string;
  index: number;
  key: string;
  personId: string | null;
  imageUrl: string | null;
  label: string;
  known: boolean;
  originalOrder: number;
  occurrenceCount: number;
}

interface TimelineTargetLookup {
  byIndex: Map<number, TimelineTarget>;
  byKey: Map<string, TimelineTarget>;
  byPersonId: Map<string, TimelineTarget>;
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
  if (status === "processing") return "border-zinc-200 bg-zinc-100 text-zinc-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
}

function videoStatusLabel(status: string) {
  if (status === "pending") return "Uploaded";
  return status;
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

function findTimelineTarget(match: VideoMatch, lookup: TimelineTargetLookup) {
  if (match.targetIndex !== null) {
    const target = lookup.byIndex.get(match.targetIndex);
    if (target) return target;
  }

  if (match.targetS3Key) {
    const target = lookup.byKey.get(match.targetS3Key);
    if (target) return target;
  }

  if (match.personId) {
    const target = lookup.byPersonId.get(match.personId);
    if (target) return target;
  }

  return null;
}

const targetColors = ["#8e8e93", "#aeaeb2", "#6e6e73", "#c7c7cc", "#98989d", "#d1d1d6"];

export function AlbumVideosPage({ albumSlug, timelineVideoId }: AlbumVideosPageProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const timelineVideoRef = useRef<HTMLVideoElement>(null);
  const isTimelineRoute = Boolean(timelineVideoId);
  const [selectedEventSlug, setSelectedEventSlug] = useState("");
  const [aiVideo, setAiVideo] = useState<AlbumVideo | null>(null);
  const [timelineVideo, setTimelineVideo] = useState<AlbumVideo | null>(null);
  const [activeTimelineTargetId, setActiveTimelineTargetId] = useState<string | null>(null);
  const [previewFace, setPreviewFace] = useState<{ imageUrl: string; label: string } | null>(null);
  const [isTimelinePanelOpen, setIsTimelinePanelOpen] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [selfieFiles, setSelfieFiles] = useState<File[]>([]);
  const [discoverPeople, setDiscoverPeople] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const [isRunningAi, setIsRunningAi] = useState(false);

  const videosUrl = `/api/albums/${encodeURIComponent(albumSlug)}/videos`;
  const { data, error, isLoading, mutate } = useSWR<VideosResponse>(videosUrl, fetcher, {
    refreshInterval: (latest) =>
      latest?.videos.some((video) => video.detectionStatus === "processing") ? 5000 : 0,
  });
  const { data: peopleData } = useSWR<PeopleResponse>(`/api/albums/${encodeURIComponent(albumSlug)}/people`, fetcher);

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
    if (!timelineVideoId || !videos.length) return;
    const video = videos.find((item) => item.id === timelineVideoId) ?? null;
    setTimelineVideo(video);
    setIsTimelinePanelOpen(false);
  }, [timelineVideoId, videos]);

  useEffect(() => {
    if (isTimelineRoute || !videos.length || typeof window === "undefined") return;
    const legacyTimelineVideoId = new URLSearchParams(window.location.search).get("timeline");
    if (!legacyTimelineVideoId) return;

    const video = videos.find((item) => item.id === legacyTimelineVideoId);
    if (!video) return;

    window.location.replace(`/albums/${encodeURIComponent(albumSlug)}/videos/${encodeURIComponent(video.id)}`);
  }, [albumSlug, isTimelineRoute, videos]);

  const selectedAiPeople = useMemo(() => {
    const ids = new Set(selectedPersonIds);
    return people.filter((person) => ids.has(person.id));
  }, [people, selectedPersonIds]);
  const hasAiTargets = selectedPersonIds.length > 0 || selfieFiles.length > 0;
  const willDiscoverPeople = discoverPeople || !hasAiTargets;

  const allKnownPeopleSelected = people.length > 0 && selectedPersonIds.length === people.length;

  const timelineVideoPeople = useMemo(() => {
    const ids = new Set(selectedPersonIdsFromVideo(timelineVideo));
    return people.filter((person) => ids.has(person.id));
  }, [people, timelineVideo]);

  const timelineTargetBase = useMemo(() => {
    if (!timelineVideo) return [];
    const targetPersonIds = targetPersonIdsFromVideo(timelineVideo);

    const knownTargets = (timelineVideo.targetImages ?? []).map<TimelineTarget>((target, index) => {
      const personId = target.personId ?? targetPersonIds[index] ?? null;
      const person = personId ? peopleById.get(personId) ?? null : null;
      return {
        id: `known-${target.index}-${target.key}`,
        index: target.index,
        key: target.key,
        personId,
        imageUrl: person?.coverFaceUrl || target.url,
        label: person ? personName(person) : `Uploaded target ${index + 1}`,
        known: true,
        originalOrder: index,
        occurrenceCount: 0,
      };
    });
    const knownTargetIndexes = new Set(knownTargets.map((target) => target.index));

    const unknownTargets = (timelineVideo.discoveredPeople ?? [])
      .filter((person) => !knownTargetIndexes.has(person.index))
      .map<TimelineTarget>((person, index) => ({
        id: `unknown-${person.index}`,
        index: person.index,
        key: `unknown-${person.index}`,
        personId: null,
        imageUrl: person.imageUrl,
        label: person.label,
        known: person.known,
        originalOrder: knownTargets.length + index,
        occurrenceCount: 0,
      }));

    return [...knownTargets, ...unknownTargets];
  }, [peopleById, timelineVideo]);

  const timelineTargetLookup = useMemo<TimelineTargetLookup>(() => {
    const lookup: TimelineTargetLookup = {
      byIndex: new Map(),
      byKey: new Map(),
      byPersonId: new Map(),
    };

    for (const target of timelineTargetBase) {
      lookup.byIndex.set(target.index, target);
      lookup.byKey.set(target.key, target);
      if (target.personId) lookup.byPersonId.set(target.personId, target);
    }

    return lookup;
  }, [timelineTargetBase]);

  const timelineTargets = useMemo(() => {
    if (!timelineVideo) return [];
    const occurrenceCounts = new Map<string, number>();

    for (const match of timelineVideo.matches) {
      const target = findTimelineTarget(match, timelineTargetLookup);
      if (target) occurrenceCounts.set(target.id, (occurrenceCounts.get(target.id) ?? 0) + 1);
    }

    return timelineTargetBase
      .map((target) => ({
        ...target,
        occurrenceCount: occurrenceCounts.get(target.id) ?? 0,
      }))
      .filter((target) => target.occurrenceCount > 0)
      .sort((left, right) => {
        if (right.occurrenceCount !== left.occurrenceCount) {
          return right.occurrenceCount - left.occurrenceCount;
        }
        return left.originalOrder - right.originalOrder;
      });
  }, [timelineTargetBase, timelineTargetLookup, timelineVideo]);

  const activeTimelineTarget = useMemo(
    () => timelineTargets.find((target) => target.id === activeTimelineTargetId) ?? null,
    [activeTimelineTargetId, timelineTargets],
  );

  const visibleTimelineMatches = useMemo(() => {
    if (!timelineVideo) return [] as VideoMatch[];
    if (!activeTimelineTarget) return timelineVideo.matches;

    return timelineVideo.matches.filter((match) => findTimelineTarget(match, timelineTargetLookup)?.id === activeTimelineTarget.id);
  }, [activeTimelineTarget, timelineTargetLookup, timelineVideo]);

  const timelineMatchesHaveTargetData = useMemo(
    () => Boolean(timelineVideo?.matches.some((match) => (
      match.targetIndex !== null ||
      Boolean(match.targetS3Key) ||
      Boolean(match.personId)
    ))),
    [timelineVideo],
  );

  const emptyTimelineMessage = activeTimelineTarget
    ? timelineMatchesHaveTargetData
      ? `No intervals found for ${activeTimelineTarget.label}.`
      : "This run does not have per-face timeline data yet. Re-run AI to filter by a specific person."
    : "No AI intervals are available for this video yet.";

  useEffect(() => {
    setActiveTimelineTargetId(null);
  }, [timelineVideo?.id]);

  useEffect(() => {
    if (!isUploadingVideo) return;

    const warning = "Do not close this browser window. If you close it, the video upload will fail and you will have to start it again.";
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = warning;
      return warning;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isUploadingVideo]);

  function togglePersonSelection(personId: string) {
    setSelectedPersonIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId],
    );
  }

  function selectAllKnownPeople() {
    setSelectedPersonIds(people.map((person) => person.id));
    setDiscoverPeople(false);
  }

  function selectAllKnownAndUnknownPeople() {
    setSelectedPersonIds(people.map((person) => person.id));
    setDiscoverPeople(true);
  }

  function openAiDialog(video: AlbumVideo) {
    setAiVideo(video);
    setSelectedPersonIds([]);
    setSelfieFiles([]);
    setDiscoverPeople(false);
    if (selfieInputRef.current) selfieInputRef.current.value = "";
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

  function timelineHref(videoId: string) {
    return `/albums/${encodeURIComponent(albumSlug)}/videos/${encodeURIComponent(videoId)}`;
  }

  function timelineShareUrl(video: AlbumVideo) {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.pathname = timelineHref(video.id);
    url.search = "";
    return url.toString();
  }

  async function shareTimeline(video: AlbumVideo) {
    const url = timelineShareUrl(video);
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Timeline link copied", description: "Anyone with album access can open this video timeline." });
    } catch {
      toast({ title: "Could not copy link", description: url, variant: "destructive" });
    }
  }

  function targetForMatch(match: VideoMatch) {
    return findTimelineTarget(match, timelineTargetLookup);
  }

  async function uploadVideo(file: File) {
    if (!selectedEventSlug) {
      toast({ title: "Choose an event", description: "Videos are stored inside an album event." });
      return;
    }

    setUploadFileName(file.name);
    setUploadProgress(0);
    setIsUploadingVideo(true);
    let prepared: PreparedVideoUpload | null = null;
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
      prepared = (await prepareResponse.json()) as PreparedVideoUpload & { error?: string };
      if (!prepareResponse.ok) throw new Error(prepared.error || "Could not prepare upload");

      if (prepared.multipart) {
        await uploadMultipartVideo({ albumSlug, file, prepared, onProgress: setUploadProgress });
      } else {
        if (!prepared.uploadUrl) throw new Error("Upload URL was not prepared");
        const uploaded = await uploadToUrl(
          prepared.uploadUrl,
          file,
          prepared.video.contentType,
          setUploadProgress,
        );
        if (!uploaded) throw new Error("S3 upload failed");
        setUploadProgress(100);
      }

      toast({ title: "Video uploaded", description: prepared.video.fileName });
      await mutate();
    } catch (uploadError) {
      if (prepared?.multipart && prepared.uploadId) {
        await postMultipartAction(albumSlug, {
          action: "abort",
          videoId: prepared.video.id,
          key: prepared.key || prepared.video.originalS3Key,
          uploadId: prepared.uploadId,
        }).catch((abortError) => {
          console.warn("Failed to abort multipart video upload", abortError);
        });
      }

      toast({
        title: "Upload failed",
        description: uploadError instanceof Error ? uploadError.message : "Could not upload video",
        variant: "destructive",
      });
    } finally {
      setIsUploadingVideo(false);
      setUploadProgress(0);
      setUploadFileName("");
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
            discoverPeople: willDiscoverPeople,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not start video AI");

      toast({ title: "Video AI started", description: "The timeline will update when the worker finishes." });
      setAiVideo(null);
      setSelfieFiles([]);
      setDiscoverPeople(false);
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

  if (isTimelineRoute) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] text-zinc-950">
        <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-rows-[auto_minmax(0,1fr)] gap-4 px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
          <header className="flex items-center justify-between gap-3 rounded-[1.35rem] border border-black/10 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-xl sm:rounded-[1.75rem] sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <Button asChild variant="ghost" size="icon" className="rounded-full">
                <Link href={`/albums/${encodeURIComponent(albumSlug)}/videos`} aria-label="Back to videos">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold tracking-tight sm:text-lg">
                  {timelineVideo?.fileName || (isLoading ? "Loading video" : "Video")}
                </p>
                {timelineVideo ? (
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
                    <span className="capitalize">{videoStatusLabel(timelineVideo.detectionStatus)}</span>
                    <span>{formatDuration(timelineVideo.durationSec)}</span>
                    <span>{visibleTimelineMatches.length} matches</span>
                  </div>
                ) : null}
              </div>
            </div>
            {timelineVideo ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-full border-black/10 bg-white px-3 text-zinc-800 hover:bg-zinc-50"
                onClick={() => void shareTimeline(timelineVideo)}
              >
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            ) : null}
          </header>

          {error ? (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4" />
              {error.message}
            </div>
          ) : null}

          {!timelineVideo ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-[1.75rem] border border-dashed border-black/15 bg-white/70 p-8 text-center text-sm font-medium text-zinc-500">
              {isLoading ? "Loading video..." : "This video could not be found."}
            </div>
          ) : (
            <div className={`grid min-h-0 gap-4 ${isTimelinePanelOpen ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
              <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3">
                <div className="group relative min-h-0 overflow-hidden rounded-[1.35rem] bg-black shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:rounded-[1.75rem]">
                  {timelineVideo.hlsUrl || timelineVideo.videoUrl ? (
                    <AdaptiveVideoPlayer
                      ref={timelineVideoRef}
                      hlsUrl={timelineVideo.hlsUrl}
                      fallbackUrl={timelineVideo.videoUrl}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-500">
                      <VideoIcon className="h-16 w-16" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/80 via-black/35 to-transparent p-3 text-white opacity-100 transition-opacity duration-200 sm:p-4 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 drop-shadow">
                        <p className="truncate text-sm font-semibold tracking-tight sm:text-base">{timelineVideo.fileName || "Video"}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-medium text-white/75 sm:text-xs">
                          <span className="capitalize">{videoStatusLabel(timelineVideo.detectionStatus)}</span>
                          <span>{formatDuration(timelineVideo.durationSec)}</span>
                          <span>{visibleTimelineMatches.length} matches</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="pointer-events-auto hidden h-9 rounded-full border-white/20 bg-black/35 px-3 text-white backdrop-blur hover:bg-black/55 lg:inline-flex"
                          onClick={() => setIsTimelinePanelOpen((open) => !open)}
                        >
                          {isTimelinePanelOpen ? "Hide details" : "Details"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="pointer-events-auto h-9 rounded-full border-white/20 bg-black/35 px-3 text-white backdrop-blur hover:bg-black/55"
                          onClick={() => void shareTimeline(timelineVideo)}
                          aria-label="Share video link"
                        >
                          <Share2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Share</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-black/10 bg-white/80 p-3 shadow-sm backdrop-blur-xl sm:rounded-[1.75rem] sm:p-4">
                  {timelineTargets.length > 0 && (
                    <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTimelineTargetId(null)}
                        className={`flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border text-xs font-bold transition sm:h-12 sm:min-w-12 ${
                          activeTimelineTargetId === null
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm"
                            : "border-black/10 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                        }`}
                        aria-label="Show all targets"
                      >
                        All
                      </button>
                      {timelineTargets.map((target) => {
                        const active = activeTimelineTargetId === target.id;
                        return (
                          <button
                            key={`${target.key}-${target.index}`}
                            type="button"
                            onClick={() => setActiveTimelineTargetId(active ? null : target.id)}
                            className={`group relative flex h-14 w-14 shrink-0 cursor-pointer flex-col items-center justify-center rounded-full border-2 transition sm:h-16 sm:w-16 ${
                              active ? "border-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" : "border-white hover:border-zinc-300"
                            }`}
                            title={target.label}
                            aria-label={`Filter video to ${target.label}`}
                          >
                            {target.imageUrl ? (
                              <img src={target.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full rounded-full object-cover shadow-sm" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center rounded-full bg-zinc-100 text-zinc-500 shadow-sm">
                                <User className="h-4 w-4" />
                              </span>
                            )}
                            <span
                              className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
                              style={{ backgroundColor: active ? "#10b981" : targetColors[target.index % targetColors.length] }}
                            />
                            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-zinc-950 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                              {target.occurrenceCount}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mb-3 flex items-center justify-between text-xs font-medium text-zinc-500">
                    <span>0:00</span>
                    <span>{formatDuration(timelineVideo.durationSec)}</span>
                  </div>
                  <div className="relative h-20 overflow-visible rounded-[1.15rem] bg-zinc-100 sm:h-16">
                    {visibleTimelineMatches.length ? visibleTimelineMatches.map((match, index) => {
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
                          className="group absolute top-2 cursor-pointer"
                          style={{
                            left: `${Math.min(100, (start / duration) * 100)}%`,
                            width: `${Math.max(1, Math.min(100, ((end - start) / duration) * 100))}%`,
                          }}
                        >
                          <div
                            className="mb-1 flex h-7 w-7 origin-bottom items-center justify-center rounded-full bg-white p-0.5 shadow-sm ring-1 ring-black/10 transition-all duration-200 ease-out group-hover:-translate-y-1.5 group-hover:scale-125 group-hover:shadow-[0_10px_24px_rgba(24,24,27,0.22)] group-hover:ring-2 group-hover:ring-white group-focus-within:-translate-y-1.5 group-focus-within:scale-125 group-focus-within:shadow-[0_10px_24px_rgba(24,24,27,0.22)] group-focus-within:ring-2 group-focus-within:ring-white"
                            title={target?.imageUrl ? `${label || "Face"} - double-click to preview` : label}
                            onDoubleClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (target?.imageUrl) {
                                setPreviewFace({ imageUrl: target.imageUrl, label: label || "Face" });
                              }
                            }}
                          >
                            {target?.imageUrl ? (
                              <img src={target.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full rounded-full object-cover" />
                            ) : (
                              <User className="h-3.5 w-3.5 text-zinc-500" />
                            )}
                          </div>
                          <button
                            type="button"
                            aria-label={`Play match ${index + 1}${label ? ` for ${label}` : ""}`}
                            className="h-8 w-full cursor-pointer rounded-full shadow-[0_8px_22px_rgba(113,113,122,0.16)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-white"
                            style={{ backgroundColor: color }}
                            onClick={() => void seekAndPlay(match.startSec)}
                          />
                        </div>
                      );
                    }) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-xs font-medium text-zinc-500">
                        {emptyTimelineMessage}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <aside className={`hidden min-h-0 overflow-auto rounded-[1.75rem] border border-black/10 bg-white/80 p-4 shadow-sm backdrop-blur-xl ${isTimelinePanelOpen ? "lg:block" : "lg:hidden"}`}>
                <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs text-zinc-600">
                  <div className="rounded-2xl bg-zinc-100 p-3">{formatDuration(timelineVideo.durationSec)}</div>
                  <div className="rounded-2xl bg-zinc-100 p-3">{visibleTimelineMatches.length} matches</div>
                  <div className="rounded-2xl bg-zinc-100 p-3 capitalize">{videoStatusLabel(timelineVideo.detectionStatus)}</div>
                </div>

                {timelineVideoPeople.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2 rounded-2xl bg-zinc-100 p-2">
                    {timelineVideoPeople.map((person) => (
                      <span key={person.id} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm">
                        {person.coverFaceUrl ? (
                          <img src={person.coverFaceUrl} alt="" loading="lazy" decoding="async" className="h-5 w-5 rounded-full object-cover" />
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
                      className="rounded-2xl border border-black/10 bg-white p-3 text-left shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: targetColors[(match.targetIndex ?? 0) % targetColors.length] }}
                          />
                          Match {index + 1}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                          {match.startTime || formatDuration(match.startSec)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        {match.startTime || formatDuration(match.startSec)} - {match.endTime || formatDuration(match.endSec)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                        <span>{match.framesMatched ?? 0} frames</span>
                        <span>max {Number(match.maxSimilarity ?? 0).toFixed(3)}</span>
                        <span>avg {Number(match.avgSimilarity ?? 0).toFixed(3)}</span>
                      </div>
                    </button>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-black/15 p-4 text-sm text-zinc-500">
                      {emptyTimelineMessage}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>

        <Dialog open={Boolean(previewFace)} onOpenChange={(open) => !open && setPreviewFace(null)}>
          <DialogContent className="w-[min(92vw,560px)] overflow-hidden border-black/10 bg-zinc-950 p-0 text-white shadow-2xl sm:max-w-none">
            <DialogTitle className="sr-only">{previewFace?.label || "Face preview"}</DialogTitle>
            <button
              type="button"
              onClick={() => setPreviewFace(null)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
              aria-label="Close face preview"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex min-h-[320px] items-center justify-center bg-black sm:min-h-[420px]">
              {previewFace?.imageUrl ? (
                <img src={previewFace.imageUrl} alt={previewFace.label} className="max-h-[78vh] w-full object-contain" />
              ) : null}
            </div>
            <div className="border-t border-white/10 px-4 py-3 text-sm font-medium text-zinc-100">
              {previewFace?.label || "Face preview"}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    );
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

        {isUploadingVideo && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Uploading {uploadFileName || "video"}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Do not close this browser window. If you close it, the video upload will fail and you will have to start it again.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-semibold text-amber-950 shadow-sm">
                {uploadProgress}%
              </span>
            </div>
            <Progress
              value={uploadProgress}
              className="mt-3 h-2 bg-amber-200 [&_[data-slot=progress-indicator]]:bg-amber-600"
            />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4" />
            {error.message}
          </div>
        )}

        <section>
          <div className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {isLoading && !videos.length ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-64 animate-pulse rounded-2xl bg-white/70" />
              ))
            ) : videos.length ? (
              videos.map((video) => (
                <article
                  key={video.id}
                  className="group overflow-hidden rounded-2xl border border-black/10 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-video bg-zinc-900">
                    <Link href={timelineHref(video.id)} className="block h-full" aria-label={`Open ${video.fileName || "video"}`}>
                      {video.videoUrl || video.hlsUrl ? (
                        <video
                          src={video.videoUrl ?? video.hlsUrl ?? undefined}
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
                          {videoStatusLabel(video.detectionStatus)}
                        </span>
                      </div>
                    </Link>
                    <Button
                      type="button"
                      size="sm"
                      className="absolute right-3 top-3 rounded-full bg-white text-zinc-950 shadow hover:bg-zinc-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        openAiDialog(video);
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Run AI
                    </Button>
                  </div>
                  <Link href={timelineHref(video.id)} className="grid gap-2 p-4">
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
                  </Link>
                </article>
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
        </section>
      </div>

      <Dialog open={Boolean(aiVideo)} onOpenChange={(open) => !open && setAiVideo(null)}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Run video face AI</DialogTitle>
            <DialogDescription>
              Choose album people, scan for unknown people, upload selfies, or combine all targets for this video.
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
                  <Button
                    type="button"
                    variant={allKnownPeopleSelected && discoverPeople ? "default" : "outline"}
                    size="sm"
                    className="h-9 rounded-full px-3 text-xs"
                    onClick={selectAllKnownAndUnknownPeople}
                  >
                    All known + unknown
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
                          loading="lazy"
                          decoding="async"
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
              <label className="flex items-start gap-3 rounded-xl bg-zinc-50 p-3">
                <input
                  type="checkbox"
                  checked={discoverPeople}
                  onChange={(event) => setDiscoverPeople(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-zinc-300"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-900">Find people not already known</span>
                  <span className="block text-xs text-zinc-500">
                    Slower full-video scan. If no targets are selected, AI will extract all faces from the video.
                  </span>
                </span>
              </label>

              <Label htmlFor="selfie-upload">Selfie target</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  ref={selfieInputRef}
                  id="selfie-upload"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/*"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    setSelfieFiles(files);
                    if (files.length > 0) setDiscoverPeople(false);
                  }}
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
              {hasAiTargets ? "Start AI" : "Extract all faces"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewFace)} onOpenChange={(open) => !open && setPreviewFace(null)}>
        <DialogContent className="w-[min(92vw,560px)] overflow-hidden border-black/10 bg-zinc-950 p-0 text-white shadow-2xl sm:max-w-none">
          <DialogTitle className="sr-only">{previewFace?.label || "Face preview"}</DialogTitle>
          <button
            type="button"
            onClick={() => setPreviewFace(null)}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
            aria-label="Close face preview"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex min-h-[320px] items-center justify-center bg-black sm:min-h-[420px]">
            {previewFace?.imageUrl ? (
              <img src={previewFace.imageUrl} alt={previewFace.label} className="max-h-[78vh] w-full object-contain" />
            ) : null}
          </div>
          <div className="border-t border-white/10 px-4 py-3 text-sm font-medium text-zinc-100">
            {previewFace?.label || "Face preview"}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

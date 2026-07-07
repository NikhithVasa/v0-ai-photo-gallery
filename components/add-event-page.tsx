"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { mutate as mutateSWR } from "swr";
import {
  ArrowLeft,
  CheckCircle2,
  CloudDownload,
  FileImage,
  ImageUp,
  Images,
  Info,
  Link2,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import {
  AiPrivacyNotice,
  AI_PRIVACY_MESSAGE,
} from "@/components/ai-privacy-notice";
import { AuthAvatarMenu } from "@/components/auth-avatar-menu";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useGoogleImageImport } from "@/hooks/use-google-image-import";
import { photoPreviewImageUrl } from "@/lib/photo-image-url";
import { photoUploadFileMetadata } from "@/lib/photo-upload-metadata";
import {
  IMAGE_UPLOAD_ACCEPT,
  isSupportedImageFile,
  previewObjectUrl,
} from "@/lib/image-files";
import type { AlbumDetail, AlbumEvent, Photo } from "@/lib/types";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

type UploadStatus = "ready" | "uploading" | "uploaded" | "failed";
type UploadTarget = "new" | "existing";
type AiAction =
  | "run_event"
  | "run_face_worker"
  | "run_image_text_worker"
  | "best_photos_full"
  | "process_new"
  | "process_all_new"
  | "sample"
  | "retry_captions"
  | "rebuild_search"
  | "retry_faces"
  | "check_status"
  | "clean_temp"
  | "delete_album_ai"
  | "reset_album_ai";

const PHOTO_UPLOAD_MAX_RETRIES = 3;
const PHOTO_UPLOAD_RETRY_DELAY_MS = 600;
const PHOTO_UPLOAD_CONCURRENCY = 5;
const VIDEO_UPLOAD_CONCURRENCY = 3;
const VIDEO_UPLOAD_ACCEPT = "video/mp4,video/quicktime,video/x-m4v,video/webm";
const FALLBACK_VIDEO_PART_SIZE_BYTES = 10 * 1024 * 1024;
const AI_JOB_WAIT_MESSAGE =
  "This can take a while. You can come back later - we will notify you by email when it is ready.";
const ALBUM_WIDE_AI_ACTIONS = new Set<AiAction>([
  "process_all_new",
  "delete_album_ai",
  "reset_album_ai",
]);
const AI_ACTION_OPTIONS: Array<{
  value: Exclude<AiAction, "delete_album_ai" | "reset_album_ai">;
  label: string;
  description: string;
}> = [
  {
    value: "run_event",
    label: "Full pipeline",
    description: "Runs faces, people, covers, captions, search, and photo intelligence.",
  },
  {
    value: "run_face_worker",
    label: "Face worker",
    description: "Detects faces, groups people, and creates person cover images.",
  },
  {
    value: "run_image_text_worker",
    label: "Image-text worker",
    description: "Generates captions, searchable metadata, and text embeddings.",
  },
  {
    value: "best_photos_full",
    label: "Best-photo culling",
    description: "Scores, embeds, clusters, and selects the strongest photos.",
  },
  {
    value: "process_new",
    label: "New photos in this event",
    description: "Runs the full pipeline only for photos that still need processing.",
  },
  {
    value: "process_all_new",
    label: "New photos in all events",
    description: "Processes pending photos across the entire album.",
  },
  {
    value: "sample",
    label: "20-photo sample",
    description: "Tests the full pipeline on a limited sample before a larger run.",
  },
  {
    value: "retry_captions",
    label: "Retry captions",
    description: "Retries failed image-text descriptions and their embeddings.",
  },
  {
    value: "retry_faces",
    label: "Retry face detection",
    description: "Retries face indexing and safe people reconciliation.",
  },
  {
    value: "rebuild_search",
    label: "Full-photo embeddings only",
    description: "Generates missing full-photo image embeddings for search and Find Yourself. No faces, captions, people, culling, or text embeddings.",
  },
  {
    value: "check_status",
    label: "Check AI status",
    description: "Submits a status-only worker job without processing photos.",
  },
  {
    value: "clean_temp",
    label: "Clean temporary files",
    description: "Removes temporary AI artifacts for the selected event.",
  },
];

interface QueuedFile {
  localId: string;
  file: File;
  kind: "photo" | "reel";
  status: UploadStatus;
  source?: "google-drive" | "google-photos";
  error?: string;
}

interface PreparedUpload {
  id: string;
  fileName: string;
  contentType: string;
  originalS3Key: string;
  uploadUrl: string;
}

interface PreparedCoverUpload {
  uploadUrl: string;
  contentType: string;
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

interface MultipartUploadPart {
  ETag: string;
  PartNumber: number;
}

interface AddEventPageProps {
  albumSlug: string;
  initialEventSlug?: string | null;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isSupportedVideoFile(file: File) {
  if (file.type.startsWith("video/")) return true;
  return /\.(mp4|mov|m4v|webm)$/i.test(file.name);
}

async function runWithConcurrency(
  total: number,
  concurrency: number,
  worker: (index: number) => Promise<void>,
) {
  let next = 0;
  const runners = Array.from(
    { length: Math.max(1, Math.min(concurrency, total)) },
    async () => {
      while (true) {
        const index = next++;
        if (index >= total) return;
        await worker(index);
      }
    },
  );
  await Promise.all(runners);
}

async function postVideoMultipartAction<T>(
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

function uploadPartToUrl(url: string, blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
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
}: {
  albumSlug: string;
  file: File;
  prepared: PreparedVideoUpload;
}) {
  const uploadId = prepared.uploadId;
  const key = prepared.key || prepared.video.originalS3Key;
  if (!uploadId || !key) throw new Error("Multipart upload was not prepared");

  const partSize = Math.max(
    5 * 1024 * 1024,
    prepared.partSize || FALLBACK_VIDEO_PART_SIZE_BYTES,
  );
  const partCount = Math.ceil(file.size / partSize);
  const parts: MultipartUploadPart[] = [];

  await runWithConcurrency(partCount, VIDEO_UPLOAD_CONCURRENCY, async (index) => {
    const partNumber = index + 1;
    const start = index * partSize;
    const end = Math.min(file.size, start + partSize);
    const { url } = await postVideoMultipartAction<{ url: string }>(albumSlug, {
      action: "sign-part",
      videoId: prepared.video.id,
      key,
      uploadId,
      partNumber,
    });

    const eTag = await uploadPartToUrl(url, file.slice(start, end));
    parts[index] = { ETag: eTag, PartNumber: partNumber };
  });

  await postVideoMultipartAction<{ ok: true }>(albumSlug, {
    action: "complete",
    videoId: prepared.video.id,
    key,
    uploadId,
    parts,
  });
}

export function AddEventPage({
  albumSlug,
  initialEventSlug = null,
}: AddEventPageProps) {
  const router = useRouter();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const reelInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [previewFile, setPreviewFile] = useState<QueuedFile | null>(null);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget>(
    initialEventSlug ? "existing" : "new",
  );
  const [selectedExistingEventSlug, setSelectedExistingEventSlug] = useState(
    initialEventSlug ?? "",
  );
  const [runAi, setRunAi] = useState(true);
  const [selectedAiAction, setSelectedAiAction] =
    useState<(typeof AI_ACTION_OPTIONS)[number]["value"]>("run_event");
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [runningAiAction, setRunningAiAction] = useState<AiAction | null>(null);
  const [aiJobMessage, setAiJobMessage] = useState("");
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [deletingPhotoIds, setDeletingPhotoIds] = useState<string[]>([]);
  const [isPhotoSelectMode, setIsPhotoSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [completedUpload, setCompletedUpload] = useState<{
    eventSlug: string;
    eventName: string;
    photoCount: number;
    reelCount: number;
  } | null>(null);
  const coverPreviewUrlRef = useRef<string | null>(null);
  const {
    googleDriveFolderLink,
    googlePhotosButtonLabel,
    importFromGoogleDrive,
    importFromGoogleDriveLink,
    importFromGooglePhotos,
    isImporting: isGoogleImporting,
    isImportingDrive,
    isImportingPhotos,
    message: googleImportMessage,
    setGoogleDriveFolderLink,
  } = useGoogleImageImport({
    onImages: (images) =>
      addMediaFiles(
        images.map((image) => image.file),
        images[0]?.source,
      ),
  });

  const { data, error, isLoading, mutate: mutateAlbum } = useSWR<{
    album: AlbumDetail;
  }>(
    `/api/albums/${encodeURIComponent(albumSlug)}`,
    fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    },
  );

  const album = data?.album;
  const selectedEventPhotosUrl =
    uploadTarget === "existing" && selectedExistingEventSlug
      ? `/api/albums/${encodeURIComponent(albumSlug)}/photos?event=${encodeURIComponent(
          selectedExistingEventSlug,
        )}`
      : null;
  const {
    data: selectedEventPhotosData,
    error: selectedEventPhotosError,
    isLoading: selectedEventPhotosLoading,
    mutate: mutateSelectedEventPhotos,
  } = useSWR<{ photos: Photo[] }>(selectedEventPhotosUrl, fetcher, {
    dedupingInterval: 0,
    revalidateOnFocus: false,
  });
  const selectedEventPhotos = selectedEventPhotosData?.photos ?? [];
  const previewUrl = useMemo(
    () => (previewFile ? URL.createObjectURL(previewFile.file) : null),
    [previewFile],
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);
  const uploadedCount = queuedFiles.filter((file) => file.status === "uploaded").length;
  const queuedPhotoCount = queuedFiles.filter((file) => file.kind === "photo").length;
  const queuedReelCount = queuedFiles.filter((file) => file.kind === "reel").length;
  const filesReadyToUpload = queuedFiles.filter(
    (file) => file.status === "ready" || file.status === "failed",
  );
  const selectedExistingEvent = album?.events.find(
    (event) => event.slug === selectedExistingEventSlug,
  );
  const currentCoverUrl = selectedExistingEvent?.coverPhotoUrl ?? album?.coverPhotoUrl;
  const coverSaveEventSlug = selectedExistingEventSlug;
  const destinationEventName =
    uploadTarget === "existing"
      ? selectedExistingEvent?.name || "Select event"
      : title.trim() || "New event";
  const canCreate = Boolean(
    filesReadyToUpload.length &&
      !isUploading &&
      !isGoogleImporting &&
      (uploadTarget === "new" ? title.trim() : selectedExistingEventSlug),
  );
  const canSaveCover = Boolean(
    coverFile &&
      !isUploading &&
      !isSavingCover &&
      coverSaveEventSlug
  );

  const uploadButtonLabel =
    uploadTarget === "new" ? "Create event and upload" : "Start upload";
  const uploadStarted = queuedFiles.some((file) => file.status !== "ready");
  const mediaSummary = useMemo(() => {
    if (!queuedFiles.length) return "No media selected";
    const parts = [
      queuedPhotoCount ? `${queuedPhotoCount} photo${queuedPhotoCount === 1 ? "" : "s"}` : "",
      queuedReelCount ? `${queuedReelCount} reel${queuedReelCount === 1 ? "" : "s"}` : "",
    ].filter(Boolean);
    if (uploadStarted) {
      return `${uploadedCount}/${queuedFiles.length} media file${
        queuedFiles.length === 1 ? "" : "s"
      } uploaded`;
    }
    return `${parts.join(" and ")} selected`;
  }, [queuedFiles.length, queuedPhotoCount, queuedReelCount, uploadedCount, uploadStarted]);

  useEffect(() => {
    coverPreviewUrlRef.current = coverPreviewUrl;
  }, [coverPreviewUrl]);

  useEffect(() => {
    if (!initialEventSlug) return;
    setUploadTarget("existing");
    setSelectedExistingEventSlug(initialEventSlug);
  }, [initialEventSlug]);

  useEffect(() => {
    if (selectedExistingEventSlug || !album?.events.length) return;
    setSelectedExistingEventSlug(album.events[0].slug);
  }, [album?.events, selectedExistingEventSlug]);

  useEffect(() => {
    setIsPhotoSelectMode(false);
    setSelectedPhotoIds([]);
  }, [selectedExistingEventSlug, uploadTarget]);

  useEffect(() => {
    if (!selectedPhotoIds.length) return;

    const photoIds = new Set(selectedEventPhotos.map((photo) => photo.id));
    setSelectedPhotoIds((current) => {
      const next = current.filter((id) => photoIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [selectedEventPhotos, selectedPhotoIds.length]);

  useEffect(() => {
    return () => {
      if (coverPreviewUrlRef.current) {
        URL.revokeObjectURL(coverPreviewUrlRef.current);
      }
    };
  }, []);

  const chooseCover = (files: FileList | null) => {
    const file = Array.from(files ?? []).find(isSupportedImageFile);
    if (!file) return;

    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverFile(file);
    setCoverPreviewUrl(previewObjectUrl(file) ?? null);
    if (uploadTarget !== "existing" && selectedExistingEventSlug) {
      setUploadTarget("existing");
    }
  };

  const addMediaFiles = (
    files: File[],
    source?: "google-drive" | "google-photos",
  ) => {
    const media: Array<{ file: File; kind: QueuedFile["kind"] }> = [];
    for (const file of files) {
      if (isSupportedImageFile(file)) {
        media.push({ file, kind: "photo" });
        continue;
      }
      if (isSupportedVideoFile(file)) {
        media.push({ file, kind: "reel" });
      }
    }
    if (!media.length) return;

    setQueuedFiles((current) => [
      ...current,
      ...media.map(({ file, kind }) => ({
        localId: crypto.randomUUID(),
        file,
        kind,
        status: "ready" as UploadStatus,
        source: kind === "photo" ? source : undefined,
      })),
    ]);
    setErrorMessage("");
    setCompletedUpload(null);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  const addMedia = (files: FileList | null) => {
    addMediaFiles(Array.from(files ?? []));
  };

  const removeMedia = (localId: string) => {
    setQueuedFiles((current) =>
      current.filter((file) => file.localId !== localId),
    );
  };

  const clearUploadQueue = () => {
    setQueuedFiles([]);
    setCompletedUpload(null);
    setErrorMessage("");
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  const updateFile = (
    localId: string,
    patch: Partial<Pick<QueuedFile, "status" | "error">>,
  ) => {
    setQueuedFiles((current) =>
      current.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    );
  };

  const submitAiAction = async (
    action: AiAction,
    eventSlugs: string[],
    options: { maxFiles?: number } = {},
  ) => {
    if ((!eventSlugs.length && !ALBUM_WIDE_AI_ACTIONS.has(action)) || runningAiAction) return;

    setRunningAiAction(action);
    const isDeleteOnly = action === "delete_album_ai";
    setAiJobMessage(isDeleteOnly ? "" : AI_JOB_WAIT_MESSAGE);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/ai`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            eventSlugs,
            maxFiles: options.maxFiles,
          }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        runpod?: { id?: string; status?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not submit AI job");
      }

      if (isDeleteOnly) {
        const deletedMessage =
          "AI data was deleted and queued for regeneration on the next worker run. Photos and events were preserved.";
        setAiJobMessage(deletedMessage);
        toast({
          title: "AI data deleted",
          description: deletedMessage,
        });
      } else {
        const jobLabel = payload.runpod?.id
          ? `${AI_JOB_WAIT_MESSAGE} Job ${payload.runpod.id} has been submitted.`
          : AI_JOB_WAIT_MESSAGE;
        setAiJobMessage(jobLabel);
        toast({
          title: "AI job submitted",
          description: jobLabel,
        });
      }
      await Promise.all([mutateAlbum(), mutateSelectedEventPhotos()]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "AI job submission failed",
      );
    } finally {
      setRunningAiAction(null);
    }
  };

  const selectedAiEventSlugs =
    uploadTarget === "existing" && selectedExistingEvent
      ? [selectedExistingEvent.slug]
      : [];
  const selectedAiOption =
    AI_ACTION_OPTIONS.find((option) => option.value === selectedAiAction) ??
    AI_ACTION_OPTIONS[0];
  const canRunSelectedEventAi = Boolean(selectedAiEventSlugs.length);

  const uploadCover = async (eventSlug: string) => {
    if (!coverFile) return;

    const response = await fetch(
      `/api/albums/${encodeURIComponent(albumSlug)}/cover`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug,
          fileName: coverFile.name,
          size: coverFile.size,
          contentType: coverFile.type || "application/octet-stream",
        }),
      },
    );
    const payload = (await response.json()) as {
      error?: string;
      upload?: PreparedCoverUpload;
    };

    if (!response.ok || !payload.upload) {
      throw new Error(payload.error || "Could not prepare the cover photo");
    }

    const uploadResponse = await fetch(payload.upload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": payload.upload.contentType },
      body: coverFile,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Cover upload failed (${uploadResponse.status})`);
    }
  };

  const saveCoverOnly = async () => {
    const eventSlug = coverSaveEventSlug;
    if (!coverFile || !eventSlug || isSavingCover) return;

    setIsSavingCover(true);
    setErrorMessage("");

    try {
      await uploadCover(eventSlug);
      toast({
        title: "Cover updated",
        description: `${selectedExistingEvent?.name || album?.name || "Event"} cover photo was updated.`,
      });
      setCoverFile(null);
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
      setCoverPreviewUrl(null);
      await mutateAlbum();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Cover update failed",
      );
    } finally {
      setIsSavingCover(false);
    }
  };

  const deleteSelectedEvent = async () => {
    if (!selectedExistingEvent || isDeletingEvent) return;

    const shouldDelete = window.confirm(
      `Delete "${selectedExistingEvent.name}" and hide all of its photos?`,
    );
    if (!shouldDelete) return;

    setIsDeletingEvent(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/events`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: selectedExistingEvent.id }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        events?: AlbumEvent[];
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not delete event");
      }

      const nextEvent = payload.events?.[0];
      setSelectedExistingEventSlug(nextEvent?.slug ?? "");
      await Promise.all([mutateAlbum(), mutateSelectedEventPhotos()]);
      toast({
        title: "Event deleted",
        description: `${selectedExistingEvent.name} was removed from this album.`,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Event deletion failed",
      );
    } finally {
      setIsDeletingEvent(false);
    }
  };

  const deletePhoto = async (photo: Photo) => {
    if (deletingPhotoIds.includes(photo.id)) return;

    const shouldDelete = window.confirm(
      `Delete ${photo.fileName || "this photo"} from ${selectedExistingEvent?.name || "this event"}?`,
    );
    if (!shouldDelete) return;

    setDeletingPhotoIds((current) => [...current, photo.id]);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/photos/${encodeURIComponent(
          photo.id,
        )}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not delete photo");
      }

      await Promise.all([mutateSelectedEventPhotos(), mutateAlbum()]);
      toast({
        title: "Photo deleted",
        description: photo.fileName || "Photo removed from this event.",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Photo deletion failed",
      );
    } finally {
      setDeletingPhotoIds((current) => current.filter((id) => id !== photo.id));
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds((current) =>
      current.includes(photoId)
        ? current.filter((id) => id !== photoId)
        : [...current, photoId]
    );
  };

  const selectAllEventPhotos = () => {
    setSelectedPhotoIds(selectedEventPhotos.map((photo) => photo.id));
  };

  const deleteSelectedPhotos = async () => {
    if (!selectedPhotoIds.length || deletingPhotoIds.length) return;

    const count = selectedPhotoIds.length;
    const shouldDelete = window.confirm(
      `Delete ${count} selected photo${count === 1 ? "" : "s"} from ${
        selectedExistingEvent?.name || "this event"
      }?`
    );
    if (!shouldDelete) return;

    const photoIdsToDelete = [...selectedPhotoIds];
    setDeletingPhotoIds(photoIdsToDelete);
    setErrorMessage("");

    try {
      const results = await Promise.allSettled(
        photoIdsToDelete.map(async (photoId) => {
          const response = await fetch(
            `/api/albums/${encodeURIComponent(albumSlug)}/photos/${encodeURIComponent(
              photoId
            )}`,
            { method: "DELETE" }
          );
          const payload = (await response.json()) as { error?: string };

          if (!response.ok) {
            throw new Error(payload.error || "Could not delete photo");
          }

          return photoId;
        })
      );
      const deletedIds = results
        .filter(
          (result): result is PromiseFulfilledResult<string> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value);
      const failedCount = results.length - deletedIds.length;

      if (deletedIds.length) {
        setSelectedPhotoIds((current) =>
          current.filter((id) => !deletedIds.includes(id))
        );
        if (!failedCount) setIsPhotoSelectMode(false);
        await Promise.all([mutateSelectedEventPhotos(), mutateAlbum()]);
        toast({
          title: "Photos deleted",
          description: `${deletedIds.length} photo${
            deletedIds.length === 1 ? "" : "s"
          } removed from ${selectedExistingEvent?.name || "this event"}.`,
        });
      }

      if (failedCount) {
        throw new Error(
          `${failedCount} photo${failedCount === 1 ? "" : "s"} could not be deleted`
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Photo deletion failed"
      );
    } finally {
      setDeletingPhotoIds((current) =>
        current.filter((id) => !photoIdsToDelete.includes(id))
      );
    }
  };

  const createEvent = async () => {
    const eventName = title.trim();
    const eventSlug =
      uploadTarget === "existing" ? selectedExistingEventSlug : undefined;
    const filesToUpload = queuedFiles.filter(
      (item) => item.status === "ready" || item.status === "failed",
    );
    const photoFilesToUpload = filesToUpload.filter((item) => item.kind === "photo");
    const reelFilesToUpload = filesToUpload.filter((item) => item.kind === "reel");

    if (
      isUploading ||
      !filesToUpload.length ||
      (uploadTarget === "new" && !eventName) ||
      (uploadTarget === "existing" && !eventSlug)
    ) {
      return;
    }

    setIsUploading(true);
    setErrorMessage("");
    filesToUpload.forEach((item) =>
      updateFile(item.localId, { status: "uploading", error: undefined }),
    );
    const completedLocalIds = new Set<string>();

    try {
      let preparedEvent: { slug: string; name: string } | null = null;
      let preparedUploads: PreparedUpload[] = [];
      const completedPhotoIds: string[] = [];

      if (photoFilesToUpload.length) {
        const uploadFiles: Awaited<ReturnType<typeof photoUploadFileMetadata>>[] = [];
        await runWithConcurrency(
          photoFilesToUpload.length,
          PHOTO_UPLOAD_CONCURRENCY,
          async (index) => {
            const item = photoFilesToUpload[index];
            if (!item) return;
            uploadFiles[index] = await photoUploadFileMetadata(item.file);
          },
        );

        const prepareResponse = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "existing",
            albumSlug,
            eventSlug,
            eventName: uploadTarget === "new" ? eventName : undefined,
            files: uploadFiles,
          }),
        });

        const prepared = (await prepareResponse.json()) as {
          error?: string;
          event?: { slug: string; name: string };
          uploads?: PreparedUpload[];
        };

        if (!prepareResponse.ok || !prepared.uploads?.length || !prepared.event) {
          throw new Error(prepared.error || "Could not prepare event uploads");
        }

        preparedEvent = prepared.event;
        preparedUploads = prepared.uploads;
      } else if (uploadTarget === "new") {
        const createResponse = await fetch(
          `/api/albums/${encodeURIComponent(albumSlug)}/events`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: eventName }),
          },
        );
        const created = (await createResponse.json().catch(() => ({}))) as {
          error?: string;
          event?: { slug: string; name: string };
        };

        if (!createResponse.ok || !created.event) {
          throw new Error(created.error || "Could not create event");
        }

        preparedEvent = created.event;
      } else if (selectedExistingEvent) {
        preparedEvent = {
          slug: selectedExistingEvent.slug,
          name: selectedExistingEvent.name,
        };
      }

      if (!preparedEvent) throw new Error("Could not resolve upload event");

      await runWithConcurrency(
        preparedUploads.length,
        PHOTO_UPLOAD_CONCURRENCY,
        async (index) => {
          const upload = preparedUploads[index];
          const item = photoFilesToUpload[index];
          if (!upload || !item) return;
          let uploadSucceeded = false;
          let lastUploadError = "Upload failed";

          for (
            let attempt = 0;
            attempt <= PHOTO_UPLOAD_MAX_RETRIES && !uploadSucceeded;
            attempt += 1
          ) {
            updateFile(item.localId, {
              status: "uploading",
              error:
                attempt > 0
                  ? `Retrying upload (${attempt}/${PHOTO_UPLOAD_MAX_RETRIES})`
                  : undefined,
            });

            try {
              const uploadResponse = await fetch(upload.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": upload.contentType },
                body: item.file,
              });
              uploadSucceeded = uploadResponse.ok;
              if (!uploadResponse.ok) {
                lastUploadError = `S3 upload failed (${uploadResponse.status})`;
              }
            } catch {
              lastUploadError = "S3 upload failed";
              uploadSucceeded = false;
            }

            if (!uploadSucceeded) {
              try {
                const fallbackResponse = await fetch(
                  `/api/uploads/${encodeURIComponent(upload.id)}/file`,
                  {
                    method: "PUT",
                    headers: { "Content-Type": upload.contentType },
                    body: item.file,
                  },
                );
                uploadSucceeded = fallbackResponse.ok;
                if (!fallbackResponse.ok) {
                  lastUploadError = `Fallback upload failed (${fallbackResponse.status})`;
                }
              } catch {
                lastUploadError = "Fallback upload failed";
                uploadSucceeded = false;
              }
            }

            if (!uploadSucceeded && attempt < PHOTO_UPLOAD_MAX_RETRIES) {
              await wait(PHOTO_UPLOAD_RETRY_DELAY_MS);
            }
          }

          if (!uploadSucceeded) {
            updateFile(item.localId, {
              status: "failed",
              error: `${lastUploadError}. Retried ${PHOTO_UPLOAD_MAX_RETRIES} times.`,
            });
            return;
          }

          completedPhotoIds.push(upload.id);
          completedLocalIds.add(item.localId);
          updateFile(item.localId, { status: "uploaded" });
        },
      );

      if (photoFilesToUpload.length && !completedPhotoIds.length) {
        throw new Error("No photos were uploaded");
      }

      if (completedPhotoIds.length) {
        const completeResponse = await fetch("/api/uploads/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoIds: completedPhotoIds, runAi }),
        });
        const completePayload = (await completeResponse.json().catch(() => ({}))) as {
          error?: string;
        };

        if (!completeResponse.ok) {
          throw new Error(
            completePayload.error || "Photos uploaded, but completion failed",
          );
        }
      }

      const completedReelIds: string[] = [];

      await runWithConcurrency(
        reelFilesToUpload.length,
        VIDEO_UPLOAD_CONCURRENCY,
        async (index) => {
          const item = reelFilesToUpload[index];
          if (!item) return;
          let prepared: PreparedVideoUpload | null = null;

          try {
            const prepareResponse = await fetch(
              `/api/albums/${encodeURIComponent(albumSlug)}/videos`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  eventSlug: preparedEvent.slug,
                  fileName: item.file.name,
                  size: item.file.size,
                  contentType: item.file.type || "video/mp4",
                }),
              },
            );
            prepared = (await prepareResponse.json()) as PreparedVideoUpload;
            if (!prepareResponse.ok) {
              throw new Error(prepared.error || "Could not prepare reel upload");
            }

            if (prepared.multipart) {
              await uploadMultipartVideo({ albumSlug, file: item.file, prepared });
            } else {
              if (!prepared.uploadUrl) throw new Error("Upload URL was not prepared");
              const uploadResponse = await fetch(prepared.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": prepared.video.contentType },
                body: item.file,
              });
              if (!uploadResponse.ok) {
                throw new Error(`S3 upload failed (${uploadResponse.status})`);
              }
            }

            completedReelIds.push(prepared.video.id);
            completedLocalIds.add(item.localId);
            updateFile(item.localId, { status: "uploaded" });
          } catch (error) {
            if (prepared?.multipart && prepared.uploadId) {
              await postVideoMultipartAction(albumSlug, {
                action: "abort",
                videoId: prepared.video.id,
                key: prepared.key || prepared.video.originalS3Key,
                uploadId: prepared.uploadId,
              }).catch((abortError) => {
                console.warn("Failed to abort multipart reel upload", abortError);
              });
            }

            throw error;
          }
        },
      );

      if (reelFilesToUpload.length && !completedReelIds.length) {
        throw new Error("No reels were uploaded");
      }

      await uploadCover(preparedEvent.slug);

      if (runAi && completedPhotoIds.length) {
        try {
          await submitAiAction("process_new", [preparedEvent.slug]);
        } catch {
          // submitAiAction already surfaces the error; upload success should remain intact.
        }
      }

      const encodedAlbumSlug = encodeURIComponent(albumSlug);
      const encodedEventSlug = encodeURIComponent(preparedEvent.slug);
      await Promise.all([
        mutateAlbum(),
        mutateSWR(`/api/albums/${encodedAlbumSlug}`),
        mutateSWR(`/api/albums/${encodedAlbumSlug}/stats`),
        mutateSWR(`/api/albums/${encodedAlbumSlug}/videos`),
        mutateSWR(
          `/api/albums/${encodedAlbumSlug}/photos?event=${encodedEventSlug}`,
        ),
        mutateSWR(
          (key) =>
            typeof key === "string" &&
            key.startsWith(`/api/albums/${encodedAlbumSlug}/photos`),
        ),
      ]);

      toast({
        title: "Media uploaded successfully",
        description: `${completedPhotoIds.length} photo${
          completedPhotoIds.length === 1 ? "" : "s"
        } and ${completedReelIds.length} reel${
          completedReelIds.length === 1 ? "" : "s"
        } added to ${preparedEvent.name}.`,
      });

      setCompletedUpload({
        eventSlug: preparedEvent.slug,
        eventName: preparedEvent.name,
        photoCount: completedPhotoIds.length,
        reelCount: completedReelIds.length,
      });
      setUploadTarget("existing");
      setSelectedExistingEventSlug(preparedEvent.slug);
      setTitle("");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Event upload failed unexpectedly";
      setErrorMessage(message);
      toast({
        title: "Upload failed",
        description: message,
        variant: "destructive",
      });
      filesToUpload.forEach((item) => {
        if (!completedLocalIds.has(item.localId)) {
          updateFile(item.localId, { status: "failed", error: message });
        }
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  if (error || !album) {
    return (
      <main className="min-h-screen bg-[#fbfaf8] px-6 py-12 text-center text-zinc-600">
        Failed to load album.
      </main>
    );
  }

  const renderUploadArea = (variant: "large" | "side") => {
    const isSide = variant === "side";

    return (
      <div className="space-y-2">
        <div
          className={`relative overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_28px_80px_rgba(24,24,27,0.08)] ${
            isSide ? "min-h-[360px]" : "min-h-[520px]"
          }`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addMedia(event.dataTransfer.files);
          }}
        >
        <div
          className={`pointer-events-none absolute inset-0 grid gap-7 opacity-60 ${
            isSide ? "grid-cols-2 p-5" : "grid-cols-4 p-8"
          }`}
        >
          {Array.from({ length: isSide ? 6 : 10 }).map((_, index) => (
            <div
              key={index}
              className={`rounded-[18px] border border-zinc-200 bg-zinc-50 ${
                !isSide && index % 3 === 0 ? "row-span-2" : ""
              }`}
            />
          ))}
        </div>

        {queuedFiles.length > 0 && (
          <div
            className={`relative z-10 grid gap-2 p-4 ${
              isSide ? "grid-cols-1 pt-16" : "grid-cols-1 pt-16 sm:grid-cols-3 sm:pt-4"
            }`}
          >
            {queuedFiles.map((item) => (
              <div
                key={item.localId}
                className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/90 p-3 text-left shadow-sm backdrop-blur"
              >
                <button
                  type="button"
                  onClick={() => item.kind === "photo" && setPreviewFile(item)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
                    {item.kind === "reel" ? (
                      <Video className="h-5 w-5" />
                    ) : (
                      <FileImage className="h-5 w-5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-950 transition group-hover:text-zinc-600">
                      {item.file.name}
                    </span>
                    <span className="mt-0.5 block text-xs font-medium text-zinc-400">
                      {item.kind === "reel" ? "Instagram reel" : "Photo"}
                    </span>
                  </span>
                </button>
                {item.status === "uploaded" && (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(item.localId)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  aria-label={`Remove ${item.file.name}`}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {queuedFiles.length === 0 ? (
          <div className="absolute left-1/2 top-1/2 z-20 flex w-[min(88%,460px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
            <span
              className={`mb-5 flex items-center justify-center rounded-full bg-white/90 text-zinc-400 shadow-[0_18px_60px_rgba(24,24,27,0.18)] ring-1 ring-zinc-200 backdrop-blur-xl ${
                isSide ? "h-[72px] w-[72px]" : "h-24 w-24"
              }`}
            >
              <Upload
                className={isSide ? "h-9 w-9" : "h-12 w-12"}
                strokeWidth={1.4}
              />
            </span>
            <span
              className={`font-bold tracking-normal text-zinc-900 ${
                isSide ? "text-2xl" : "text-4xl"
              }`}
            >
              Upload Media
            </span>
            <span
              className={`mt-3 text-zinc-400 ${isSide ? "text-lg" : "text-2xl"}`}
            >
              Drop files here or choose what to upload
            </span>

            <div className={`mt-6 grid w-full gap-2 ${isSide ? "grid-cols-1" : "grid-cols-2"}`}>
              <button
                type="button"
                onClick={() => mediaInputRef.current?.click()}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <FileImage className="h-4 w-4" />
                Upload Photos
              </button>
              <button
                type="button"
                onClick={() => reelInputRef.current?.click()}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white/95 px-4 text-sm font-semibold text-zinc-800 shadow-lg transition hover:bg-white hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <Video className="h-4 w-4" />
                Upload Reels
              </button>
            </div>
          </div>
        ) : (
          <div className="absolute right-4 top-4 z-20 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              className="flex h-10 items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <FileImage className="h-4 w-4" />
              Add Photos
            </button>
            <button
              type="button"
              onClick={() => reelInputRef.current?.click()}
              className="flex h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-sm font-semibold text-zinc-800 shadow-lg ring-1 ring-zinc-200 transition hover:bg-white hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <Video className="h-4 w-4" />
              Add Reels
            </button>
          </div>
        )}

        <input
          ref={mediaInputRef}
          type="file"
          multiple
          accept={IMAGE_UPLOAD_ACCEPT}
          className="hidden"
          onChange={(event) => addMedia(event.target.files)}
        />
        <input
          ref={reelInputRef}
          type="file"
          multiple
          accept={VIDEO_UPLOAD_ACCEPT}
          className="hidden"
          onChange={(event) => addMedia(event.target.files)}
        />
        </div>

        <div className={`grid gap-2 ${isSide ? "grid-cols-1" : "sm:grid-cols-2"}`}>
          <button
            type="button"
            onClick={() => void importFromGoogleDrive()}
            disabled={isUploading || isGoogleImporting}
            title="Select images, or select one folder to import every image inside it."
            className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isImportingDrive ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudDownload className="h-4 w-4" />
            )}
            Upload from Google Drive
          </button>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void importFromGoogleDriveLink();
            }}
          >
            <Input
              type="url"
              value={googleDriveFolderLink}
              onChange={(event) => setGoogleDriveFolderLink(event.target.value)}
              placeholder="Public Drive folder link"
              aria-label="Public Google Drive folder link"
              disabled={isUploading || isGoogleImporting}
              className="h-10 min-w-0 flex-1 rounded-2xl"
            />
            <button
              type="submit"
              disabled={isUploading || isGoogleImporting || !googleDriveFolderLink.trim()}
              className="flex h-10 min-w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Import public Google Drive folder link"
            >
              {isImportingDrive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
            </button>
          </form>
          <button
            type="button"
            onClick={() => void importFromGooglePhotos()}
            disabled={isUploading || isGoogleImporting}
            className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isImportingPhotos ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Images className="h-4 w-4" />
            )}
            {googlePhotosButtonLabel}
          </button>
        </div>

        {googleImportMessage && (
          <p className="rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
            {googleImportMessage}
          </p>
        )}
      </div>
    );
  };

  const renderSelectedEventPhotos = () => {
    const hasEventPhotos = selectedEventPhotos.length > 0;
    const selectedCount = selectedPhotoIds.length;
    const allPhotosSelected =
      hasEventPhotos && selectedCount === selectedEventPhotos.length;

    return (
      <div className="min-h-[520px] rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_28px_80px_rgba(24,24,27,0.08)]">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-950">
              {selectedExistingEvent?.name || "Event photos"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {isPhotoSelectMode
                ? `${selectedCount} selected`
                : "All photos currently in this event."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedEventPhotosLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            )}

            {hasEventPhotos && !isPhotoSelectMode && (
              <button
                type="button"
                onClick={() => setIsPhotoSelectMode(true)}
                className="h-9 rounded-full border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
              >
                Select photos
              </button>
            )}

            {isPhotoSelectMode && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    allPhotosSelected ? setSelectedPhotoIds([]) : selectAllEventPhotos()
                  }
                  className="h-9 rounded-full border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
                >
                  {allPhotosSelected ? "Clear all" : "Select all"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPhotoSelectMode(false);
                    setSelectedPhotoIds([]);
                  }}
                  className="h-9 rounded-full border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deleteSelectedPhotos}
                  disabled={!selectedCount || Boolean(deletingPhotoIds.length)}
                  className="flex h-9 items-center gap-2 rounded-full bg-rose-600 px-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {deletingPhotoIds.length ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete selected
                </button>
              </>
            )}
          </div>
        </div>

      {!selectedEventPhotosLoading && selectedEventPhotosError && (
        <p className="py-16 text-center text-sm text-rose-600">
          {selectedEventPhotosError instanceof Error
            ? selectedEventPhotosError.message
            : "Could not load event photos."}
        </p>
      )}

      {!selectedEventPhotosLoading &&
        !selectedEventPhotosError &&
        selectedEventPhotos.length === 0 && (
          <p className="py-16 text-center text-sm text-zinc-500">
            No photos in this event yet.
          </p>
        )}

      {selectedEventPhotos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {selectedEventPhotos.map((photo) => {
            const isDeleting = deletingPhotoIds.includes(photo.id);
            const isSelected = selectedPhotoIds.includes(photo.id);
            const imageUrl = photoPreviewImageUrl(photo);

            return (
              <div
                key={photo.id}
                onClick={() => {
                  if (isPhotoSelectMode) {
                    togglePhotoSelection(photo.id);
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    isPhotoSelectMode &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    togglePhotoSelection(photo.id);
                  }
                }}
                className={`group relative aspect-square overflow-hidden rounded-2xl bg-zinc-200 text-left transition focus:outline-none focus:ring-2 focus:ring-zinc-400 ${
                  isSelected
                    ? "ring-4 ring-zinc-950 ring-offset-2 ring-offset-white"
                    : "ring-1 ring-transparent"
                } ${isPhotoSelectMode ? "cursor-pointer" : ""}`}
                role={isPhotoSelectMode ? "button" : undefined}
                tabIndex={isPhotoSelectMode ? 0 : undefined}
                aria-pressed={isPhotoSelectMode ? isSelected : undefined}
                aria-label={
                  isPhotoSelectMode
                    ? `${isSelected ? "Unselect" : "Select"} ${
                        photo.fileName || "photo"
                      }`
                    : photo.fileName || "Event photo"
                }
              >
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={photo.fileName || "Event photo"}
                    fill
                    sizes="(min-width: 1280px) 160px, (min-width: 1024px) 20vw, (min-width: 640px) 30vw, 45vw"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-400">
                    <FileImage className="h-6 w-6" />
                  </div>
                )}

                {isPhotoSelectMode ? (
                  <span
                    className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition ${
                      isSelected
                        ? "border-zinc-950 bg-zinc-950 text-white"
                        : "border-white/80 bg-white/90 text-zinc-400"
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="h-4 w-4" />}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deletePhoto(photo);
                    }}
                    disabled={isDeleting}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-rose-600 opacity-0 shadow-sm transition hover:bg-rose-50 disabled:opacity-80 group-hover:opacity-100"
                    aria-label={`Delete ${photo.fileName || "photo"}`}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
    );
  };

  return (
    <>
    <main className="min-h-screen bg-[#fbfaf8] text-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-[#fbfaf8]/88 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`/albums/${encodeURIComponent(albumSlug)}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              aria-label="Back to album"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
                {album.customer?.name || album.name}
              </p>
              <h1 className="truncate text-lg font-semibold sm:text-xl">
                Add Media
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/albums/${encodeURIComponent(albumSlug)}${
                selectedExistingEventSlug
                  ? `?event=${encodeURIComponent(selectedExistingEventSlug)}`
                  : ""
              }`}
              className="hidden h-9 shrink-0 items-center rounded-full border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950 sm:flex"
            >
              View album
            </Link>
            <button
              type="button"
              onClick={createEvent}
              disabled={!canCreate}
              className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-zinc-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{uploadButtonLabel}</span>
              <span className="sm:hidden">Upload</span>
            </button>
            <AuthAvatarMenu />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        {completedUpload && (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <div className="min-w-0">
                  <p className="font-semibold">
                    {completedUpload.photoCount} photo{completedUpload.photoCount === 1 ? "" : "s"} and {completedUpload.reelCount} reel{completedUpload.reelCount === 1 ? "" : "s"} added to {completedUpload.eventName}
                  </p>
                  <p className="mt-1 text-sm text-emerald-800/80">
                    {runAi && completedUpload.photoCount > 0
                      ? "AI processing has been submitted for the new uploads."
                      : completedUpload.photoCount > 0
                        ? "AI processing is off for this upload."
                        : "Reels are ready in the album viewer."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/albums/${encodeURIComponent(albumSlug)}?event=${encodeURIComponent(
                    completedUpload.eventSlug,
                  )}`}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-emerald-900 px-3 text-sm font-semibold text-white transition hover:bg-emerald-950"
                >
                  View event
                </Link>
                <button
                  type="button"
                  onClick={clearUploadQueue}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-white px-3 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
                >
                  Upload more
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-950">Destination</p>
              <h2 className="mt-1 truncate text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
                {album.name}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {album.customer?.name || "Album"} · {destinationEventName}
              </p>
              <AiPrivacyNotice className="mt-4 max-w-2xl bg-zinc-50/80" />
            </div>

            <div className="grid gap-3 sm:grid-cols-[220px_minmax(260px,420px)] lg:min-w-[640px]">
              <div>
                <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">
                  Target
                </Label>
                <div className="grid grid-cols-2 gap-1 rounded-full bg-zinc-100 p-1">
                  <button
                    type="button"
                    onClick={() => setUploadTarget("existing")}
                    className={`h-10 rounded-full text-sm font-semibold transition ${
                      uploadTarget === "existing"
                        ? "bg-white text-zinc-950 shadow-sm"
                        : "text-zinc-500"
                    }`}
                  >
                    Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadTarget("new")}
                    className={`h-10 rounded-full text-sm font-semibold transition ${
                      uploadTarget === "new"
                        ? "bg-white text-zinc-950 shadow-sm"
                        : "text-zinc-500"
                    }`}
                  >
                    New event
                  </button>
                </div>
              </div>

              <div>
                <Label
                  htmlFor={uploadTarget === "existing" ? "upload-event" : "new-event-name"}
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400"
                >
                  Event
                </Label>
                {uploadTarget === "existing" ? (
                  album.events.length ? (
                    <select
                      id="upload-event"
                      value={selectedExistingEventSlug}
                      onChange={(event) =>
                        setSelectedExistingEventSlug(event.target.value)
                      }
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
                    >
                      {(album.events as AlbumEvent[]).map((event) => (
                        <option key={event.id} value={event.slug}>
                          {event.name} ({event.photoCount})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex h-11 items-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-500">
                      No events yet
                    </div>
                  )
                ) : (
                  <Input
                    id="new-event-name"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Event name"
                    className="h-11 rounded-2xl border-zinc-200 bg-zinc-50 font-semibold focus:bg-white"
                  />
                )}
              </div>
            </div>
          </div>

          {queuedFiles.length > 0 && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-950">
                  {mediaSummary}
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  Destination: {album.name} / {destinationEventName}
                </p>
              </div>
              <button
                type="button"
                onClick={createEvent}
                disabled={!canCreate}
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploadButtonLabel}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="space-y-6">
          {renderUploadArea("large")}
          {uploadTarget === "existing" && renderSelectedEventPhotos()}
        </div>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-950">Cover photo</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {uploadTarget === "existing"
                    ? selectedExistingEvent?.name || "Select event"
                    : title.trim() || "New event"}
                </p>
              </div>
              {coverFile && (
                <button
                  type="button"
                  onClick={saveCoverOnly}
                  disabled={!canSaveCover}
                  className="flex h-9 items-center gap-2 rounded-full bg-zinc-950 px-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingCover ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageUp className="h-4 w-4" />
                  )}
                  Save
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                chooseCover(event.dataTransfer.files);
              }}
              className="mt-4 flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-zinc-500 transition hover:border-zinc-300 hover:bg-zinc-100"
            >
              {coverPreviewUrl || currentCoverUrl ? (
                <Image
                  src={coverPreviewUrl || currentCoverUrl || ""}
                  alt={coverPreviewUrl ? "Cover preview" : `${destinationEventName} cover`}
                  width={640}
                  height={400}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="flex flex-col items-center gap-2 text-sm font-semibold">
                  <ImageUp className="h-6 w-6" />
                  Add cover
                </span>
              )}
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => chooseCover(event.target.files)}
            />
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-950">Event tools</p>
            {uploadTarget === "existing" && selectedExistingEvent ? (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-zinc-50 p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-zinc-400">
                      Photos
                    </p>
                    <p className="mt-1 text-lg font-semibold text-zinc-900">
                      {selectedEventPhotosData
                        ? selectedEventPhotos.length
                        : selectedExistingEvent.photoCount}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-zinc-400">
                      People
                    </p>
                    <p className="mt-1 text-lg font-semibold text-zinc-900">
                      {selectedExistingEvent.peopleCount}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={deleteSelectedEvent}
                  disabled={isDeletingEvent}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeletingEvent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete Event
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-center text-sm text-zinc-500">
                Choose an existing event to edit event-level settings.
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#4457ff]" />
                <p className="text-sm font-semibold text-zinc-950">
                  AI processing
                </p>
                <span className="group relative inline-flex">
                  <Info className="h-4 w-4 text-zinc-400" />
                  <span className="pointer-events-none absolute right-0 top-6 z-30 w-72 rounded-2xl border border-zinc-200 bg-white p-3 text-left text-xs leading-5 text-zinc-600 opacity-0 shadow-xl transition group-hover:opacity-100">
                    {AI_PRIVACY_MESSAGE}
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setRunAi((current) => !current)}
                role="switch"
                aria-checked={runAi}
                className={`mt-3 flex w-full items-center justify-between gap-4 rounded-2xl border p-3 text-left transition ${
                  runAi
                    ? "border-[#4457ff]/30 bg-[#4457ff]/5"
                    : "border-zinc-200 bg-zinc-50"
                }`}
              >
                <span className="flex min-w-0 items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      runAi
                        ? "bg-[#4457ff] text-white"
                        : "bg-zinc-200 text-zinc-500"
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-zinc-950">
                      Process new uploads with AI
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-zinc-500">
                      Runs the full face and image-text pipeline after photos finish
                      uploading.
                    </span>
                  </span>
                </span>

                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    runAi
                      ? "bg-[#4457ff] text-white"
                      : "bg-white text-zinc-500 ring-1 ring-zinc-200"
                  }`}
                >
                  {runAi ? "Enabled" : "Disabled"}
                </span>
              </button>
            </div>

            <div className="mt-4 border-t border-zinc-100 pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-950">
                    Lambda worker action
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {canRunSelectedEventAi
                      ? `Runs only for ${selectedExistingEvent?.name}.`
                      : "Select an existing event to run these options."}
                  </p>
                </div>
                {canRunSelectedEventAi && (
                  <span className="max-w-[140px] truncate rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                    {selectedExistingEvent?.name}
                  </span>
                )}
              </div>

              {canRunSelectedEventAi ? (
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Select
                      value={selectedAiAction}
                      onValueChange={(value) =>
                        setSelectedAiAction(value as typeof selectedAiAction)
                      }
                      disabled={Boolean(runningAiAction) || isUploading}
                    >
                      <SelectTrigger
                        className="h-11 w-full rounded-xl border-zinc-200 bg-white px-3 shadow-none"
                        aria-label="AI worker action"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {AI_ACTION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => {
                        submitAiAction(
                          selectedAiAction,
                          ALBUM_WIDE_AI_ACTIONS.has(selectedAiAction)
                            ? []
                            : selectedAiEventSlugs,
                          {
                            maxFiles:
                              selectedAiAction === "sample" ? 20 : undefined,
                          },
                        );
                      }}
                      disabled={Boolean(runningAiAction) || isUploading}
                      className="h-11 rounded-xl bg-[#4457ff] px-5 text-white hover:bg-[#3547ee]"
                    >
                      {runningAiAction === selectedAiAction ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {runningAiAction === selectedAiAction ? "Starting" : "Run"}
                    </Button>
                  </div>
                  <p className="mt-2 px-1 text-xs leading-5 text-zinc-500">
                    {selectedAiOption.description}
                  </p>
                  {runningAiAction && (
                    <BorderBeam
                      size={90}
                      duration={5}
                      colorFrom="#4457ff"
                      colorTo="#8b5cf6"
                    />
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-center text-sm text-zinc-500">
                  Switch Upload target to Existing and choose an event.
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Delete all faces, people, text embeddings, and LLM-generated text for this album? Photos and events will remain, and the next AI worker run will regenerate the deleted data.",
                    )
                  ) {
                    return;
                  }

                  submitAiAction("delete_album_ai", []);
                }}
                disabled={Boolean(runningAiAction) || isUploading}
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {runningAiAction === "delete_album_ai" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete faces, embeddings, and LLM text
              </button>

              <button
                type="button"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Reset all AI data for this album and rerun AI processing? This removes current people, faces, captions, and search metadata before submitting RunPod.",
                    )
                  ) {
                    return;
                  }

                  submitAiAction("reset_album_ai", []);
                }}
                disabled={Boolean(runningAiAction) || isUploading}
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {runningAiAction === "reset_album_ai" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Reset all album AI data and rerun
              </button>
            </div>

            {aiJobMessage && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {aiJobMessage}
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}
        </aside>
      </section>
    </main>
    <Dialog
      open={Boolean(previewFile)}
      onOpenChange={(open) => {
        if (!open) setPreviewFile(null);
      }}
    >
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <DialogTitle className="truncate px-5 pt-5 text-sm font-semibold text-zinc-950">
          {previewFile?.file.name}
        </DialogTitle>
        {previewUrl && (
          <div className="flex max-h-[75vh] items-center justify-center bg-zinc-950/5 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={previewFile?.file.name ?? "Preview"}
              className="max-h-[70vh] w-auto rounded-2xl object-contain"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

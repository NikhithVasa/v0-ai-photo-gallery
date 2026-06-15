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
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  AiPrivacyNotice,
  AI_PRIVACY_MESSAGE,
} from "@/components/ai-privacy-notice";
import { AuthAvatarMenu } from "@/components/auth-avatar-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useGoogleImageImport } from "@/hooks/use-google-image-import";
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
  | "process_new"
  | "process_all_new"
  | "sample"
  | "retry_captions"
  | "rebuild_search"
  | "retry_faces"
  | "check_status"
  | "clean_temp"
  | "reset_album_ai";

const PHOTO_UPLOAD_MAX_RETRIES = 3;
const PHOTO_UPLOAD_RETRY_DELAY_MS = 600;
const AI_JOB_WAIT_MESSAGE =
  "This can take a while. You can come back later - we will notify you by email when it is ready.";
const ALBUM_WIDE_AI_ACTIONS = new Set<AiAction>([
  "process_all_new",
  "reset_album_ai",
]);

interface QueuedFile {
  localId: string;
  file: File;
  previewUrl: string;
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

interface AddEventPageProps {
  albumSlug: string;
  initialEventSlug?: string | null;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function statusText(status: UploadStatus) {
  return {
    ready: "Ready",
    uploading: "Uploading",
    uploaded: "Uploaded",
    failed: "Failed",
  }[status];
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function AddEventPage({
  albumSlug,
  initialEventSlug = null,
}: AddEventPageProps) {
  const router = useRouter();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget>(
    initialEventSlug ? "existing" : "new",
  );
  const [selectedExistingEventSlug, setSelectedExistingEventSlug] = useState(
    initialEventSlug ?? "",
  );
  const [runAi, setRunAi] = useState(true);
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
    count: number;
  } | null>(null);
  const coverPreviewUrlRef = useRef<string | null>(null);
  const queuedFilesRef = useRef<QueuedFile[]>([]);
  const {
    googlePhotosButtonLabel,
    importFromGoogleDrive,
    importFromGooglePhotos,
    isImporting: isGoogleImporting,
    isImportingDrive,
    isImportingPhotos,
    message: googleImportMessage,
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
  const uploadedCount = queuedFiles.filter((file) => file.status === "uploaded").length;
  const filesReadyToUpload = queuedFiles.filter(
    (file) => file.status === "ready" || file.status === "failed",
  );
  const selectedExistingEvent = album?.events.find(
    (event) => event.slug === selectedExistingEventSlug,
  );
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
      (uploadTarget === "new" ? title.trim() : selectedExistingEventSlug)
  );

  const uploadButtonLabel =
    uploadTarget === "new" ? "Create event and upload" : "Start upload";
  const mediaSummary = useMemo(() => {
    if (!queuedFiles.length) return "No photos selected";
    if (uploadedCount === queuedFiles.length) return "All photos uploaded";
    return `${queuedFiles.length} photo${queuedFiles.length === 1 ? "" : "s"} selected`;
  }, [queuedFiles.length, uploadedCount]);

  useEffect(() => {
    coverPreviewUrlRef.current = coverPreviewUrl;
  }, [coverPreviewUrl]);

  useEffect(() => {
    queuedFilesRef.current = queuedFiles;
  }, [queuedFiles]);

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
      queuedFilesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const chooseCover = (files: FileList | null) => {
    const file = Array.from(files ?? []).find((item) => item.type.startsWith("image/"));
    if (!file) return;

    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
  };

  const addMediaFiles = (
    files: File[],
    source?: "google-drive" | "google-photos",
  ) => {
    const images = files.filter((file) =>
      file.type.startsWith("image/"),
    );
    if (!images.length) return;

    setQueuedFiles((current) => [
      ...current,
      ...images.map((file) => ({
        localId: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "ready" as UploadStatus,
        source,
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
    setQueuedFiles((current) => {
      const removed = current.find((file) => file.localId === localId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((file) => file.localId !== localId);
    });
  };

  const clearUploadQueue = () => {
    queuedFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
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
    setAiJobMessage(AI_JOB_WAIT_MESSAGE);
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

      const jobLabel = payload.runpod?.id
        ? `${AI_JOB_WAIT_MESSAGE} Job ${payload.runpod.id} has been submitted.`
        : AI_JOB_WAIT_MESSAGE;
      setAiJobMessage(jobLabel);
      toast({
        title: "AI job submitted",
        description: jobLabel,
      });
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
    const eventSlug =
      (uploadTarget === "existing" ? selectedExistingEventSlug : title.trim()) ||
      "cover";
    if (!coverFile || !eventSlug || isSavingCover) return;

    setIsSavingCover(true);
    setErrorMessage("");

    try {
      await uploadCover(eventSlug);
      toast({
        title: "Cover updated",
        description: `${album?.name || "Album"} cover photo was updated.`,
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
      const prepareResponse = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "existing",
          albumSlug,
          eventSlug,
          eventName: uploadTarget === "new" ? eventName : undefined,
          files: filesToUpload.map((item) => ({
            fileName: item.file.name,
            size: item.file.size,
            contentType: item.file.type || "application/octet-stream",
          })),
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

      const completedPhotoIds: string[] = [];

      for (const [index, upload] of prepared.uploads.entries()) {
        const item = filesToUpload[index];
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
          continue;
        }

        completedPhotoIds.push(upload.id);
        completedLocalIds.add(item.localId);
        updateFile(item.localId, { status: "uploaded" });
      }

      if (!completedPhotoIds.length) {
        throw new Error("No photos were uploaded");
      }

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

      await uploadCover(prepared.event.slug);

      if (runAi) {
        try {
          await submitAiAction("process_new", [prepared.event.slug]);
        } catch {
          // submitAiAction already surfaces the error; upload success should remain intact.
        }
      }

      const encodedAlbumSlug = encodeURIComponent(albumSlug);
      const encodedEventSlug = encodeURIComponent(prepared.event.slug);
      await Promise.all([
        mutateAlbum(),
        mutateSWR(`/api/albums/${encodedAlbumSlug}`),
        mutateSWR(`/api/albums/${encodedAlbumSlug}/stats`),
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
        title: "Photos uploaded successfully",
        description: `${completedPhotoIds.length} photo${
          completedPhotoIds.length === 1 ? "" : "s"
        } added to ${prepared.event.name}.`,
      });

      setCompletedUpload({
        eventSlug: prepared.event.slug,
        eventName: prepared.event.name,
        count: completedPhotoIds.length,
      });
      setUploadTarget("existing");
      setSelectedExistingEventSlug(prepared.event.slug);
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
            className={`relative z-10 gap-3 p-4 ${
              isSide ? "columns-2" : "columns-2 sm:columns-3 lg:columns-4"
            }`}
          >
            {queuedFiles.map((item) => (
              <div
                key={item.localId}
                className="group relative mb-3 break-inside-avoid overflow-hidden rounded-[18px] bg-zinc-100 shadow-sm ring-1 ring-zinc-200"
              >
                <Image
                  src={item.previewUrl}
                  alt={item.file.name}
                  width={320}
                  height={420}
                  className="h-auto w-full object-cover"
                  unoptimized
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-3 text-left text-white">
                  <p className="truncate text-xs font-medium">{item.file.name}</p>
                  <p className="text-[11px] text-white/75">
                    {item.error ||
                      (item.source === "google-drive"
                        ? "Google Drive"
                        : item.source === "google-photos"
                          ? "Google Photos"
                          : statusText(item.status))} ·{" "}
                    {formatBytes(item.file.size)}
                  </p>
                </div>
                {item.status === "uploaded" && (
                  <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 rounded-full bg-white text-emerald-600" />
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(item.localId)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-zinc-600 opacity-0 shadow-sm transition hover:text-zinc-950 group-hover:opacity-100"
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
          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
          >
            <span
              className={`mb-5 flex items-center justify-center rounded-full bg-white/90 text-zinc-400 shadow-[0_18px_60px_rgba(24,24,27,0.18)] ring-1 ring-zinc-200 backdrop-blur-xl ${
                isSide ? "h-[72px] w-[72px]" : "h-24 w-24"
              }`}
            >
              <FileImage
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
              Drop or{" "}
              <span className="font-semibold text-[#4457ff]">upload from device</span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            className="absolute right-4 top-4 z-20 flex h-10 items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <Upload className="h-4 w-4" />
            Add Photos
          </button>
        )}

        <input
          ref={mediaInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(event) => addMedia(event.target.files)}
        />
        </div>

        <div className={`grid gap-2 ${isSide ? "grid-cols-1" : "sm:grid-cols-2"}`}>
          <button
            type="button"
            onClick={() => void importFromGoogleDrive()}
            disabled={isUploading || isGoogleImporting}
            className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isImportingDrive ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudDownload className="h-4 w-4" />
            )}
            Upload from Google Drive
          </button>
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
                {photo.thumbnailUrl || photo.previewUrl ? (
                  <Image
                    src={photo.thumbnailUrl || photo.previewUrl || ""}
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
                Add Photos
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
                    {completedUpload.count} photo{completedUpload.count === 1 ? "" : "s"} added to {completedUpload.eventName}
                  </p>
                  <p className="mt-1 text-sm text-emerald-800/80">
                    {runAi
                      ? "AI processing has been submitted for the new uploads."
                      : "AI processing is off for this upload."}
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
              {coverPreviewUrl || album.coverPhotoUrl ? (
                <Image
                  src={coverPreviewUrl || album.coverPhotoUrl || ""}
                  alt={coverPreviewUrl ? "Cover preview" : `${album.name} cover`}
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
                      Creates people, search, and photo intelligence after photos
                      finish uploading.
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
                    Event AI actions
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
                <div className="grid gap-2">
                  {[
                    ["run_event", "Run AI for this event"],
                    ["process_new", "Process new photos only"],
                    ["process_all_new", "Process new photos in all events"],
                    ["sample", "Run sample test on 20 photos"],
                    ["retry_captions", "Retry AI captions"],
                    ["retry_faces", "Retry face detection"],
                    ["rebuild_search", "Rebuild search index"],
                    ["check_status", "Check AI status"],
                    ["clean_temp", "Clean AI temp files"],
                  ].map(([action, label]) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => {
                        submitAiAction(
                          action as AiAction,
                          ALBUM_WIDE_AI_ACTIONS.has(action as AiAction)
                            ? []
                            : selectedAiEventSlugs,
                          {
                            maxFiles: action === "sample" ? 20 : undefined,
                          }
                        );
                      }}
                      disabled={Boolean(runningAiAction) || isUploading}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {runningAiAction === action ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {label}
                    </button>
                  ))}
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
  );
}

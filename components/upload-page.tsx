"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  CloudDownload,
  FileImage,
  Images,
  Link2,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { AiPrivacyNotice } from "@/components/ai-privacy-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthAvatarMenu } from "@/components/auth-avatar-menu";
import { useGoogleImageImport } from "@/hooks/use-google-image-import";
import { asyncGoogleDriveImportEnabled } from "@/lib/feature-flags";
import { photoUploadFileMetadata } from "@/lib/photo-upload-metadata";
import {
  IMAGE_UPLOAD_ACCEPT,
  isSupportedImageFile,
} from "@/lib/image-files";
import type { AlbumDetail, AlbumSummary } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Prepare presigned URLs in batches so uploads start almost immediately on
// large selections instead of waiting for the whole set to be prepared first.
const PREPARE_BATCH_SIZE = 100;
// How many files are uploaded to S3 in parallel.
const UPLOAD_CONCURRENCY = 5;
// Cap how many rows we mount in the DOM. Selecting thousands of files and
// rendering a row each otherwise freezes the main thread; the full set is
// still tracked in state and uploaded.
const MAX_RENDERED_ROWS = 200;

// Simple worker pool: runs `worker` for indices [0, total) with at most
// `concurrency` promises in flight at once.
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

type UploadMode = "existing" | "new";
type EventMode = "existing" | "new";
type UploadStatus =
  | "queued"
  | "uploading"
  | "retrying"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed";
type AiWorkerState =
  | "idle"
  | "starting"
  | "ready"
  | "created"
  | "failed";

interface QueuedFile {
  localId: string;
  file: File;
  status: UploadStatus;
  source?: "google-drive" | "google-photos";
  sourceExternalId?: string;
  sourceModifiedAt?: string;
  s3Key?: string;
  photoId?: string;
  progress?: number;
  attempt?: number;
  error?: string;
}

interface PreparedUpload {
  id: string;
  fileName: string;
  contentType: string;
  originalS3Key: string;
  uploadUrl?: string;
  skipped?: boolean;
}

interface PreparedUploadsResponse {
  error?: string;
  album?: { id: string; slug: string; name: string };
  event?: { id: string; slug: string; name: string };
  uploads?: PreparedUpload[];
}

interface UploadFileRequest {
  fileName: string;
  size: number;
  contentType: string;
  originalTakenAt?: string | null;
  sourceProvider?: "google-drive" | "google-photos";
  sourceExternalId?: string;
  sourceModifiedAt?: string;
}

interface ProcessingStatusResponse {
  photos?: Array<{
    photoId: string;
    status: "uploaded" | "processing" | "ready" | "failed";
  }>;
  summary?: {
    total: number;
    readyCount: number;
    failedCount: number;
    processingCount: number;
  };
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status: UploadStatus) {
  return {
    queued: "Queued",
    uploading: "Uploading",
    retrying: "Retrying upload",
    uploaded: "Uploaded",
    processing: "Processing",
    ready: "Ready",
    failed: "Failed",
  }[status];
}

function StatusIcon({ status }: { status: UploadStatus }) {
  if (status === "ready") {
    return <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />;
  }

  if (status === "failed") {
    return <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />;
  }

  if (status === "uploading" || status === "retrying" || status === "processing") {
    return <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />;
  }

  if (status === "uploaded") {
    return <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />;
  }

  return <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />;
}

function statusDetail(file: QueuedFile) {
  if (file.error) return file.error;
  if (file.status === "retrying") {
    return `Retrying upload... Attempt ${file.attempt ?? 2} of 3`;
  }
  if (file.status === "uploading") {
    return typeof file.progress === "number"
      ? `Uploading ${file.progress}%`
      : "Uploading...";
  }
  if (file.status === "uploaded") return "Waiting for processing";
  if (file.status === "processing") return "Processing...";
  if (file.status === "ready") return "Ready";
  if (file.status === "failed") return "Upload failed";
  return "Queued";
}

function uploadToUrl(
  url: string,
  file: File,
  contentType: string,
  onProgress: (progress: number) => void,
) {
  return new Promise<boolean>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.onabort = () => resolve(false);
    xhr.send(file);
  });
}

export function UploadPage() {
  const searchParams = useSearchParams();
  const initialAlbumSlug = searchParams.get("album") || "";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoUploadPendingRef = useRef(false);
  const [mode, setMode] = useState<UploadMode>(initialAlbumSlug ? "existing" : "new");
  const [eventMode, setEventMode] = useState<EventMode>("existing");
  const [selectedAlbumSlug, setSelectedAlbumSlug] = useState(initialAlbumSlug);
  const [selectedEventSlug, setSelectedEventSlug] = useState("");
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newEventName, setNewEventName] = useState("Uploads");
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [aiWorkerState, setAiWorkerState] = useState<AiWorkerState>("idle");
  const [aiWorkerMessage, setAiWorkerMessage] = useState("");
  const [workerContext, setWorkerContext] = useState<{
    albumId: string;
    eventId: string;
    photoIds: string[];
  } | null>(null);
  const queueDriveFolderLink = async (folderLink: string) => {
    const response = await fetch("/api/google-drive-imports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folderLink,
        mode,
        albumSlug: mode === "existing" ? selectedAlbumSlug : undefined,
        albumName: mode === "new" ? newAlbumName.trim() : undefined,
        eventSlug:
          mode === "existing" && eventMode === "existing"
            ? selectedEventSlug
            : undefined,
        eventName:
          mode === "new" || eventMode === "new"
            ? newEventName.trim()
            : undefined,
        runAi: true,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error || "Could not queue the Google Drive folder");
    }

    return (
      payload.message ||
      "Import started. You can add another Drive link now or come back later."
    );
  };
  const [processingSummary, setProcessingSummary] = useState<{
    total: number;
    readyCount: number;
    failedCount: number;
    processingCount: number;
  } | null>(null);
  const {
    googleDriveFolderLink,
    googlePhotosButtonLabel,
    importFromGoogleDrive,
    importFromGoogleDriveLink,
    importFromGooglePhotos,
    isImporting,
    isImportingDrive,
    isImportingPhotos,
    message: googleImportMessage,
    setGoogleDriveFolderLink,
  } = useGoogleImageImport({
    onImages: (images) => {
      autoUploadPendingRef.current = true;
      setQueuedFiles((current) =>
        [
          ...images.map((image) => ({
            localId: crypto.randomUUID(),
            file: image.file,
            source: image.source,
            sourceExternalId:
              image.googleDriveMetadata?.id ?? image.googlePhotosMetadata?.id,
            sourceModifiedAt: image.googleDriveMetadata?.modifiedTime,
            status: "queued" as UploadStatus,
          })),
          ...current,
        ],
      );
    },
    queueDriveFolderLink: asyncGoogleDriveImportEnabled
      ? queueDriveFolderLink
      : undefined,
  });

  const { data: albumsData } = useSWR<{ albums: AlbumSummary[] }>(
    "/api/albums",
    fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );
  const { data: albumData } = useSWR<{ album: AlbumDetail }>(
    mode === "existing" && selectedAlbumSlug
      ? `/api/albums/${encodeURIComponent(selectedAlbumSlug)}`
      : null,
    fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );
  const albums = albumsData?.albums ?? [];
  const events = albumData?.album.events ?? [];
  const uploadedCount = queuedFiles.filter((file) =>
    ["uploaded", "processing", "ready", "uploading", "retrying"].includes(file.status),
  ).length;
  const processingCount = queuedFiles.filter((file) => file.status === "processing").length;
  const batchReadyCount = queuedFiles.filter((file) => file.status === "ready").length;
  const failedCount = queuedFiles.filter((file) => file.status === "failed").length;
  const queuedCount = queuedFiles.filter((file) => file.status === "queued").length;
  const failedFiles = queuedFiles.filter((file) => file.status === "failed");
  const visibleQueuedFiles = queuedFiles.slice(0, MAX_RENDERED_ROWS);
  const hiddenQueuedCount = queuedFiles.length - visibleQueuedFiles.length;
  const uploadPercent = queuedFiles.length
    ? Math.round(
        (queuedFiles.reduce((acc, file) => {
          if (["uploaded", "processing", "ready"].includes(file.status)) return acc + 100;
          if (["uploading", "retrying"].includes(file.status)) return acc + (file.progress ?? 0);
          return acc + 0;
        }, 0) /
          queuedFiles.length),
      )
    : 0;
  const canAutoUpload = Boolean(
    queuedFiles.some((file) => file.status === "queued") &&
      !isUploading &&
      !isImporting &&
      (mode === "new"
        ? newAlbumName.trim() && newEventName.trim()
        : selectedAlbumSlug &&
          (eventMode === "new" ? newEventName.trim() : selectedEventSlug)),
  );

  useEffect(() => {
    if (selectedEventSlug || !events.length || eventMode !== "existing") return;
    setSelectedEventSlug(events[0].slug);
  }, [eventMode, events, selectedEventSlug]);

  useEffect(() => {
    if (!selectedAlbumSlug && albums.length && mode === "existing") {
      setSelectedAlbumSlug(albums[0].slug);
    }
  }, [albums, mode, selectedAlbumSlug]);

  const uploadSummary = useMemo(() => {
    if (!queuedFiles.length) return "No files selected";
    if (batchReadyCount === queuedFiles.length) return "Ready: all photos";
    if (uploadedCount || failedCount) {
      return `Upload: ${uploadedCount} / ${queuedFiles.length} complete — ${uploadPercent}%`;
    }
    return `${queuedFiles.length} queued`;
  }, [
    batchReadyCount,
    failedCount,
    queuedFiles.length,
    uploadPercent,
    uploadedCount,
  ]);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;

    const supportedFiles = Array.from(files).filter(isSupportedImageFile);
    if (!supportedFiles.length) return;
    autoUploadPendingRef.current = true;

    setQueuedFiles((current) =>
      [
        ...supportedFiles.map((file) => ({
          localId: crypto.randomUUID(),
          file,
          status: "queued" as UploadStatus,
        })),
        ...current,
      ],
    );
    setMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateFile = (
    localId: string,
    patch: Partial<
      Pick<
        QueuedFile,
        "status" | "s3Key" | "photoId" | "progress" | "attempt" | "error"
      >
    >,
  ) => {
    setQueuedFiles((current) =>
      current.map((item) => (item.localId === localId ? { ...item, ...patch } : item))
    );
  };

  const clearCompleted = () => {
    setQueuedFiles((current) =>
      current.filter(
        (file) =>
          !["uploaded", "processing", "ready"].includes(file.status),
      ),
    );
  };

  const removeFile = (localId: string) => {
    setQueuedFiles((current) =>
      current.filter((file) => file.localId !== localId),
    );
  };

  const pollProcessingStatus = async (photoIds: string[]) => {
    const response = await fetch("/api/uploads/processing-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds }),
    });
    const payload = (await response.json().catch(() => ({}))) as
      | (ProcessingStatusResponse & { error?: string })
      | { error?: string };

    if (!response.ok) {
      throw new Error(payload.error || "Could not load processing status");
    }

    if (!("photos" in payload) || !payload.photos) return;

    setProcessingSummary(payload.summary ?? null);
    setQueuedFiles((current) =>
      current.map((item) => {
        if (!item.photoId) return item;
        const status = payload.photos?.find(
          (photo) => photo.photoId === item.photoId,
        )?.status;
        if (!status) return item;
        if (status === "failed") {
          return { ...item, status: "failed", error: "Processing failed" };
        }
        return {
          ...item,
          status: status as UploadStatus,
          error: undefined,
        };
      }),
    );
  };

  const startAiWorker = async (context = workerContext) => {
    if (!context) return;

    setAiWorkerState("starting");
    setAiWorkerMessage("Starting AI worker...");

    try {
      const response = await fetch("/api/start-ai-worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumId: context.albumId,
          eventId: context.eventId,
          mode: "new_photos_only",
          fullMode: true,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        action?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "AI worker failed to start");
      }

      if (payload.action === "created_new_endpoint") {
        setAiWorkerState("created");
        setAiWorkerMessage("AI worker created. Deployment updating...");
      } else {
        setAiWorkerState("ready");
        setAiWorkerMessage("AI worker ready. Processing photos...");
      }

      await pollProcessingStatus(context.photoIds);
    } catch (error) {
      setAiWorkerState("failed");
      setAiWorkerMessage(
        error instanceof Error ? error.message : "AI worker failed to start",
      );
    }
  };

  const uploadFiles = async (localIds?: string[]) => {
    const targetIds = localIds ? new Set(localIds) : null;
    const filesToUpload = queuedFiles.filter(
      (item) =>
        (item.status === "queued" || item.status === "failed") &&
        (!targetIds || targetIds.has(item.localId))
    );
    if (!filesToUpload.length) return;

    setIsUploading(true);
    setMessage("");
    setAiWorkerState("idle");
    setAiWorkerMessage("");
    setProcessingSummary(null);
    filesToUpload.forEach((item) =>
      updateFile(item.localId, {
        status: "queued",
        error: undefined,
        progress: 0,
        attempt: 1,
      })
    );

    const uploadPreparedFile = async (
      item: QueuedFile,
      upload: PreparedUpload,
      uploadUrl: string,
    ): Promise<string | null> => {
      let uploadSucceeded = false;
      let lastError = "S3 upload failed";

      for (let attempt = 1; attempt <= 3; attempt++) {
        updateFile(item.localId, {
          status: attempt === 1 ? "uploading" : "retrying",
          s3Key: upload.originalS3Key,
          photoId: upload.id,
          progress: 0,
          attempt,
        });

        uploadSucceeded = await uploadToUrl(
          uploadUrl,
          item.file,
          upload.contentType,
          (progress) => updateFile(item.localId, { progress }),
        );

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
            if (!uploadSucceeded) {
              const fallbackPayload = (await fallbackResponse
                .json()
                .catch(() => ({}))) as { error?: string };
              lastError = fallbackPayload.error || lastError;
            }
          } catch {
            uploadSucceeded = false;
          }
        }

        if (uploadSucceeded) break;
        if (attempt < 3) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1_000 * 2 ** (attempt - 1)),
          );
        }
      }

      if (!uploadSucceeded) {
        updateFile(item.localId, {
          status: "failed",
          progress: 0,
          error: lastError,
        });
        return null;
      }

      updateFile(item.localId, {
        status: "uploaded",
        photoId: upload.id,
        progress: 100,
        error: undefined,
      });
      return upload.id;
    };

    const completedPhotoIds: string[] = [];
    const completedLocalIds = new Set<string>();
    let skippedPhotoCount = 0;
    let album: PreparedUploadsResponse["album"];
    let event: PreparedUploadsResponse["event"];

    try {
      for (
        let start = 0;
        start < filesToUpload.length;
        start += PREPARE_BATCH_SIZE
      ) {
        const batch = filesToUpload.slice(start, start + PREPARE_BATCH_SIZE);
        const batchFiles: UploadFileRequest[] = [];
        await runWithConcurrency(
          batch.length,
          UPLOAD_CONCURRENCY,
          async (index) => {
            const item = batch[index];
            if (!item) return;
            batchFiles[index] = {
              ...(await photoUploadFileMetadata(item.file)),
              sourceProvider: item.source,
              sourceExternalId: item.sourceExternalId,
              sourceModifiedAt: item.sourceModifiedAt,
            };
          },
        );

        // After the first batch, reference the album/event the server returned
        // so we never re-create them and each batch can start uploading as soon
        // as its presigned URLs arrive.
        const requestBody =
          album && event
            ? {
                mode: "existing" as UploadMode,
                albumSlug: album.slug,
                eventSlug: event.slug,
                files: batchFiles,
              }
            : {
                mode,
                albumSlug: mode === "existing" ? selectedAlbumSlug : undefined,
                albumName: mode === "new" ? newAlbumName.trim() : undefined,
                eventSlug:
                  mode === "existing" && eventMode === "existing"
                    ? selectedEventSlug
                    : undefined,
                eventName:
                  mode === "new" || eventMode === "new"
                    ? newEventName.trim()
                    : undefined,
                files: batchFiles,
              };

        const prepareResponse = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const prepared = (await prepareResponse.json()) as PreparedUploadsResponse;

        if (!prepareResponse.ok || !prepared.uploads?.length) {
          throw new Error(prepared.error || "Could not prepare uploads");
        }

        if (!album || !event) {
          album = prepared.album;
          event = prepared.event;
        }

        const uploads = prepared.uploads;
        await runWithConcurrency(uploads.length, UPLOAD_CONCURRENCY, async (index) => {
          const item = batch[index];
          const upload = uploads[index];
          if (!item || !upload) return;
          if (upload.skipped) {
            skippedPhotoCount += 1;
            completedLocalIds.add(item.localId);
            updateFile(item.localId, {
              status: "uploaded",
              photoId: upload.id,
              progress: 100,
              error: undefined,
            });
            return;
          }
          if (!upload.uploadUrl) return;
          const photoId = await uploadPreparedFile(item, upload, upload.uploadUrl);
          if (photoId) {
            completedPhotoIds.push(photoId);
            completedLocalIds.add(item.localId);
          }
        });
      }

      if (completedPhotoIds.length) {
        const completeResponse = await fetch("/api/uploads/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoIds: completedPhotoIds }),
        });
        if (!completeResponse.ok) {
          const completePayload = (await completeResponse
            .json()
            .catch(() => ({}))) as { error?: string };
          throw new Error(completePayload.error || "Could not complete uploads");
        }

        setQueuedFiles((current) =>
          current.map((item) =>
            item.photoId && completedPhotoIds.includes(item.photoId)
              ? { ...item, status: "processing" as UploadStatus }
              : item,
          ),
        );
      }

      if (!completedPhotoIds.length && skippedPhotoCount) {
        setMessage(
          `${skippedPhotoCount} photo${skippedPhotoCount === 1 ? " was" : "s were"} already imported. Nothing new to upload.`,
        );
        return;
      }

      if (!completedPhotoIds.length) {
        setMessage("Upload failed. Retry upload.");
        return;
      }

      setMessage(
        `Upload complete: ${completedPhotoIds.length} new, ${skippedPhotoCount} already imported.`,
      );

      if (album?.id && event?.id) {
        const context = {
          albumId: album.id,
          eventId: event.id,
          photoIds: completedPhotoIds,
        };
        setWorkerContext(context);
        await startAiWorker(context);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed unexpectedly";
      setMessage(errorMessage);
      filesToUpload.forEach((item) => {
        if (completedLocalIds.has(item.localId)) return;
        updateFile(item.localId, { status: "failed", error: errorMessage });
      });
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (!autoUploadPendingRef.current || !canAutoUpload) return;

    autoUploadPendingRef.current = false;
    void uploadFiles();
  }, [canAutoUpload, uploadFiles]);

  useEffect(() => {
    if (!workerContext?.photoIds.length) return;
    if (!["ready", "created"].includes(aiWorkerState)) return;
    if (
      processingSummary &&
      processingSummary.readyCount + processingSummary.failedCount >=
        processingSummary.total
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void pollProcessingStatus(workerContext.photoIds).catch((error) => {
        console.error("Failed to poll processing status:", error);
      });
    }, 4000);

    return () => window.clearInterval(interval);
  }, [aiWorkerState, processingSummary, workerContext]);

  return (
    <main className="h-[100svh] overflow-hidden bg-[#fbfaf8] text-zinc-950">
      <div className="mx-auto flex h-full max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="mb-4 flex min-w-0 shrink-0 items-center justify-between gap-3 sm:mb-6">
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
                Upload
              </p>
              <h1 className="truncate text-2xl font-semibold sm:text-4xl">
                Add Photos
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isImporting}
              className="shrink-0 rounded-full px-3 sm:px-4"
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Add photos
            </Button>
            <AuthAvatarMenu />
          </div>
        </header>

        <div className="grid min-h-0 min-w-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-5">
          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="flex min-w-0 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Files</h2>
                <p className="truncate text-xs text-zinc-500">{uploadSummary}</p>
              </div>
              {uploadedCount > 0 && (
                <button
                  type="button"
                  onClick={clearCompleted}
                  className="rounded-full px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                >
                  Clear uploaded
                </button>
              )}
            </div>

            {queuedFiles.length > 0 && (
              <div className="shrink-0 border-b border-zinc-200 bg-zinc-50/70 px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-zinc-600">
                  <span>
                    Upload: {uploadedCount} / {queuedFiles.length} complete
                  </span>
                  <span>{uploadPercent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className="h-full rounded-full bg-zinc-950 transition-[width] duration-300"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
                {(uploadedCount > 0 || processingSummary) && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-zinc-600">
                    <span>
                      Processing:{" "}
                      {processingSummary?.readyCount ?? batchReadyCount} /{" "}
                      {processingSummary?.total ?? uploadedCount} ready
                    </span>
                    {processingCount > 0 && (
                      <span>{processingCount} processing</span>
                    )}
                  </div>
                )}
                {aiWorkerMessage && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm text-zinc-700 ring-1 ring-zinc-200">
                    <span className="min-w-0 truncate">{aiWorkerMessage}</span>
                    {aiWorkerState === "failed" && workerContext && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void startAiWorker()}
                        disabled={isUploading}
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {failedFiles.length > 0 && (
              <div className="shrink-0 border-b border-rose-100 bg-rose-50/70 px-4 py-3">
                <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-rose-700">
                      Failed uploads
                    </p>
                    <p className="text-xs text-rose-600">
                      {failedFiles.length} photo{failedFiles.length === 1 ? "" : "s"} need retry
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => uploadFiles(failedFiles.map((file) => file.localId))}
                    disabled={isUploading}
                  >
                    Retry failed
                  </Button>
                </div>
                <div className="space-y-1">
                  {failedFiles.map((item) => (
                    <div
                      key={item.localId}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-800">
                          {item.file.name}
                        </p>
                        {item.error && (
                          <p className="truncate text-xs text-rose-600">
                            {item.error}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => uploadFiles([item.localId])}
                        disabled={isUploading}
                      >
                        Retry
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {queuedFiles.length === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
                <div>
                  <FileImage className="mx-auto mb-3 h-9 w-9 text-zinc-300" />
                  <p className="text-sm font-medium text-zinc-700">
                    Selected file names will appear here.
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Choose photos from the upload panel on the right.
                  </p>
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                <div className="space-y-2">
                  {visibleQueuedFiles.map((item) => (
                    <div
                      key={item.localId}
                      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <StatusIcon status={item.status} />
                          <p className="truncate text-sm font-medium leading-5">
                            {item.file.name}
                          </p>
                        </div>
                        <p className="mt-1 truncate pl-5 text-xs text-zinc-500">
                          {`${
                            item.source === "google-drive"
                              ? "Google Drive · "
                              : item.source === "google-photos"
                                ? "Google Photos · "
                                : ""
                          }${formatBytes(item.file.size)}`}
                        </p>
                        <p
                          className={`mt-1 truncate pl-5 text-xs ${
                            item.status === "failed"
                              ? "text-rose-600"
                              : "text-zinc-500"
                          }`}
                        >
                          {statusDetail(item)}
                        </p>
                      </div>
                      <div className="flex max-w-[38vw] flex-col items-end gap-1 self-center sm:max-w-none">
                        {item.status === "failed" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => uploadFiles([item.localId])}
                            disabled={isUploading}
                          >
                            Retry
                          </Button>
                        )}
                        {(item.status === "queued" || item.status === "failed") && (
                          <button
                            type="button"
                            onClick={() => removeFile(item.localId)}
                            disabled={isUploading}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Remove ${item.file.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <span className="max-w-full truncate rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                          {statusLabel(item.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {hiddenQueuedCount > 0 && (
                    <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-3 py-2.5 text-center text-xs text-zinc-500">
                      + {hiddenQueuedCount} more file{hiddenQueuedCount === 1 ? "" : "s"} not shown
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className="min-h-0 min-w-0 space-y-4 overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-sm">
            <div>
              <p className="text-sm font-semibold">Destination</p>
              <p className="mt-1 text-xs text-zinc-500">
                Originals upload into the album event originals folder.
              </p>
              <AiPrivacyNotice className="mt-3 bg-zinc-50/80" />
              {queuedFiles.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium">Upload progress</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {uploadedCount} / {queuedFiles.length} uploaded · {uploadPercent}%
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-full bg-zinc-100 p-1">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`h-8 rounded-full text-sm font-medium transition ${
                  mode === "existing"
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-zinc-500"
                }`}
              >
                Existing
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("new");
                  setEventMode("new");
                }}
                className={`h-8 rounded-full text-sm font-medium transition ${
                  mode === "new"
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-zinc-500"
                }`}
              >
                New
              </button>
            </div>

            {mode === "existing" ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  Album
                  <select
                    value={selectedAlbumSlug}
                    onChange={(event) => {
                      setSelectedAlbumSlug(event.target.value);
                      setSelectedEventSlug("");
                      setEventMode("existing");
                    }}
                    className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-zinc-400"
                  >
                    {albums.map((album) => (
                      <option key={album.id} value={album.slug}>
                        {album.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2 rounded-full bg-zinc-100 p-1">
                  <button
                    type="button"
                    onClick={() => setEventMode("existing")}
                    className={`h-8 rounded-full text-sm font-medium transition ${
                      eventMode === "existing"
                        ? "bg-white text-zinc-950 shadow-sm"
                        : "text-zinc-500"
                    }`}
                  >
                    Event
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventMode("new")}
                    className={`h-8 rounded-full text-sm font-medium transition ${
                      eventMode === "new"
                        ? "bg-white text-zinc-950 shadow-sm"
                        : "text-zinc-500"
                    }`}
                  >
                    New event
                  </button>
                </div>

                {eventMode === "existing" ? (
                  <label className="block text-sm font-medium">
                    Event
                    <select
                      value={selectedEventSlug}
                      onChange={(event) => setSelectedEventSlug(event.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-zinc-400"
                    >
                      {events.map((event) => (
                        <option key={event.id} value={event.slug}>
                          {event.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="block text-sm font-medium">
                    Event name
                    <Input
                      value={newEventName}
                      onChange={(event) => setNewEventName(event.target.value)}
                      className="mt-1"
                      placeholder="Reception"
                    />
                  </label>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  Album name
                  <Input
                    value={newAlbumName}
                    onChange={(event) => setNewAlbumName(event.target.value)}
                    className="mt-1"
                    placeholder="Kavya Wedding"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Event name
                  <Input
                    value={newEventName}
                    onChange={(event) => setNewEventName(event.target.value)}
                    className="mt-1"
                    placeholder="Wedding"
                  />
                </label>
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
              }}
              className="flex min-h-48 w-full flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 text-center transition hover:border-zinc-400 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <Upload className="mb-3 h-8 w-8 text-zinc-400" />
              <span className="text-sm font-medium">Upload from device</span>
              <span className="mt-1 text-xs text-zinc-500">
                Drag images here or click to browse.
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={IMAGE_UPLOAD_ACCEPT}
              className="hidden"
              onChange={(event) => addFiles(event.target.files)}
            />

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setMessage("");
                void importFromGoogleDrive();
              }}
              disabled={isImportingDrive || isImportingPhotos || isUploading}
              title="Select images, or select one folder to import every image inside it."
            >
              {isImportingDrive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudDownload className="h-4 w-4" />
              )}
              Upload from Google Drive
            </Button>

            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                setMessage("");
                void importFromGoogleDriveLink();
              }}
            >
              <Input
                type="url"
                value={googleDriveFolderLink}
                onChange={(event) => setGoogleDriveFolderLink(event.target.value)}
                placeholder="Paste public Google Drive folder link"
                aria-label="Public Google Drive folder link"
                disabled={isImportingDrive || isImportingPhotos || isUploading}
              />
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={
                  isImportingDrive ||
                  isImportingPhotos ||
                  isUploading ||
                  !googleDriveFolderLink.trim()
                }
              >
                {isImportingDrive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Import Drive link
              </Button>
            </form>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setMessage("");
                void importFromGooglePhotos();
              }}
              disabled={isImportingPhotos || isImportingDrive || isUploading}
            >
              {isImportingPhotos ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Images className="h-4 w-4" />
              )}
              {googlePhotosButtonLabel}
            </Button>

            {(message || googleImportMessage) && (
              <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
                {message || googleImportMessage}
              </p>
            )}

            {queuedCount > 0 && (
              <p className="text-xs text-zinc-500">
                {queuedCount} queued for upload
              </p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

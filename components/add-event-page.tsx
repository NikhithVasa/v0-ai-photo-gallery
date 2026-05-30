"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  CheckCircle2,
  FileImage,
  ImageUp,
  Info,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
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
  | "sample"
  | "retry_captions"
  | "rebuild_search"
  | "retry_faces"
  | "check_status"
  | "clean_temp";

interface QueuedFile {
  localId: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
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

export function AddEventPage({ albumSlug }: AddEventPageProps) {
  const router = useRouter();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget>("new");
  const [selectedExistingEventSlug, setSelectedExistingEventSlug] = useState("");
  const [runAi, setRunAi] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [runningAiAction, setRunningAiAction] = useState<AiAction | null>(null);
  const [aiJobMessage, setAiJobMessage] = useState("");
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [deletingPhotoIds, setDeletingPhotoIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const coverPreviewUrlRef = useRef<string | null>(null);
  const queuedFilesRef = useRef<QueuedFile[]>([]);

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
  const canCreate = Boolean(
    filesReadyToUpload.length &&
      !isUploading &&
      (uploadTarget === "new" ? title.trim() : selectedExistingEventSlug),
  );
  const canSaveCover = Boolean(
    coverFile &&
      !isUploading &&
      !isSavingCover &&
      (uploadTarget === "existing" ? selectedExistingEventSlug : title.trim())
  );

  const eventTitle =
    uploadTarget === "existing"
      ? selectedExistingEvent?.name || "Select an event"
      : title.trim() || "Add a Title";
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
    if (selectedExistingEventSlug || !album?.events.length) return;
    setSelectedExistingEventSlug(album.events[0].slug);
  }, [album?.events, selectedExistingEventSlug]);

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

  const addMedia = (files: FileList | null) => {
    const images = Array.from(files ?? []).filter((file) =>
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
      })),
    ]);
    setErrorMessage("");
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  const removeMedia = (localId: string) => {
    setQueuedFiles((current) => {
      const removed = current.find((file) => file.localId === localId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((file) => file.localId !== localId);
    });
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
    if (!eventSlugs.length || runningAiAction) return;

    setRunningAiAction(action);
    setAiJobMessage("");
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
        ? `Job ${payload.runpod.id} submitted.`
        : "AI job submitted.";
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
    uploadTarget === "existing" && selectedExistingEventSlug
      ? [selectedExistingEventSlug]
      : album?.events.map((event) => event.slug) ?? [];

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
      uploadTarget === "existing" ? selectedExistingEventSlug : title.trim();
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

        try {
          const uploadResponse = await fetch(upload.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": upload.contentType },
            body: item.file,
          });
          uploadSucceeded = uploadResponse.ok;
        } catch {
          uploadSucceeded = false;
        }

        if (!uploadSucceeded) {
          const fallbackResponse = await fetch(
            `/api/uploads/${encodeURIComponent(upload.id)}/file`,
            {
              method: "PUT",
              headers: { "Content-Type": upload.contentType },
              body: item.file,
            },
          );
          uploadSucceeded = fallbackResponse.ok;
        }

        if (!uploadSucceeded) {
          updateFile(item.localId, {
            status: "failed",
            error: "S3 upload failed",
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

      if (!completeResponse.ok) {
        throw new Error("Photos uploaded, but completion failed");
      }

      await uploadCover(prepared.event.slug);

      if (runAi) {
        try {
          await submitAiAction("process_new", [prepared.event.slug]);
        } catch {
          // submitAiAction already surfaces the error; upload success should remain intact.
        }
      }

      toast({
        title: "Photos uploaded successfully",
        description: `${completedPhotoIds.length} photo${
          completedPhotoIds.length === 1 ? "" : "s"
        } added to ${prepared.event.name}.`,
      });

      router.push(
        `/albums/${encodeURIComponent(albumSlug)}?event=${encodeURIComponent(
          prepared.event.slug,
        )}`,
      );
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Event upload failed unexpectedly";
      setErrorMessage(message);
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

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-[#fbfaf8]/88 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
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
                {uploadTarget === "new" ? "New event" : "Add photos"}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={createEvent}
            disabled={!canCreate}
            className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploadTarget === "new" ? "Create" : "Upload"}
          </button>
        </div>
      </header>

      <section
        className="relative min-h-[430px] border-b border-zinc-200 bg-white"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          chooseCover(event.dataTransfer.files);
        }}
      >
        {coverPreviewUrl && (
          <Image
            src={coverPreviewUrl}
            alt="Event cover preview"
            fill
            sizes="100vw"
            className="object-cover"
            unoptimized
          />
        )}
        {coverPreviewUrl && <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px]" />}

        <div className="relative z-10 mx-auto flex min-h-[430px] max-w-5xl flex-col items-center justify-center px-5 pt-10 text-center">
          {uploadTarget === "new" ? (
            <>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Add a Title"
                aria-label="Event title"
                className="w-full border-0 bg-transparent text-center text-6xl font-bold tracking-normal text-zinc-700 outline-none placeholder:text-zinc-500 sm:text-7xl"
              />
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Add a description"
                aria-label="Event description"
                className="mt-4 w-full border-0 bg-transparent text-center text-3xl font-normal tracking-normal text-zinc-500 outline-none placeholder:text-zinc-400 sm:text-4xl"
              />
            </>
          ) : (
            <>
              <h1 className="text-5xl font-bold tracking-normal text-zinc-700 sm:text-7xl">
                Add photos
              </h1>
              <p className="mt-4 text-3xl text-zinc-500 sm:text-4xl">
                {selectedExistingEvent?.name || "Select an event"}
              </p>
            </>
          )}

          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="group absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/80 hover:text-zinc-950 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
            aria-label="Drop or select cover photo"
          >
            <ImageUp className="h-4 w-4" strokeWidth={1.6} />
            <span>Drop or</span>
            <span className="text-zinc-600 group-hover:text-zinc-950">
              Select Cover
            </span>
          </button>
          {coverFile && (
            <button
              type="button"
              onClick={saveCoverOnly}
              disabled={!canSaveCover}
              className="absolute bottom-6 right-6 flex h-10 items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingCover ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageUp className="h-4 w-4" />
              )}
              Save Cover
            </button>
          )}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => chooseCover(event.target.files)}
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div
          className="relative min-h-[520px] overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_28px_80px_rgba(24,24,27,0.08)]"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addMedia(event.dataTransfer.files);
          }}
        >
          <div className="pointer-events-none absolute inset-0 grid grid-cols-4 gap-7 p-8 opacity-60">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className={`rounded-[18px] border border-zinc-200 bg-zinc-50 ${
                  index % 3 === 0 ? "row-span-2" : ""
                }`}
              />
            ))}
          </div>

          {queuedFiles.length > 0 && (
            <div className="relative z-10 columns-2 gap-3 p-4 sm:columns-3 lg:columns-4">
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
                      {statusText(item.status)} · {formatBytes(item.file.size)}
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
              <span className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-white/90 text-zinc-400 shadow-[0_18px_60px_rgba(24,24,27,0.18)] ring-1 ring-zinc-200 backdrop-blur-xl">
                <FileImage className="h-12 w-12" strokeWidth={1.4} />
              </span>
              <span className="text-4xl font-bold tracking-normal text-zinc-900">
                Upload Media
              </span>
              <span className="mt-3 text-2xl text-zinc-400">
                Drop or{" "}
                <span className="font-semibold text-[#4457ff]">Select Source</span>
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

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-950">Destination</p>
            <p className="mt-1 text-sm text-zinc-500">
              {uploadTarget === "new" ? `${eventTitle} will be added to` : `${eventTitle} in`}{" "}
              {album.customer?.name || album.name}. Photos upload to the event
              originals folder in S3.
            </p>
            <div className="mt-4 rounded-2xl bg-zinc-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-400">
                Media
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-800">{mediaSummary}</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-950">Upload target</p>
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-zinc-100 p-1">
              <button
                type="button"
                onClick={() => setUploadTarget("new")}
                className={`h-9 rounded-full text-sm font-semibold transition ${
                  uploadTarget === "new"
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-zinc-500"
                }`}
              >
                New event
              </button>
              <button
                type="button"
                onClick={() => setUploadTarget("existing")}
                className={`h-9 rounded-full text-sm font-semibold transition ${
                  uploadTarget === "existing"
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-zinc-500"
                }`}
              >
                Existing
              </button>
            </div>

            {uploadTarget === "existing" && (
              <div className="mt-4 space-y-3">
                <select
                  value={selectedExistingEventSlug}
                  onChange={(event) =>
                    setSelectedExistingEventSlug(event.target.value)
                  }
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
                  aria-label="Select existing event"
                >
                  {(album.events as AlbumEvent[]).map((event) => (
                    <option key={event.id} value={event.slug}>
                      {event.name}
                    </option>
                  ))}
                </select>

                {selectedExistingEvent && (
                  <>
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

                    <div className="rounded-[20px] border border-zinc-200 bg-zinc-50 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-900">
                          Event photos
                        </p>
                        {selectedEventPhotosLoading && (
                          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                        )}
                      </div>

                      {!selectedEventPhotosLoading &&
                        selectedEventPhotosError && (
                          <p className="py-6 text-center text-sm text-rose-600">
                            {selectedEventPhotosError instanceof Error
                              ? selectedEventPhotosError.message
                              : "Could not load event photos."}
                          </p>
                        )}

                      {!selectedEventPhotosLoading &&
                        !selectedEventPhotosError &&
                        selectedEventPhotos.length === 0 && (
                          <p className="py-6 text-center text-sm text-zinc-500">
                            No photos in this event yet.
                          </p>
                        )}

                      {selectedEventPhotos.length > 0 && (
                        <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1">
                          {selectedEventPhotos.map((photo) => {
                            const isDeleting = deletingPhotoIds.includes(photo.id);

                            return (
                              <div
                                key={photo.id}
                                className="group relative aspect-square overflow-hidden rounded-xl bg-zinc-200"
                              >
                                {photo.thumbnailUrl || photo.previewUrl ? (
                                  <Image
                                    src={photo.thumbnailUrl || photo.previewUrl || ""}
                                    alt={photo.fileName || "Event photo"}
                                    fill
                                    sizes="96px"
                                    className="object-cover"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-zinc-400">
                                    <FileImage className="h-5 w-5" />
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={() => deletePhoto(photo)}
                                  disabled={isDeleting}
                                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-rose-600 opacity-0 shadow-sm transition hover:bg-rose-50 disabled:opacity-80 group-hover:opacity-100"
                                  aria-label={`Delete ${photo.fileName || "photo"}`}
                                >
                                  {isDeleting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#4457ff]" />
                  <p className="text-sm font-semibold text-zinc-950">Run images to AI</p>
                  <span className="group relative inline-flex">
                    <Info className="h-4 w-4 text-zinc-400" />
                    <span className="pointer-events-none absolute right-0 top-6 z-30 w-72 rounded-2xl border border-zinc-200 bg-white p-3 text-left text-xs leading-5 text-zinc-600 opacity-0 shadow-xl transition group-hover:opacity-100">
                      AI runs on local servers. It will not be used to train models,
                      the data will never leak, and we will never sell it to a 3rd party.
                    </span>
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Creates people, search, and photo intelligence for this event.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRunAi((current) => !current)}
                aria-pressed={runAi}
                className={`relative h-7 w-12 rounded-full transition ${
                  runAi ? "bg-[#4457ff]" : "bg-zinc-200"
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                    runAi ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {[
                ["run_event", "Run AI for Event"],
                ["process_new", "Process New Photos Only"],
                ["sample", "Run Sample Test on 20 Photos"],
                ["retry_captions", "Retry AI Captions"],
                ["retry_faces", "Retry Face Detection"],
                ["rebuild_search", "Rebuild Search Index"],
                ["check_status", "Check AI Status"],
                ["clean_temp", "Clean AI Temp Files"],
              ].map(([action, label]) => (
                <button
                  key={action}
                  type="button"
                  onClick={() =>
                    submitAiAction(action as AiAction, selectedAiEventSlugs, {
                      maxFiles: action === "sample" ? 20 : undefined,
                    })
                  }
                  disabled={
                    !selectedAiEventSlugs.length ||
                    Boolean(runningAiAction) ||
                    isUploading
                  }
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

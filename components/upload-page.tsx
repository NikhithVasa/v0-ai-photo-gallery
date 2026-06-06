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
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthAvatarMenu } from "@/components/auth-avatar-menu";
import { useGoogleImageImport } from "@/hooks/use-google-image-import";
import type { AlbumDetail, AlbumSummary } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type UploadMode = "existing" | "new";
type EventMode = "existing" | "new";
type UploadStatus = "ready" | "preparing" | "uploading" | "uploaded" | "failed";

interface QueuedFile {
  localId: string;
  file: File;
  status: UploadStatus;
  source?: "google-drive" | "google-photos";
  s3Key?: string;
  error?: string;
}

interface PreparedUpload {
  id: string;
  fileName: string;
  contentType: string;
  originalS3Key: string;
  uploadUrl: string;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status: UploadStatus) {
  return {
    ready: "Ready",
    preparing: "Preparing",
    uploading: "Uploading",
    uploaded: "Uploaded",
    failed: "Failed",
  }[status];
}

function StatusIcon({ status }: { status: UploadStatus }) {
  if (status === "uploaded") {
    return <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />;
  }

  if (status === "failed") {
    return <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />;
  }

  if (status === "preparing" || status === "uploading") {
    return <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />;
  }

  return <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />;
}

export function UploadPage() {
  const searchParams = useSearchParams();
  const initialAlbumSlug = searchParams.get("album") || "";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<UploadMode>(initialAlbumSlug ? "existing" : "new");
  const [eventMode, setEventMode] = useState<EventMode>("existing");
  const [selectedAlbumSlug, setSelectedAlbumSlug] = useState(initialAlbumSlug);
  const [selectedEventSlug, setSelectedEventSlug] = useState("");
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newEventName, setNewEventName] = useState("Uploads");
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const {
    googlePhotosButtonLabel,
    importFromGoogleDrive,
    importFromGooglePhotos,
    isImporting,
    isImportingDrive,
    isImportingPhotos,
    message: googleImportMessage,
  } = useGoogleImageImport({
    onImages: (images) => {
      setQueuedFiles((current) => [
        ...images.map((image) => ({
          localId: crypto.randomUUID(),
          file: image.file,
          source: image.source,
          status: "ready" as UploadStatus,
        })),
        ...current,
      ]);
    },
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
  const uploadedCount = queuedFiles.filter((file) => file.status === "uploaded").length;
  const failedCount = queuedFiles.filter((file) => file.status === "failed").length;
  const readyCount = queuedFiles.filter((file) => file.status === "ready").length;
  const failedFiles = queuedFiles.filter((file) => file.status === "failed");
  const canUpload = Boolean(
    queuedFiles.some((file) => file.status === "ready" || file.status === "failed") &&
    !isUploading &&
    !isImporting &&
    (mode === "new"
      ? newAlbumName.trim() && newEventName.trim()
      : selectedAlbumSlug &&
        (eventMode === "new" ? newEventName.trim() : selectedEventSlug))
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
    if (uploadedCount === queuedFiles.length) return "All files uploaded";
    if (failedCount) return `${failedCount} failed, ${uploadedCount} uploaded`;
    return `${queuedFiles.length} selected`;
  }, [failedCount, queuedFiles.length, uploadedCount]);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;

    const nextFiles = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        localId: crypto.randomUUID(),
        file,
        status: "ready" as UploadStatus,
      }));

    setQueuedFiles((current) => [...nextFiles, ...current]);
    setMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateFile = (
    localId: string,
    patch: Partial<Pick<QueuedFile, "status" | "s3Key" | "error">>
  ) => {
    setQueuedFiles((current) =>
      current.map((item) => (item.localId === localId ? { ...item, ...patch } : item))
    );
  };

  const clearCompleted = () => {
    setQueuedFiles((current) => current.filter((file) => file.status !== "uploaded"));
  };

  const uploadFiles = async (localIds?: string[]) => {
    const targetIds = localIds ? new Set(localIds) : null;
    const filesToUpload = queuedFiles.filter(
      (item) =>
        (item.status === "ready" || item.status === "failed") &&
        (!targetIds || targetIds.has(item.localId))
    );
    if (!filesToUpload.length) return;

    setIsUploading(true);
    setMessage("");
    filesToUpload.forEach((item) =>
      updateFile(item.localId, { status: "preparing", error: undefined })
    );

    try {
      const prepareResponse = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          albumSlug: mode === "existing" ? selectedAlbumSlug : undefined,
          albumName: mode === "new" ? newAlbumName.trim() : undefined,
          eventSlug:
            mode === "existing" && eventMode === "existing"
              ? selectedEventSlug
              : undefined,
          eventName:
            mode === "new" || eventMode === "new" ? newEventName.trim() : undefined,
          files: filesToUpload.map((item) => ({
            fileName: item.file.name,
            size: item.file.size,
            contentType: item.file.type || "application/octet-stream",
          })),
        }),
      });

      const prepared = (await prepareResponse.json()) as {
        error?: string;
        uploads?: PreparedUpload[];
      };

      if (!prepareResponse.ok || !prepared.uploads?.length) {
        throw new Error(prepared.error || "Could not prepare uploads");
      }

      const completedPhotoIds: string[] = [];

      for (const [index, upload] of prepared.uploads.entries()) {
        const item = filesToUpload[index];
        updateFile(item.localId, {
          status: "uploading",
          s3Key: upload.originalS3Key,
        });

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
        updateFile(item.localId, { status: "uploaded" });
      }

      if (completedPhotoIds.length) {
        await fetch("/api/uploads/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoIds: completedPhotoIds }),
        });
      }

      setMessage(
        `${completedPhotoIds.length} of ${filesToUpload.length} files uploaded.`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed unexpectedly";
      setMessage(errorMessage);
      filesToUpload.forEach((item) => {
        updateFile(item.localId, { status: "failed", error: errorMessage });
      });
    } finally {
      setIsUploading(false);
    }
  };

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
              onClick={() => uploadFiles()}
              disabled={!canUpload}
              className="shrink-0 rounded-full px-3 sm:px-4"
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload
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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {queuedFiles.map((item) => (
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
                          {item.s3Key ||
                            `${
                              item.source === "google-drive"
                                ? "Google Drive · "
                                : item.source === "google-photos"
                                  ? "Google Photos · "
                                  : ""
                            }${formatBytes(item.file.size)}`}
                        </p>
                        {item.error && (
                          <p className="mt-1 truncate pl-5 text-xs text-rose-600">
                            {item.error}
                          </p>
                        )}
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
                        <span className="max-w-full truncate rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                          {statusLabel(item.status)}
                        </span>
                      </div>
                    </div>
                  ))}
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
              accept="image/*"
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
            >
              {isImportingDrive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudDownload className="h-4 w-4" />
              )}
              Upload from Google Drive
            </Button>

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

            {readyCount > 0 && (
              <p className="text-xs text-zinc-500">
                {readyCount} ready to upload
              </p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

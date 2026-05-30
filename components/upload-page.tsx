"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  CheckCircle2,
  FileImage,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AlbumDetail, AlbumSummary } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type UploadMode = "existing" | "new";
type EventMode = "existing" | "new";
type UploadStatus = "ready" | "preparing" | "uploading" | "uploaded" | "failed";

interface QueuedFile {
  localId: string;
  file: File;
  status: UploadStatus;
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
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }

  if (status === "failed") {
    return <XCircle className="h-4 w-4 text-rose-600" />;
  }

  if (status === "preparing" || status === "uploading") {
    return <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />;
  }

  return <FileImage className="h-4 w-4 text-zinc-400" />;
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
  const canUpload = Boolean(
    queuedFiles.some((file) => file.status === "ready" || file.status === "failed") &&
    !isUploading &&
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

  const uploadFiles = async () => {
    const filesToUpload = queuedFiles.filter(
      (item) => item.status === "ready" || item.status === "failed"
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
    <main className="min-h-screen bg-[#fbfaf8] text-zinc-950">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-4">
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

          <Button
            onClick={uploadFiles}
            disabled={!canUpload}
            className="rounded-full px-4"
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload
          </Button>
        </header>

        <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="min-h-[60vh] rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Files</h2>
                <p className="text-xs text-zinc-500">{uploadSummary}</p>
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

            {queuedFiles.length === 0 ? (
              <div className="flex h-[50vh] items-center justify-center px-6 text-center">
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
              <div className="divide-y divide-zinc-100">
                {queuedFiles.map((item) => (
                  <div
                    key={item.localId}
                    className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <StatusIcon status={item.status} />
                        <p className="truncate text-sm font-medium">
                          {item.file.name}
                        </p>
                      </div>
                      <p className="mt-1 truncate pl-6 text-xs text-zinc-500">
                        {item.s3Key || formatBytes(item.file.size)}
                      </p>
                      {item.error && (
                        <p className="mt-1 pl-6 text-xs text-rose-600">
                          {item.error}
                        </p>
                      )}
                    </div>
                    <span className="self-center rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                      {statusLabel(item.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
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
              <span className="text-sm font-medium">Choose photos</span>
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

            {message && (
              <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
                {message}
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

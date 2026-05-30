"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { ImageUp, Loader2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AlbumCoverEditorProps {
  albumSlug: string;
  albumName: string;
  currentCoverUrl: string | null | undefined;
  onCoverUpdated: (newUrl: string) => void;
  onClose: () => void;
}

export function AlbumCoverEditor({
  albumSlug,
  albumName,
  currentCoverUrl,
  onCoverUpdated,
  onClose,
}: AlbumCoverEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = Array.from(event.target.files ?? []).find((f) =>
      f.type.startsWith("image/")
    );

    if (!file) {
      setError("Please select a valid image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    setError("");
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    const fileInput = fileInputRef.current;
    const file = fileInput?.files?.[0];

    if (!file || !previewUrl) {
      setError("No file selected");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      // Step 1: Request upload URL
      const uploadRequestResponse = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/cover`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            size: file.size,
            contentType: file.type || "application/octet-stream",
          }),
        }
      );

      const uploadRequest = (await uploadRequestResponse.json()) as {
        error?: string;
        uploadUrl?: string;
      };

      if (!uploadRequestResponse.ok || !uploadRequest.uploadUrl) {
        throw new Error(
          uploadRequest.error || "Failed to get upload URL"
        );
      }

      // Step 2: Upload file to S3
      const uploadResponse = await fetch(uploadRequest.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed (${uploadResponse.status})`);
      }

      // Clear preview and file input
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      toast({
        title: "Cover updated",
        description: `${albumName} cover photo has been updated.`,
      });

      onCoverUpdated(previewUrl || currentCoverUrl || "");
      onClose();
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to upload cover";
      setError(errorMsg);
      toast({
        title: "Upload failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-950">
            Edit Album Cover
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          {/* Current Cover Preview */}
          {currentCoverUrl && !previewUrl && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
              <Image
                src={currentCoverUrl}
                alt={albumName}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}

          {/* New Cover Preview */}
          {previewUrl && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
              <Image
                src={previewUrl}
                alt="Preview"
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-sm font-medium text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImageUp className="h-5 w-5" />
            {previewUrl ? "Change Image" : "Choose Image"}
          </button>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!previewUrl || isUploading}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Save Cover"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

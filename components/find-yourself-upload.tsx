"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Upload } from "lucide-react";

export interface FaceMatch {
  personId: string;
  similarity?: number;
}

export interface SelfieMatchedPhoto {
  id: string;
  fileName: string | null;
  eventSlug: string;
  similarity: number | null;
  vectorDistance: number | null;
}

export interface FindPeopleBySelfieResult {
  matches: FaceMatch[];
  matchedPhoto: SelfieMatchedPhoto | null;
}

interface FindPeopleBySelfieOptions {
  albumSlug: string;
  shareToken?: string;
  selectedEventSlug?: string | null;
  image: File;
}

interface MatchPayload {
  error?: string;
  matchedPhoto?: SelfieMatchedPhoto | null;
  matches?: Array<{
    personId?: string;
    person_id?: string;
    similarity?: number;
  }>;
  personIds?: string[];
}

export async function findPeopleBySelfie({
  albumSlug,
  shareToken = "",
  selectedEventSlug,
  image,
}: FindPeopleBySelfieOptions): Promise<FindPeopleBySelfieResult> {
  const params = new URLSearchParams();
  if (selectedEventSlug) params.set("event", selectedEventSlug);
  if (shareToken) params.set("share", shareToken);

  const formData = new FormData();
  formData.set("image", image);

  const query = params.toString();
  const response = await fetch(
    `/api/albums/${encodeURIComponent(albumSlug)}/people/match${
      query ? `?${query}` : ""
    }`,
    {
      method: "POST",
      body: formData,
    },
  );
  const payload = (await response.json().catch(() => ({}))) as MatchPayload;

  if (!response.ok) {
    throw new Error(payload.error || "Could not search for this person.");
  }

  const matches =
    payload.matches
      ?.map((match) => ({
        personId: match.personId || match.person_id || "",
        similarity: match.similarity,
      }))
      .filter((match) => match.personId) ??
    payload.personIds?.map((personId) => ({ personId })) ??
    [];

  return {
    matches,
    matchedPhoto: payload.matchedPhoto ?? null,
  };
}

interface FindYourselfUploadProps {
  isSubmitting: boolean;
  error: string;
  onErrorChange: (error: string) => void;
  onSubmit: (file: File) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  submittingLabel?: string;
  compact?: boolean;
}

export function FindYourselfUpload({
  isSubmitting,
  error,
  onErrorChange,
  onSubmit,
  onCancel,
  submitLabel = "Find matches",
  submittingLabel = "Finding matches...",
  compact = false,
}: FindYourselfUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const selectFile = (file: File | null) => {
    onErrorChange("");

    if (!file) {
      setSelectedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      onErrorChange("Choose a JPG, PNG, WebP, or HEIC photo.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      onErrorChange("Choose an image smaller than 10 MB.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const submit = () => {
    if (!selectedFile || isSubmitting) return;
    onErrorChange("");
    void onSubmit(selectedFile);
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isSubmitting}
        className={`group relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-zinc-300 bg-zinc-50 transition hover:border-zinc-400 hover:bg-zinc-100 disabled:cursor-wait ${
          compact ? "h-36" : "aspect-[4/3]"
        }`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Selected portrait preview"
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <span className="flex flex-col items-center gap-2 px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-zinc-700 shadow-sm ring-1 ring-zinc-200">
              <Upload className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium text-zinc-800">
              Choose a selfie or portrait
            </span>
            <span className="text-xs text-zinc-500">
              JPG, PNG, WebP, or HEIC · up to 10 MB
            </span>
          </span>
        )}
      </button>

      {previewUrl ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isSubmitting}
          className="text-sm font-medium text-zinc-600 transition hover:text-zinc-950 disabled:opacity-40"
        >
          Choose a different photo
        </button>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}

      <p className="text-xs leading-5 text-zinc-500">
        This compares the whole image, so a similar background, outfit, and
        moment can improve the match.
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:text-zinc-950 disabled:opacity-40"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          onClick={submit}
          disabled={!selectedFile || isSubmitting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {submittingLabel}
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" />
              {submitLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
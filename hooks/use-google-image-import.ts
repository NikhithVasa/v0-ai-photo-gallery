"use client";

import { useEffect, useRef, useState } from "react";
import {
  downloadGoogleDriveImage,
  pickGoogleDriveImages,
  prepareGoogleDrivePicker,
  type GoogleDriveFileMetadata,
} from "@/lib/google-drive-picker";
import {
  completeGooglePhotosPickerSession,
  createGooglePhotosPickerSession,
  deleteGooglePhotosPickerSession,
  downloadGooglePhotosImage,
  openGooglePhotosPickerPlaceholder,
  prepareGooglePhotosPicker,
  type GooglePhotosMediaItem,
  type GooglePhotosPickerSessionHandle,
} from "@/lib/google-photos-picker";

const GOOGLE_DRIVE_DOWNLOAD_CONCURRENCY = 4;
const MAX_IMPORT_ERROR_MESSAGES = 5;

export interface GoogleImportedImage {
  file: File;
  source: "google-drive" | "google-photos";
  googleDriveMetadata?: GoogleDriveFileMetadata;
  googlePhotosMetadata?: GooglePhotosMediaItem;
}

interface UseGoogleImageImportOptions {
  onImages: (images: GoogleImportedImage[]) => void;
}

type GoogleDriveDownloadResult =
  | { image: GoogleImportedImage; error?: never }
  | { image?: never; error: string };

function summarizeImportErrors(errors: string[]) {
  if (!errors.length) return "";

  const visibleErrors = errors.slice(0, MAX_IMPORT_ERROR_MESSAGES);
  const remainingCount = errors.length - visibleErrors.length;
  return `${errors.length} could not be read: ${visibleErrors.join("; ")}${
    remainingCount > 0 ? `; and ${remainingCount} more.` : ""
  }`;
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(concurrency, 1), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index], index);
      }
    }),
  );

  return results;
}

export function useGoogleImageImport({
  onImages,
}: UseGoogleImageImportOptions) {
  const [message, setMessage] = useState("");
  const [isImportingDrive, setIsImportingDrive] = useState(false);
  const [isImportingPhotos, setIsImportingPhotos] = useState(false);
  const [googlePhotosSession, setGooglePhotosSession] =
    useState<GooglePhotosPickerSessionHandle | null>(null);
  const googlePhotosSessionRef =
    useRef<GooglePhotosPickerSessionHandle | null>(null);

  useEffect(() => {
    googlePhotosSessionRef.current = googlePhotosSession;
  }, [googlePhotosSession]);

  useEffect(() => {
    void Promise.all([
      prepareGoogleDrivePicker(),
      prepareGooglePhotosPicker(),
    ]).catch(() => {
      // Import actions surface configuration or loading errors when clicked.
    });

    return () => {
      const session = googlePhotosSessionRef.current;
      if (session?.session.id) {
        void deleteGooglePhotosPickerSession(
          session.session.id,
          session.accessToken,
        ).catch(() => undefined);
      }
    };
  }, []);

  const importFromGoogleDrive = async () => {
    if (isImportingDrive || isImportingPhotos) return;

    setIsImportingDrive(true);
    setMessage("Choose Google Drive images or a folder...");

    try {
      const selection = await pickGoogleDriveImages();
      if (!selection.files.length) {
        setMessage(
          selection.summary.folderCount
            ? "No Google Drive images found in the selected folder."
            : "No Google Drive images selected.",
        );
        return;
      }

      const importedImages: GoogleImportedImage[] = [];
      const failedFiles: string[] = [];
      let completedFiles = 0;
      const concurrentDownloads = Math.min(
        GOOGLE_DRIVE_DOWNLOAD_CONCURRENCY,
        selection.files.length,
      );

      setMessage(
        `Found ${selection.files.length} Google Drive image${
          selection.files.length === 1 ? "" : "s"
        }. Reading with ${concurrentDownloads} concurrent download${
          concurrentDownloads === 1 ? "" : "s"
        }...`,
      );

      const downloadResults = await mapConcurrent<
        GoogleDriveFileMetadata,
        GoogleDriveDownloadResult
      >(
        selection.files,
        GOOGLE_DRIVE_DOWNLOAD_CONCURRENCY,
        async (selectedFile) => {
          try {
            const downloaded = await downloadGoogleDriveImage(
              selectedFile,
              selection.accessToken,
            );

            return {
              image: {
                file: downloaded.file,
                source: "google-drive" as const,
                googleDriveMetadata: downloaded.metadata,
              },
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : `${selectedFile.name} failed`;
            return {
              error: errorMessage.includes(selectedFile.name)
                ? errorMessage
                : `${selectedFile.name}: ${errorMessage}`,
            };
          } finally {
            completedFiles += 1;
            setMessage(
              `Read ${completedFiles} of ${selection.files.length} from Google Drive...`,
            );
          }
        },
      );

      for (const result of downloadResults) {
        if (result.image) {
          importedImages.push(result.image);
          continue;
        }

        failedFiles.push(result.error);
      }

      if (importedImages.length) onImages(importedImages);

      const notes = [
        `${importedImages.length} Google Drive image${
          importedImages.length === 1 ? "" : "s"
        } ready.`,
        selection.summary.folderCount
          ? `Scanned ${selection.summary.folderCount} folder${
              selection.summary.folderCount === 1 ? "" : "s"
            }.`
          : "",
        summarizeImportErrors(failedFiles),
      ].filter(Boolean);
      setMessage(notes.join(" "));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not import images from Google Drive",
      );
    } finally {
      setIsImportingDrive(false);
    }
  };

  const importFromGooglePhotos = async () => {
    if (isImportingPhotos || isImportingDrive) return;

    setIsImportingPhotos(true);
    setMessage("");
    let completedSession: { id: string; accessToken: string } | null = null;
    let pickerWindow: Window | null = null;

    try {
      let activeSession = googlePhotosSession;
      if (!activeSession) {
        setMessage("Preparing Google Photos Picker...");
        pickerWindow = openGooglePhotosPickerPlaceholder();
        activeSession = await createGooglePhotosPickerSession();
      }

      setGooglePhotosSession(null);
      googlePhotosSessionRef.current = null;
      setMessage("Waiting for your Google Photos selection...");
      const selection = await completeGooglePhotosPickerSession(
        activeSession,
        pickerWindow,
      );
      completedSession = {
        id: selection.sessionId,
        accessToken: selection.accessToken,
      };

      const selectedImages = selection.mediaItems.filter((item) =>
        item.mediaFile.mimeType.startsWith("image/"),
      );
      const skippedVideos = selection.mediaItems.length - selectedImages.length;

      if (!selectedImages.length) {
        setMessage(
          skippedVideos
            ? "No images selected. Videos are not supported by the current upload pipeline."
            : "No Google Photos images selected.",
        );
        return;
      }

      const importedImages: GoogleImportedImage[] = [];
      const failedFiles: string[] = [];

      for (const [index, mediaItem] of selectedImages.entries()) {
        setMessage(
          `Reading ${index + 1} of ${selectedImages.length} from Google Photos...`,
        );

        try {
          const downloaded = await downloadGooglePhotosImage(
            mediaItem,
            selection.accessToken,
          );
          importedImages.push({
            file: downloaded.file,
            source: "google-photos",
            googlePhotosMetadata: downloaded.metadata,
          });
        } catch (error) {
          failedFiles.push(
            error instanceof Error
              ? error.message
              : `${mediaItem.mediaFile.filename} failed`,
          );
        }
      }

      if (importedImages.length) onImages(importedImages);

      const notes = [
        `${importedImages.length} Google Photos image${
          importedImages.length === 1 ? "" : "s"
        } ready.`,
        skippedVideos
          ? `${skippedVideos} video${skippedVideos === 1 ? " was" : "s were"} skipped.`
          : "",
        summarizeImportErrors(failedFiles),
      ].filter(Boolean);
      setMessage(notes.join(" "));
    } catch (error) {
      if (pickerWindow && !pickerWindow.closed) {
        pickerWindow.close();
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not import images from Google Photos",
      );
    } finally {
      if (completedSession) {
        await deleteGooglePhotosPickerSession(
          completedSession.id,
          completedSession.accessToken,
        ).catch(() => undefined);
      }
      setIsImportingPhotos(false);
    }
  };

  return {
    googlePhotosButtonLabel: googlePhotosSession
      ? "Continue in Google Photos"
      : "Upload from Google Photos",
    importFromGoogleDrive,
    importFromGooglePhotos,
    isImportingDrive,
    isImportingPhotos,
    isImporting: isImportingDrive || isImportingPhotos,
    message,
  };
}

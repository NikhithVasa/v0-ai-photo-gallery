"use client";

import { useEffect, useRef, useState } from "react";
import {
  downloadPublicGoogleDriveImage,
  downloadGoogleDriveImage,
  importPublicGoogleDriveFolder,
  pickGoogleDriveImages,
  prepareGoogleDrivePicker,
  type DownloadedGoogleDriveFile,
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
  const [googleDriveFolderLink, setGoogleDriveFolderLink] = useState("");
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

  const importGoogleDriveFiles = async ({
    files,
    summary,
    emptyMessage,
    downloadImage,
  }: {
    files: GoogleDriveFileMetadata[];
    summary: { folderCount: number };
    emptyMessage: string;
    downloadImage: (file: GoogleDriveFileMetadata) => Promise<DownloadedGoogleDriveFile>;
  }) => {
    if (!files.length) {
      setMessage(emptyMessage);
      return false;
    }

    const importedImages: GoogleImportedImage[] = [];
    const failedFiles: string[] = [];
    let completedFiles = 0;
    const concurrentDownloads = Math.min(
      GOOGLE_DRIVE_DOWNLOAD_CONCURRENCY,
      files.length,
    );

    setMessage(
      `Found ${files.length} Google Drive image${
        files.length === 1 ? "" : "s"
      }. Reading with ${concurrentDownloads} concurrent download${
        concurrentDownloads === 1 ? "" : "s"
      }...`,
    );

    const downloadResults = await mapConcurrent<
      GoogleDriveFileMetadata,
      GoogleDriveDownloadResult
    >(
      files,
      GOOGLE_DRIVE_DOWNLOAD_CONCURRENCY,
      async (selectedFile) => {
        try {
          const downloaded = await downloadImage(selectedFile);

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
            `Read ${completedFiles} of ${files.length} from Google Drive...`,
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
      summary.folderCount
        ? `Scanned ${summary.folderCount} folder${
            summary.folderCount === 1 ? "" : "s"
          }.`
        : "",
      summarizeImportErrors(failedFiles),
    ].filter(Boolean);
    setMessage(notes.join(" "));
    return importedImages.length > 0;
  };

  const importFromGoogleDrive = async () => {
    if (isImportingDrive || isImportingPhotos) return;

    setIsImportingDrive(true);
    setMessage("Choose Google Drive images or a folder...");

    try {
      const selection = await pickGoogleDriveImages();
      await importGoogleDriveFiles({
        files: selection.files,
        summary: selection.summary,
        emptyMessage: selection.summary.folderCount
          ? "No Google Drive images found in the selected folder."
          : "No Google Drive images selected.",
        downloadImage: (selectedFile) =>
          downloadGoogleDriveImage(selectedFile, selection.accessToken),
      });
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

  const importFromGoogleDriveLink = async () => {
    if (isImportingDrive || isImportingPhotos) return;

    const folderLink = googleDriveFolderLink.trim();
    if (!folderLink) {
      setMessage("Paste a public Google Drive folder link first.");
      return;
    }

    setIsImportingDrive(true);
    setMessage("Reading public Google Drive folder...");

    try {
      const selection = await importPublicGoogleDriveFolder(folderLink);
      const importedAny = await importGoogleDriveFiles({
        files: selection.files,
        summary: selection.summary,
        emptyMessage: "No Google Drive images found in the public folder.",
        downloadImage: (selectedFile) =>
          downloadPublicGoogleDriveImage(selectedFile, selection.apiKey),
      });

      if (importedAny) setGoogleDriveFolderLink("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not import images from the Google Drive link",
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
    googleDriveFolderLink,
    importFromGoogleDrive,
    importFromGoogleDriveLink,
    importFromGooglePhotos,
    isImportingDrive,
    isImportingPhotos,
    isImporting: isImportingDrive || isImportingPhotos,
    message,
    setGoogleDriveFolderLink,
  };
}

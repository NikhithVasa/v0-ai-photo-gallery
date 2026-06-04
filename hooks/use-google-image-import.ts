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
  prepareGooglePhotosPicker,
  type GooglePhotosMediaItem,
  type GooglePhotosPickerSessionHandle,
} from "@/lib/google-photos-picker";

export interface GoogleImportedImage {
  file: File;
  source: "google-drive" | "google-photos";
  googleDriveMetadata?: GoogleDriveFileMetadata;
  googlePhotosMetadata?: GooglePhotosMediaItem;
}

interface UseGoogleImageImportOptions {
  onImages: (images: GoogleImportedImage[]) => void;
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
    setMessage("");

    try {
      const selection = await pickGoogleDriveImages();
      if (!selection.files.length) {
        setMessage("No Google Drive images selected.");
        return;
      }

      const importedImages: GoogleImportedImage[] = [];
      const failedFiles: string[] = [];

      for (const [index, selectedFile] of selection.files.entries()) {
        setMessage(
          `Reading ${index + 1} of ${selection.files.length} from Google Drive...`,
        );

        try {
          const downloaded = await downloadGoogleDriveImage(
            selectedFile,
            selection.accessToken,
          );
          importedImages.push({
            file: downloaded.file,
            source: "google-drive",
            googleDriveMetadata: downloaded.metadata,
          });
        } catch (error) {
          failedFiles.push(
            error instanceof Error ? error.message : `${selectedFile.name} failed`,
          );
        }
      }

      if (importedImages.length) onImages(importedImages);

      const importedLabel = `${importedImages.length} Google Drive image${
        importedImages.length === 1 ? "" : "s"
      } ready.`;
      setMessage(
        failedFiles.length
          ? `${importedLabel} ${failedFiles.length} could not be read: ${failedFiles.join(
              "; ",
            )}`
          : importedLabel,
      );
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

    try {
      if (!googlePhotosSession) {
        setMessage("Preparing Google Photos Picker...");
        const preparedSession = await createGooglePhotosPickerSession();
        setGooglePhotosSession(preparedSession);
        setMessage(
          "Google Photos is ready. Click Continue in Google Photos to choose images.",
        );
        return;
      }

      const activeSession = googlePhotosSession;
      setGooglePhotosSession(null);
      googlePhotosSessionRef.current = null;
      setMessage("Waiting for your Google Photos selection...");
      const selection = await completeGooglePhotosPickerSession(activeSession);
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
        failedFiles.length
          ? `${failedFiles.length} could not be read: ${failedFiles.join("; ")}`
          : "",
      ].filter(Boolean);
      setMessage(notes.join(" "));
    } catch (error) {
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

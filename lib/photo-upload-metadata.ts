import { parse } from "exifr";

const CAPTURE_TIME_TAGS = [
  "DateTimeOriginal",
  "CreateDate",
  "DateTimeDigitized",
  "DateCreated",
  "ModifyDate",
  "DateTime",
];

function isoDateValue(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value !== "string") return null;

  const normalizedExifDate = value
    .trim()
    .replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3")
    .replace(" ", "T");
  const parsed = Date.parse(normalizedExifDate);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function fileLastModifiedIso(file: File) {
  if (!Number.isFinite(file.lastModified) || file.lastModified <= 0) return null;
  return new Date(file.lastModified).toISOString();
}

export async function photoOriginalTakenAt(file: File) {
  try {
    const metadata = (await parse(file, { pick: CAPTURE_TIME_TAGS })) as
      | Record<string, unknown>
      | undefined;

    for (const tag of CAPTURE_TIME_TAGS) {
      const value = isoDateValue(metadata?.[tag]);
      if (value) return value;
    }
  } catch {
    // Some formats do not expose readable EXIF in the browser.
  }

  return fileLastModifiedIso(file);
}

export async function photoUploadFileMetadata(file: File) {
  return {
    fileName: file.name,
    size: file.size,
    contentType: file.type || "application/octet-stream",
    originalTakenAt: await photoOriginalTakenAt(file),
  };
}
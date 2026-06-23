// Image formats accepted by the AI workers. Browsers often report an empty
// `file.type` for RAW formats (NEF, CR2, ...), so we also match by extension.
export const SUPPORTED_IMAGE_EXTENSIONS = [
  ".jpg", ".jpeg", ".jpe", ".png", ".webp", ".heic", ".heif",
  ".nef", ".cr2", ".arw", ".dng", ".tif", ".tiff",
  ".bmp", ".gif", ".avif", ".jfif",
];

// Value for an <input type="file"> accept attribute. Listing the explicit
// extensions keeps RAW files selectable in the OS file picker, which greys
// them out when only `image/*` is provided.
export const IMAGE_UPLOAD_ACCEPT = ["image/*", ...SUPPORTED_IMAGE_EXTENSIONS].join(",");

// Formats a browser can render in an <img> tag. RAW/TIFF/HEIC cannot be
// previewed, so callers should fall back to a placeholder icon instead.
const BROWSER_PREVIEWABLE_EXTENSIONS = [
  ".jpg", ".jpeg", ".jpe", ".png", ".webp", ".gif", ".bmp", ".avif", ".jfif",
];

export function isSupportedImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  const name = file.name.toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function canPreviewImageFile(file: File) {
  const name = file.name.toLowerCase();
  return BROWSER_PREVIEWABLE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function previewObjectUrl(file: File) {
  return canPreviewImageFile(file) ? URL.createObjectURL(file) : undefined;
}

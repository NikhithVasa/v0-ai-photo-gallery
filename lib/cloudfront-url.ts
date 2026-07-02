const CLOUDFRONT_IMAGES_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_CLOUDFRONT_IMAGES === "true";

const CLOUDFRONT_IMAGE_BASE_URL =
  process.env.NEXT_PUBLIC_CLOUDFRONT_IMAGE_BASE_URL?.replace(/\/+$/, "");

const IMAGE_EXTENSION_PATTERN = /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|svg|tiff?|webp)$/i;

function encodeS3KeyPath(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function isImageKey(key: string) {
  return IMAGE_EXTENSION_PATTERN.test(key.split("?")[0] || key);
}

export function cloudFrontImageUrl(key?: string | null) {
  if (!key || !isImageKey(key) || !CLOUDFRONT_IMAGES_ENABLED || !CLOUDFRONT_IMAGE_BASE_URL) {
    return null;
  }

  return `${CLOUDFRONT_IMAGE_BASE_URL}/${encodeS3KeyPath(key)}`;
}

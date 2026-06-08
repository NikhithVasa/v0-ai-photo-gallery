const CLOUDFRONT_IMAGE_BASE_URL =
  process.env.NEXT_PUBLIC_CLOUDFRONT_IMAGE_BASE_URL?.replace(/\/+$/, "");

function encodeS3KeyPath(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function cloudFrontImageUrl(key?: string | null) {
  if (!key || !CLOUDFRONT_IMAGE_BASE_URL) return null;

  return `${CLOUDFRONT_IMAGE_BASE_URL}/${encodeS3KeyPath(key)}`;
}

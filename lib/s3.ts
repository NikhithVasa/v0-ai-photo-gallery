import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cloudFrontImageUrl } from "@/lib/cloudfront-url";

const globalForS3 = globalThis as unknown as {
  s3Client: S3Client | undefined;
  signedUrlCache: Map<string, { url: string; expiresAt: number }> | undefined;
  s3ListCache: Map<string, { keys: string[]; expiresAt: number }> | undefined;
  s3StatsCache: Map<string, { bytes: number; objectCount: number; expiresAt: number }> | undefined;
};

export const s3 =
  globalForS3.s3Client ??
  new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

if (process.env.NODE_ENV !== "production") globalForS3.s3Client = s3;

const signedUrlCache =
  globalForS3.signedUrlCache ?? new Map<string, { url: string; expiresAt: number }>();
const s3ListCache =
  globalForS3.s3ListCache ?? new Map<string, { keys: string[]; expiresAt: number }>();
const s3StatsCache =
  globalForS3.s3StatsCache ?? new Map<string, { bytes: number; objectCount: number; expiresAt: number }>();

if (process.env.NODE_ENV !== "production") {
  globalForS3.signedUrlCache = signedUrlCache;
  globalForS3.s3ListCache = s3ListCache;
  globalForS3.s3StatsCache = s3StatsCache;
}

const SIGNED_URL_SECONDS = 60 * 60;
const SIGNED_URL_CACHE_MS = 55 * 60 * 1000;
const S3_LIST_CACHE_MS = 5 * 60 * 1000;
const FORCE_CLOUDFRONT_IMAGES =
  process.env.NEXT_PUBLIC_FORCE_CLOUDFRONT_IMAGES === "true" ||
  process.env.FORCE_CLOUDFRONT_IMAGES === "true";

function encodeRfc5987Value(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function asciiDownloadFilename(value: string) {
  const fallback = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_")
    .replace(/[\x00-\x1F\x7F]+/g, "_")
    .trim();

  return fallback || "download";
}

function downloadContentDisposition(filename?: string) {
  if (!filename) return "attachment";

  return `attachment; filename="${asciiDownloadFilename(filename)}"; filename*=UTF-8''${encodeRfc5987Value(filename)}`;
}

async function cachedSignedUrl(
  cacheKey: string,
  createUrl: () => Promise<string>
) {
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const url = await createUrl();
  signedUrlCache.set(cacheKey, {
    url,
    expiresAt: Date.now() + SIGNED_URL_CACHE_MS,
  });
  return url;
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function clearS3CachesForKey(key: string) {
  signedUrlCache.delete(`object:${key}`);
  for (const cacheKey of signedUrlCache.keys()) {
    if (cacheKey.includes(`:${key}:`) || cacheKey.endsWith(`:${key}`)) {
      signedUrlCache.delete(cacheKey);
    }
  }
  s3ListCache.clear();
  s3StatsCache.clear();
}

export function derivedThumbnailKey(
  originalKey?: string | null,
  thumbnailKey?: string | null
) {
  if (thumbnailKey) return thumbnailKey;
  if (!originalKey) return null;

  const fileName = originalKey.split("/").pop();
  if (!fileName) return null;

  if (process.env.THUMB_PREFIX) {
    return `${withTrailingSlash(process.env.THUMB_PREFIX)}${fileName}`;
  }

  if (originalKey.startsWith("originals/")) {
    return originalKey.replace(/^originals\//, "thumbnails/");
  }

  return null;
}

export async function listS3Keys(prefix?: string | null) {
  if (!prefix) return [];

  const cached = s3ListCache.get(prefix);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }

  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET!,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    keys.push(
      ...(response.Contents ?? [])
        .map((object) => object.Key)
        .filter((key): key is string => Boolean(key && !key.endsWith("/")))
    );
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  s3ListCache.set(prefix, {
    keys,
    expiresAt: Date.now() + S3_LIST_CACHE_MS,
  });
  return keys;
}

export async function s3PrefixStorageStats(prefix?: string | null) {
  if (!prefix) return { bytes: 0, objectCount: 0 };

  const cached = s3StatsCache.get(prefix);
  if (cached && cached.expiresAt > Date.now()) {
    return { bytes: cached.bytes, objectCount: cached.objectCount };
  }

  let bytes = 0;
  let objectCount = 0;
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET!,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const object of response.Contents ?? []) {
      if (!object.Key || object.Key.endsWith("/")) continue;
      objectCount += 1;
      bytes += object.Size ?? 0;
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  s3StatsCache.set(prefix, {
    bytes,
    objectCount,
    expiresAt: Date.now() + S3_LIST_CACHE_MS,
  });

  return { bytes, objectCount };
}

export async function signedUrl(key?: string | null): Promise<string | null> {
  if (!key) return null;

  if (FORCE_CLOUDFRONT_IMAGES) {
    const cloudFrontUrl = cloudFrontImageUrl(key);
    if (cloudFrontUrl) return cloudFrontUrl;
  }

  return `/api/media?key=${encodeURIComponent(key)}`;
}

export async function signedDownloadUrl(
  key?: string | null,
  filename?: string
): Promise<string | null> {
  if (!key) return null;

  return cachedSignedUrl(`download:v2:${key}:${filename ?? ""}`, () => {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      ResponseContentDisposition: downloadContentDisposition(filename),
    });

    return getSignedUrl(s3, command, { expiresIn: SIGNED_URL_SECONDS });
  });
}

export async function signedUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3, command, { expiresIn: SIGNED_URL_SECONDS });
}

export async function signedObjectUrl(key?: string | null): Promise<string | null> {
  if (!key) return null;

  if (FORCE_CLOUDFRONT_IMAGES) {
    const cloudFrontUrl = cloudFrontImageUrl(key);
    if (cloudFrontUrl) return cloudFrontUrl;
  }

  return cachedSignedUrl(`object:${key}`, () => {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    });

    return getSignedUrl(s3, command, { expiresIn: SIGNED_URL_SECONDS });
  });
}

export async function uploadS3Object({
  key,
  body,
  contentType,
  cacheControl,
}: {
  key: string;
  body: Uint8Array | Buffer | string;
  contentType?: string | null;
  cacheControl?: string | null;
}) {
  if (!key) {
    throw new Error("S3 object key is required");
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType ?? undefined,
      CacheControl: cacheControl ?? undefined,
    })
  );

  clearS3CachesForKey(key);
  return key;
}

export async function deleteS3Object(key?: string | null) {
  if (!key) return false;

  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    })
  );

  clearS3CachesForKey(key);
  return true;
}

export async function getS3ObjectBytes(key?: string | null) {
  if (!key) return null;

  const response = await s3.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    })
  );

  const body = response.Body;
  if (!body) return null;

  if ("transformToByteArray" in Object(body)) {
    return {
      bytes: await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray(),
      contentType: response.ContentType ?? null,
    };
  }

  if (Symbol.asyncIterator in Object(body)) {
    const chunks: Uint8Array[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
      chunks.push(
        typeof chunk === "string" ? Buffer.from(chunk) : new Uint8Array(chunk)
      );
    }
    const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      bytes,
      contentType: response.ContentType ?? null,
    };
  }

  return null;
}

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

if (process.env.NODE_ENV !== "production") {
  globalForS3.signedUrlCache = signedUrlCache;
  globalForS3.s3ListCache = s3ListCache;
}

const SIGNED_URL_SECONDS = 60 * 60;
const SIGNED_URL_CACHE_MS = 55 * 60 * 1000;
const S3_LIST_CACHE_MS = 5 * 60 * 1000;

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

export async function signedUrl(key?: string | null): Promise<string | null> {
  if (!key) return null;

  const cloudFrontUrl = cloudFrontImageUrl(key);
  if (cloudFrontUrl) return cloudFrontUrl;

  if (process.env.NEXT_PUBLIC_DIRECT_S3_IMAGES !== "true") {
    return `/api/media?key=${encodeURIComponent(key)}`;
  }

  return cachedSignedUrl(`view:${key}`, () => {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    });

    return getSignedUrl(s3, command, { expiresIn: SIGNED_URL_SECONDS });
  });
}

export async function signedDownloadUrl(
  key?: string | null,
  filename?: string
): Promise<string | null> {
  if (!key) return null;

  return cachedSignedUrl(`download:${key}:${filename ?? ""}`, () => {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      ResponseContentDisposition: filename
        ? `attachment; filename="${filename}"`
        : "attachment",
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

  const cloudFrontUrl = cloudFrontImageUrl(key);
  if (cloudFrontUrl) return cloudFrontUrl;

  return cachedSignedUrl(`object:${key}`, () => {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    });

    return getSignedUrl(s3, command, { expiresIn: SIGNED_URL_SECONDS });
  });
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

export async function uploadS3Object({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Uint8Array;
  contentType: string;
}) {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function deleteS3Object(key?: string | null): Promise<void> {
  if (!key) return;
  if (!key.startsWith("albums/") || key.includes("..") || key.endsWith("/")) {
    return;
  }

  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    })
  );
}

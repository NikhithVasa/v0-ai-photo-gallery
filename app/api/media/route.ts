import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { listS3Keys, s3 } from "@/lib/s3";

function isAllowedMediaKey(value: string) {
  if (!value || value.includes("..") || value.startsWith("/") || value.endsWith("/")) {
    return false;
  }

  const allowedPrefixes = [
    "albums/",
    "customers/",
    process.env.ORIGINAL_PREFIX,
    process.env.AI_INPUT_PREFIX,
    process.env.PREVIEW_PREFIX,
    process.env.THUMB_PREFIX,
    process.env.FACES_PREFIX,
    process.env.ANNOTATED_PREFIX,
  ]
    .filter((prefix): prefix is string => Boolean(prefix?.trim()))
    .map((prefix) => (prefix.endsWith("/") ? prefix : `${prefix}/`));

  return allowedPrefixes.some((prefix) => value.startsWith(prefix));
}

function toWebStream(body: unknown): ReadableStream<Uint8Array> | null {
  if (!body || typeof body !== "object") return null;
  if ("transformToWebStream" in body) {
    return (body as { transformToWebStream: () => ReadableStream<Uint8Array> })
      .transformToWebStream();
  }
  return null;
}

async function getMediaObject(key: string) {
  return s3.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    })
  );
}

async function fallbackOriginalKey(key: string) {
  const match = key.match(
    /^(.*\/events\/[^/]+)\/(?:thumbnails|previews-clean|previews-watermarked|ai-input|annotated)\/([0-9a-f-]+)\.(?:webp|jpe?g|png)$/i
  );

  if (!match) return null;

  const [, eventPrefix, photoUuid] = match;
  const originalPrefix = `${eventPrefix}/originals/${photoUuid}_`;
  const keys = await listS3Keys(originalPrefix);
  return keys[0] ?? null;
}

function mediaResponse(object: Awaited<ReturnType<typeof getMediaObject>>) {
  const stream = toWebStream(object.Body);

  if (!stream) {
    return NextResponse.json(
      { error: "Media body unavailable" },
      { status: 404 }
    );
  }

  return new Response(stream, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Type": object.ContentType ?? "application/octet-stream",
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? "";

  if (!isAllowedMediaKey(key)) {
    return NextResponse.json({ error: "Invalid media key" }, { status: 400 });
  }

  try {
    return mediaResponse(await getMediaObject(key));
  } catch (error) {
    const fallbackKey = await fallbackOriginalKey(key).catch(() => null);

    if (fallbackKey) {
      try {
        return mediaResponse(await getMediaObject(fallbackKey));
      } catch (fallbackError) {
        console.error("Error proxying fallback media:", fallbackError);
      }
    }

    console.error("Error proxying media:", error);
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
}

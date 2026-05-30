import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { s3 } from "@/lib/s3";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? "";

  if (!isAllowedMediaKey(key)) {
    return NextResponse.json({ error: "Invalid media key" }, { status: 400 });
  }

  try {
    const object = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
      })
    );
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
  } catch (error) {
    console.error("Error proxying media:", error);
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
}

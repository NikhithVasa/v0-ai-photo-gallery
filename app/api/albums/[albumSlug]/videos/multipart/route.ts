import type { CompletedPart } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  signedUploadPartUrl,
} from "@/lib/s3";
import {
  ensureVideoPlaybackSchema,
  startVideoPlaybackTranscode,
} from "@/lib/video-playback";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface MultipartActionBody {
  action?: unknown;
  videoId?: unknown;
  key?: unknown;
  uploadId?: unknown;
  partNumber?: unknown;
  parts?: unknown;
}

interface VideoUploadRow {
  id: string;
  original_s3_key: string | null;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isValidPartNumber(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 10000;
}

function normalizeParts(value: unknown): CompletedPart[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((part) => {
    if (!part || typeof part !== "object") return [];
    const record = part as Record<string, unknown>;
    const partNumber = record.PartNumber ?? record.partNumber;
    const eTag = record.ETag ?? record.eTag;

    if (!isValidPartNumber(partNumber) || typeof eTag !== "string" || !eTag.trim()) {
      return [];
    }

    return [{ PartNumber: partNumber, ETag: eTag.trim() }];
  });
}

async function verifiedVideo(albumSlug: string, videoId: unknown, key: unknown) {
  if (!isUuid(videoId) || typeof key !== "string" || !key.trim()) return null;

  return queryOne<VideoUploadRow>(
    `
    SELECT v.id, v.original_s3_key
    FROM videos v
    JOIN albums a
      ON a.id = v.album_id
     AND COALESCE(a.is_deleted, false) = false
    WHERE lower(a.slug) = lower($1)
      AND v.id = $2::uuid
      AND v.original_s3_key = $3
      AND COALESCE(v.is_deleted, false) = false
    LIMIT 1
    `,
    [albumSlug, videoId, key.trim()],
  );
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    await ensureVideoPlaybackSchema();

    const body = (await request.json()) as MultipartActionBody;
    const uploadId = typeof body.uploadId === "string" ? body.uploadId.trim() : "";
    const key = typeof body.key === "string" ? body.key.trim() : "";

    if (!uploadId || !key) {
      return NextResponse.json({ error: "uploadId and key are required" }, { status: 400 });
    }

    const video = await verifiedVideo(albumSlug, body.videoId, key);
    if (!video?.original_s3_key) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (body.action === "sign-part") {
      if (!isValidPartNumber(body.partNumber)) {
        return NextResponse.json({ error: "partNumber is required" }, { status: 400 });
      }

      return NextResponse.json({
        url: await signedUploadPartUrl({
          key: video.original_s3_key,
          uploadId,
          partNumber: body.partNumber,
        }),
      });
    }

    if (body.action === "complete") {
      const parts = normalizeParts(body.parts).sort(
        (left, right) => (left.PartNumber ?? 0) - (right.PartNumber ?? 0),
      );
      if (!parts.length) {
        return NextResponse.json({ error: "parts are required" }, { status: 400 });
      }

      await completeMultipartUpload({ key: video.original_s3_key, uploadId, parts });
      const playback = await startVideoPlaybackTranscode({
        videoId: video.id,
        albumSlug,
        originalS3Key: video.original_s3_key,
      });
      return NextResponse.json({
        ok: true,
        key: video.original_s3_key,
        playbackStatus: "processing",
        mediaConvertJobId: playback.jobId,
      });
    }

    if (body.action === "abort") {
      await abortMultipartUpload({ key: video.original_s3_key, uploadId });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid multipart action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to handle video multipart upload", error);
    return NextResponse.json({ error: "Failed to handle video multipart upload" }, { status: 500 });
  }
}
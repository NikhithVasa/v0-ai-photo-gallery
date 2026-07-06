import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { startVideoPlaybackTranscode } from "@/lib/video-playback";

interface Props {
  params: Promise<{ albumSlug: string; videoId: string }>;
}

interface CompleteVideoUploadBody {
  key?: unknown;
}

interface VideoUploadRow {
  id: string;
  original_s3_key: string | null;
  playback_status: string | null;
  mediaconvert_job_id: string | null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug, videoId } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    if (!isUuid(videoId)) {
      return NextResponse.json({ error: "Invalid video id" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as CompleteVideoUploadBody;
    const requestedKey = typeof body.key === "string" ? body.key.trim() : "";
    const video = await queryOne<VideoUploadRow>(
      `
      SELECT
        v.id,
        v.original_s3_key,
        to_jsonb(v)->>'playback_status' AS playback_status,
        to_jsonb(v)->>'mediaconvert_job_id' AS mediaconvert_job_id
      FROM videos v
      JOIN albums a
        ON a.id = v.album_id
       AND COALESCE(a.is_deleted, false) = false
      WHERE lower(a.slug) = lower($1)
        AND v.id = $2::uuid
        AND COALESCE(v.is_deleted, false) = false
      LIMIT 1
      `,
      [albumSlug, videoId],
    );

    if (!video?.original_s3_key) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    if (requestedKey && requestedKey !== video.original_s3_key) {
      return NextResponse.json({ error: "Video key mismatch" }, { status: 400 });
    }
    if (video.playback_status === "processing" && video.mediaconvert_job_id) {
      return NextResponse.json({
        ok: true,
        playbackStatus: "processing",
        mediaConvertJobId: video.mediaconvert_job_id,
      });
    }

    const playback = await startVideoPlaybackTranscode({
      videoId: video.id,
      albumSlug,
      originalS3Key: video.original_s3_key,
    });

    return NextResponse.json({
      ok: true,
      playbackStatus: "processing",
      mediaConvertJobId: playback.jobId,
    });
  } catch (error) {
    console.error("Failed to complete video upload", error);
    return NextResponse.json({ error: "Failed to start video processing" }, { status: 500 });
  }
}
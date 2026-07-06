import {
  CreateJobCommand,
  GetJobCommand,
  MediaConvertClient,
  type CreateJobCommandInput,
} from "@aws-sdk/client-mediaconvert";
import { query } from "@/lib/db";

export type VideoPlaybackStatus = "uploading" | "processing" | "ready" | "failed";

interface StartVideoPlaybackTranscodeOptions {
  videoId: string;
  albumSlug: string;
  originalS3Key: string;
}

interface PendingPlaybackRow {
  id: string;
  mediaconvert_job_id: string | null;
}

const globalForMediaConvert = globalThis as unknown as {
  mediaConvertClient: MediaConvertClient | undefined;
  videoPlaybackSchemaPromise: Promise<void> | undefined;
};

const mediaConvertRegion =
  process.env.MEDIACONVERT_REGION || process.env.MEDIA_CONVERT_REGION || process.env.AWS_REGION || "us-east-1";

const mediaConvertClient =
  globalForMediaConvert.mediaConvertClient ??
  new MediaConvertClient({
    region: mediaConvertRegion,
    endpoint:
      process.env.MEDIACONVERT_ENDPOINT_URL ||
      process.env.MEDIA_CONVERT_ENDPOINT_URL ||
      undefined,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForMediaConvert.mediaConvertClient = mediaConvertClient;
}

export function ensureVideoPlaybackSchema() {
  globalForMediaConvert.videoPlaybackSchemaPromise ??= (async () => {
    if (await videoPlaybackSchemaExists()) return;

    await query(
      `
      ALTER TABLE videos
        ADD COLUMN IF NOT EXISTS playback_status text NOT NULL DEFAULT 'ready',
        ADD COLUMN IF NOT EXISTS playback_s3_key text,
        ADD COLUMN IF NOT EXISTS playback_error text,
        ADD COLUMN IF NOT EXISTS mediaconvert_job_id text,
        ADD COLUMN IF NOT EXISTS mediaconvert_job_status text,
        ADD COLUMN IF NOT EXISTS mediaconvert_output_prefix text
      `,
      [],
    );
  })()
    .catch((error) => {
      globalForMediaConvert.videoPlaybackSchemaPromise = undefined;
      throw error;
    });

  return globalForMediaConvert.videoPlaybackSchemaPromise;
}

export async function videoPlaybackSchemaExists() {
  try {
    const rows = await query<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'videos'
        AND column_name = ANY($1::text[])
      `,
      [[
        "playback_status",
        "playback_s3_key",
        "playback_error",
        "mediaconvert_job_id",
        "mediaconvert_job_status",
        "mediaconvert_output_prefix",
      ]],
    );

    return rows.length === 6;
  } catch (error) {
    console.warn("Failed to inspect video playback schema", error);
    return false;
  }
}

function mediaConvertRoleArn() {
  return (process.env.MEDIACONVERT_ROLE_ARN || process.env.MEDIA_CONVERT_ROLE_ARN || "").trim();
}

function mediaConvertQueueArn() {
  return (process.env.MEDIACONVERT_QUEUE_ARN || process.env.MEDIA_CONVERT_QUEUE_ARN || "").trim();
}

function s3Uri(key: string) {
  return `s3://${process.env.S3_BUCKET!}/${key}`;
}

function dirname(key: string) {
  const index = key.lastIndexOf("/");
  return index === -1 ? "" : key.slice(0, index);
}

function basename(key: string) {
  const index = key.lastIndexOf("/");
  return index === -1 ? key : key.slice(index + 1);
}

function withoutExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

export function playbackOutputPrefix(originalS3Key: string, videoId: string) {
  const marker = "/videos/";
  const markerIndex = originalS3Key.indexOf(marker);

  if (markerIndex >= 0) {
    return `${originalS3Key.slice(0, markerIndex)}${marker}playback/${videoId}/`;
  }

  const directory = dirname(originalS3Key);
  return directory ? `${directory}/playback/${videoId}/` : `videos/playback/${videoId}/`;
}

export function playbackOutputKey(originalS3Key: string, videoId: string) {
  return `${playbackOutputPrefix(originalS3Key, videoId)}${withoutExtension(basename(originalS3Key))}_playback.mp4`;
}

function mediaConvertJobInput({
  videoId,
  albumSlug,
  originalS3Key,
  roleArn,
  queueArn,
}: StartVideoPlaybackTranscodeOptions & { roleArn: string; queueArn: string }): CreateJobCommandInput {
  const outputPrefix = playbackOutputPrefix(originalS3Key, videoId);
  const input: CreateJobCommandInput = {
    Role: roleArn,
    UserMetadata: {
      app: "saathidesk",
      albumSlug,
      videoId,
    },
    Settings: {
      TimecodeConfig: { Source: "ZEROBASED" },
      Inputs: [
        {
          FileInput: s3Uri(originalS3Key),
          AudioSelectors: {
            "Audio Selector 1": { DefaultSelection: "DEFAULT" },
          },
        },
      ],
      OutputGroups: [
        {
          Name: "Playback MP4",
          OutputGroupSettings: {
            Type: "FILE_GROUP_SETTINGS",
            FileGroupSettings: { Destination: s3Uri(outputPrefix) },
          },
          Outputs: [
            {
              NameModifier: "_playback",
              ContainerSettings: {
                Container: "MP4",
                Mp4Settings: { MoovPlacement: "PROGRESSIVE_DOWNLOAD" },
              },
              VideoDescription: {
                CodecSettings: {
                  Codec: "H_264",
                  H264Settings: {
                    CodecLevel: "AUTO",
                    CodecProfile: "MAIN",
                    GopSize: 2,
                    GopSizeUnits: "SECONDS",
                    MaxBitrate: 5000000,
                    NumberBFramesBetweenReferenceFrames: 2,
                    QvbrSettings: { QvbrQualityLevel: 7 },
                    RateControlMode: "QVBR",
                  },
                },
              },
              AudioDescriptions: [
                {
                  AudioSourceName: "Audio Selector 1",
                  CodecSettings: {
                    Codec: "AAC",
                    AacSettings: {
                      Bitrate: 128000,
                      CodingMode: "CODING_MODE_2_0",
                      SampleRate: 48000,
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };

  if (queueArn) input.Queue = queueArn;
  return input;
}

export async function startVideoPlaybackTranscode(options: StartVideoPlaybackTranscodeOptions) {
  await ensureVideoPlaybackSchema();

  const roleArn = mediaConvertRoleArn();
  const queueArn = mediaConvertQueueArn();
  const outputPrefix = playbackOutputPrefix(options.originalS3Key, options.videoId);
  const outputKey = playbackOutputKey(options.originalS3Key, options.videoId);

  await query(
    `
    UPDATE videos
    SET playback_status = 'processing',
        playback_s3_key = $2,
        playback_error = NULL,
        mediaconvert_job_status = NULL,
        mediaconvert_output_prefix = $3,
        updated_at = now()
    WHERE id = $1::uuid
    `,
    [options.videoId, outputKey, outputPrefix],
  );

  if (!roleArn) {
    const message = "MediaConvert role ARN is not configured";
    await markVideoPlaybackFailed(options.videoId, message);
    throw new Error(message);
  }

  try {
    const response = await mediaConvertClient.send(
      new CreateJobCommand(
        mediaConvertJobInput({ ...options, roleArn, queueArn }),
      ),
    );
    const jobId = response.Job?.Id ?? null;

    await query(
      `
      UPDATE videos
      SET mediaconvert_job_id = $2,
          mediaconvert_job_status = $3,
          playback_status = 'processing',
          playback_error = NULL,
          updated_at = now()
      WHERE id = $1::uuid
      `,
      [options.videoId, jobId, response.Job?.Status ?? "SUBMITTED"],
    );

    return { jobId, outputKey, outputPrefix };
  } catch (error) {
    const message = error instanceof Error ? error.message : "MediaConvert job failed to start";
    await markVideoPlaybackFailed(options.videoId, message);
    throw error;
  }
}

async function markVideoPlaybackFailed(videoId: string, message: string) {
  await query(
    `
    UPDATE videos
    SET playback_status = 'failed',
        playback_error = $2,
        mediaconvert_job_status = 'ERROR',
        updated_at = now()
    WHERE id = $1::uuid
    `,
    [videoId, message],
  );
}

async function refreshPendingVideoPlaybackJob(row: PendingPlaybackRow) {
  if (!row.mediaconvert_job_id) return;

  const response = await mediaConvertClient.send(
    new GetJobCommand({ Id: row.mediaconvert_job_id }),
  );
  const status = response.Job?.Status ?? null;

  if (status === "COMPLETE") {
    await query(
      `
      UPDATE videos
      SET playback_status = 'ready',
          playback_error = NULL,
          mediaconvert_job_status = $2,
          updated_at = now()
      WHERE id = $1::uuid
      `,
      [row.id, status],
    );
    return;
  }

  if (status === "ERROR" || status === "CANCELED") {
    await markVideoPlaybackFailed(
      row.id,
      response.Job?.ErrorMessage || `MediaConvert job ${status.toLowerCase()}`,
    );
    return;
  }

  if (status) {
    await query(
      `
      UPDATE videos
      SET mediaconvert_job_status = $2,
          updated_at = now()
      WHERE id = $1::uuid
      `,
      [row.id, status],
    );
  }
}

export async function refreshPendingVideoPlaybackJobs(albumSlug: string) {
  if (!(await videoPlaybackSchemaExists())) return;

  const rows = await query<PendingPlaybackRow>(
    `
    SELECT v.id, v.mediaconvert_job_id
    FROM videos v
    JOIN albums a
      ON a.id = v.album_id
    WHERE lower(a.slug) = lower($1)
      AND v.playback_status = 'processing'
      AND v.mediaconvert_job_id IS NOT NULL
      AND COALESCE(v.is_deleted, false) = false
    LIMIT 20
    `,
    [albumSlug],
  );

  await Promise.all(
    rows.map((row) =>
      refreshPendingVideoPlaybackJob(row).catch((error) => {
        console.warn("Failed to refresh MediaConvert job", {
          videoId: row.id,
          jobId: row.mediaconvert_job_id,
          error,
        });
      }),
    ),
  );
}
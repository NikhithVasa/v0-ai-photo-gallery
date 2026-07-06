import {
  CreateJobCommand,
  MediaConvertClient,
  type CreateJobCommandInput,
} from "@aws-sdk/client-mediaconvert";
import { query } from "@/lib/db";

interface StartVideoPlaybackTranscodeOptions {
  videoId: string;
  albumSlug: string;
  originalS3Key: string;
}

const DEFAULT_MEDIACONVERT_ROLE_ARN =
  "arn:aws:iam::405860291566:role/MediaConvertHlsVideoRole";

const globalForMediaConvert = globalThis as unknown as {
  mediaConvertClient: MediaConvertClient | undefined;
};

const mediaConvertRegion =
  process.env.MEDIACONVERT_REGION ||
  process.env.MEDIA_CONVERT_REGION ||
  process.env.AWS_REGION ||
  "us-east-1";

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

function mediaConvertRoleArn() {
  return (
    process.env.MEDIACONVERT_ROLE_ARN ||
    process.env.MEDIA_CONVERT_ROLE_ARN ||
    DEFAULT_MEDIACONVERT_ROLE_ARN
  ).trim();
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

function playbackOutputPrefix(originalS3Key: string, videoId: string) {
  const marker = "/videos/";
  const markerIndex = originalS3Key.indexOf(marker);

  if (markerIndex >= 0) {
    return `${originalS3Key.slice(0, markerIndex)}${marker}playback/${videoId}/`;
  }

  const directory = dirname(originalS3Key);
  return directory ? `${directory}/playback/${videoId}/` : `videos/playback/${videoId}/`;
}

function playbackOutputKey(originalS3Key: string, videoId: string) {
  return `${playbackOutputPrefix(originalS3Key, videoId)}${withoutExtension(basename(originalS3Key))}_playback.mp4`;
}

function isMissingPlaybackColumnError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "42703"
  );
}

async function updatePlaybackColumns(text: string, params: unknown[]) {
  try {
    await query(text, params);
  } catch (error) {
    if (isMissingPlaybackColumnError(error)) {
      console.warn("Video playback columns are not present; MediaConvert job state was not persisted.");
      return;
    }
    throw error;
  }
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
  const roleArn = mediaConvertRoleArn();
  const queueArn = mediaConvertQueueArn();
  const outputPrefix = playbackOutputPrefix(options.originalS3Key, options.videoId);
  const outputKey = playbackOutputKey(options.originalS3Key, options.videoId);

  await updatePlaybackColumns(
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

  try {
    const response = await mediaConvertClient.send(
      new CreateJobCommand(mediaConvertJobInput({ ...options, roleArn, queueArn })),
    );
    const jobId = response.Job?.Id ?? null;

    await updatePlaybackColumns(
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
    await updatePlaybackColumns(
      `
      UPDATE videos
      SET playback_status = 'failed',
          playback_error = $2,
          mediaconvert_job_status = 'ERROR',
          updated_at = now()
      WHERE id = $1::uuid
      `,
      [options.videoId, message],
    );
    throw error;
  }
}
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { queryOne } from "@/lib/db";
import { ensurePhotoEditSchema } from "@/lib/customer-schema";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { getS3ObjectBytes, signedUrl, uploadS3Object } from "@/lib/s3";
import {
  nearestNovitaFluxAspectRatio,
  NovitaTaskFailedError,
  submitNovitaFluxKontextMaxImageEdit,
  waitForNovitaImageResult,
} from "@/lib/novita";

export const runtime = "nodejs";

const NOVITA_INPUT_MAX_DIMENSION = 1280;
const NOVITA_INPUT_RETRY_MAX_DIMENSION = 1024;

interface Props {
  params: Promise<{ albumSlug: string; photoId: string }>;
}

const PRESETS = new Map<string, string>([
  [
    "remove_background",
    "Remove the background cleanly and keep the main subject sharp. Use a clean transparent or simple studio-style background.",
  ],
  [
    "blur_background",
    "Blur the background naturally while keeping the main subject sharp and realistic.",
  ],
  [
    "enhance_lighting",
    "Improve the lighting, color balance, and sharpness while keeping the photo natural and realistic.",
  ],
  [
    "remove_object",
    "Remove distracting objects from the background and fill the area naturally.",
  ],
  [
    "add_dog",
    "Add a realistic friendly dog next to the main subject. Match the lighting, shadows, perspective, and photo style naturally.",
  ],
  [
    "studio_portrait",
    "Convert this into a clean professional studio portrait while preserving the person's identity and outfit.",
  ],
  [
    "make_cinematic",
    "Give this photo a cinematic look with rich contrast, beautiful lighting, and natural colors.",
  ],
  [
    "remove_people_background",
    "Remove extra people in the background while keeping the main subject unchanged.",
  ],
]);

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function normalizeNovitaInputImage(
  bytes: Uint8Array,
  contentType?: string | null,
  maxDimension = NOVITA_INPUT_MAX_DIMENSION,
) {
  const result = await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    bytes: result.data,
    contentType: "image/jpeg",
    width: result.info.width,
    height: result.info.height,
    maxDimension,
    sourceContentType: contentType ?? null,
    sourceBytes: bytes.byteLength,
  };
}

async function markPhotoEditFailed({
  editId,
  error,
  response,
  taskId,
}: {
  editId: string | null;
  error: unknown;
  response?: Record<string, unknown>;
  taskId?: string | null;
}) {
  if (!editId) return;

  const message =
    error instanceof Error ? error.message : "Failed to submit AI photo edit";

  await queryOne<{ id: string }>(
    `
    UPDATE photo_edits
    SET status = 'failed',
        runpod_job_id = COALESCE($4, runpod_job_id),
        error_message = $2,
        response = COALESCE(response, '{}'::jsonb) || $3::jsonb,
        updated_at = now()
    WHERE id = $1::uuid
    RETURNING id
    `,
    [
      editId,
      message,
      JSON.stringify({
        ...(response ?? {}),
        failed_at: new Date().toISOString(),
      }),
      taskId ?? null,
    ],
  ).catch(() => undefined);
}

function publicAiEditError(error: unknown) {
  if (error instanceof NovitaTaskFailedError) {
    return "Novita failed this edit after retrying with a smaller image. Try a simpler prompt or a different photo.";
  }

  return error instanceof Error
    ? error.message
    : "Failed to submit AI photo edit";
}

export async function POST(request: Request, { params }: Props) {
  let editId: string | null = null;
  let latestNovitaTaskId: string | null = null;
  let latestNovitaFailureResponse: Record<string, unknown> | null = null;

  try {
    await ensurePhotoEditSchema();

    const { albumSlug, photoId } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json()) as {
      prompt?: unknown;
      presetPromptKey?: unknown;
    };
    const presetPromptKey = stringValue(body.presetPromptKey);
    const customPrompt = stringValue(body.prompt);
    const presetPrompt = PRESETS.get(presetPromptKey) ?? "";
    const prompt = [presetPrompt, customPrompt].filter(Boolean).join(" ");

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const photo = await queryOne<{
      album_id: string;
      album_name: string;
      album_slug: string;
      album_event_id: string;
      event_slug: string;
      file_name: string | null;
      original_s3_key: string | null;
    }>(
      `
      SELECT
        p.album_id,
        a.name AS album_name,
        a.slug AS album_slug,
        p.album_event_id,
        e.slug AS event_slug,
        p.file_name,
        p.original_s3_key
      FROM photos p
      JOIN albums a ON a.id = p.album_id
      JOIN album_events e ON e.id = p.album_event_id
      WHERE a.slug = $1
        AND p.id = $2::uuid
        AND COALESCE(a.is_deleted, false) = false
        AND COALESCE(p.is_deleted, false) = false
      LIMIT 1
      `,
      [albumSlug, photoId]
    );

    if (!photo?.original_s3_key) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    editId = randomUUID();
    const outputS3Key = `albums/${photo.album_slug}/events/${photo.event_slug}/edited/${photoId}/${editId}.png`;

    await queryOne<{ id: string }>(
      `
      INSERT INTO photo_edits(
        id,
        album_id,
        album_event_id,
        photo_id,
        source_s3_key,
        prompt,
        preset_prompt_key,
        status,
        created_by,
        created_at,
        updated_at
      )
      VALUES(
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5,
        $6,
        $7,
        'submitted',
        'web-ai-edit-novita-flux-kontext-max',
        now(),
        now()
      )
      RETURNING id
      `,
      [
        editId,
        photo.album_id,
        photo.album_event_id,
        photoId,
        photo.original_s3_key,
        prompt,
        presetPromptKey || null,
      ]
    );

    const sourceImage = await getS3ObjectBytes(photo.original_s3_key);
    if (!sourceImage) {
      throw new Error("Could not read source image");
    }

    const novitaAttempts: Array<Record<string, unknown>> = [];

    const runNovitaAttempt = async (maxDimension: number) => {
      const novitaInput = await normalizeNovitaInputImage(
        sourceImage.bytes,
        sourceImage.contentType,
        maxDimension,
      );
      const aspectRatio = nearestNovitaFluxAspectRatio(
        novitaInput.width,
        novitaInput.height,
      );
      const novitaTask = await submitNovitaFluxKontextMaxImageEdit({
        base64Image: Buffer.from(novitaInput.bytes).toString("base64"),
        prompt,
        aspectRatio,
      });
      latestNovitaTaskId = novitaTask.taskId;

      const attemptMetadata = {
        task_id: novitaTask.taskId,
        input_image: {
          content_type: novitaInput.contentType,
          width: novitaInput.width,
          height: novitaInput.height,
          max_dimension: novitaInput.maxDimension,
          source_content_type: novitaInput.sourceContentType,
          source_bytes: novitaInput.sourceBytes,
          submitted_bytes: novitaInput.bytes.byteLength,
        },
        final_prompt: novitaTask.finalPrompt,
        aspect_ratio: novitaTask.aspectRatio,
        submit_response: novitaTask.response,
      };

      try {
        const novitaResult = await waitForNovitaImageResult(novitaTask.taskId);
        novitaAttempts.push({
          ...attemptMetadata,
          status: novitaResult.status,
          result_response: novitaResult.response,
        });

        return {
          input: novitaInput,
          task: novitaTask,
          result: novitaResult,
        };
      } catch (attemptError) {
        if (attemptError instanceof NovitaTaskFailedError) {
          latestNovitaFailureResponse = attemptError.response as Record<
            string,
            unknown
          >;
          novitaAttempts.push({
            ...attemptMetadata,
            status: "failed",
            result_response: attemptError.response,
            error_message: attemptError.message,
          });
        }

        throw attemptError;
      }
    };

    let novitaRun: Awaited<ReturnType<typeof runNovitaAttempt>>;

    try {
      novitaRun = await runNovitaAttempt(NOVITA_INPUT_MAX_DIMENSION);
    } catch (attemptError) {
      if (!(attemptError instanceof NovitaTaskFailedError)) {
        throw attemptError;
      }

      novitaRun = await runNovitaAttempt(NOVITA_INPUT_RETRY_MAX_DIMENSION);
    }

    const novitaInput = novitaRun.input;
    const novitaTask = novitaRun.task;
    const novitaResult = novitaRun.result;
    let editedUrl: string | null = null;
    let completedS3Key: string | null = null;

    if (novitaResult.imageUrl) {
      const editedResponse = await fetch(novitaResult.imageUrl);

      if (!editedResponse.ok) {
        throw new Error(`Could not download edited image (${editedResponse.status})`);
      }

      const editedBytes = new Uint8Array(await editedResponse.arrayBuffer());
      await uploadS3Object({
        key: outputS3Key,
        body: editedBytes,
        contentType: editedResponse.headers.get("content-type") || "image/png",
      });
      completedS3Key = outputS3Key;
      editedUrl = await signedUrl(outputS3Key);
    }

    await queryOne<{ id: string }>(
      `
      UPDATE photo_edits
      SET runpod_job_id = $2,
          response = $3::jsonb,
          edited_s3_key = COALESCE($4, edited_s3_key),
          thumb_s3_key = COALESCE($5, thumb_s3_key),
          status = $6,
          updated_at = now()
      WHERE id = $1::uuid
      RETURNING id
      `,
      [
        editId,
        novitaTask.taskId,
        JSON.stringify({
          provider: "novita",
          model: "flux-1-kontext-max",
          source_s3_key: photo.original_s3_key,
          result_image_url: novitaResult.imageUrl,
          output_s3_key: outputS3Key,
          input_image: {
            content_type: novitaInput.contentType,
            width: novitaInput.width,
            height: novitaInput.height,
            source_content_type: novitaInput.sourceContentType,
            source_bytes: novitaInput.sourceBytes,
            submitted_bytes: novitaInput.bytes.byteLength,
          },
          final_prompt: novitaTask.finalPrompt,
          aspect_ratio: novitaTask.aspectRatio,
          attempts: novitaAttempts,
          submit_response: novitaTask.response,
          result_response: novitaResult.response,
        }),
        completedS3Key,
        null,
        novitaResult.imageUrl ? "completed" : "submitted",
      ]
    );

    return NextResponse.json({
      ok: true,
      edit: {
        id: editId,
        status: novitaResult.imageUrl ? "completed" : "submitted",
        photoId,
        sourceS3Key: photo.original_s3_key,
        editedS3Key: completedS3Key,
        editedUrl,
        thumbS3Key: null,
        thumbUrl: null,
        prompt,
        presetPromptKey: presetPromptKey || null,
        taskId: novitaTask.taskId,
      },
      novita: novitaResult.response ?? novitaTask.response,
    });
  } catch (error) {
    console.error("Error submitting AI photo edit:", error);
    await markPhotoEditFailed({
      editId,
      error,
      response: {
        provider: "novita",
        model: "flux-1-kontext-max",
        task_id: latestNovitaTaskId,
        result_response: latestNovitaFailureResponse,
      },
      taskId: latestNovitaTaskId,
    });

    return NextResponse.json(
      {
        error: publicAiEditError(error),
        taskId: latestNovitaTaskId,
      },
      { status: 500 }
    );
  }
}

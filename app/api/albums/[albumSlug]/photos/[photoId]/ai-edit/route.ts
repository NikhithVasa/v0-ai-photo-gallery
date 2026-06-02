import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { ensurePhotoEditSchema } from "@/lib/customer-schema";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { getS3ObjectBytes, signedUrl, uploadS3Object } from "@/lib/s3";
import {
  nearestNovitaFluxAspectRatio,
  submitNovitaFluxKontextMaxImageEdit,
  waitForNovitaImageResult,
} from "@/lib/novita";

export const runtime = "nodejs";

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

export async function POST(request: Request, { params }: Props) {
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
      width: number | null;
      height: number | null;
    }>(
      `
      SELECT
        p.album_id,
        a.name AS album_name,
        a.slug AS album_slug,
        p.album_event_id,
        e.slug AS event_slug,
        p.file_name,
        p.original_s3_key,
        p.width,
        p.height
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

    const editId = randomUUID();
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
      return NextResponse.json(
        { error: "Could not read source image" },
        { status: 500 },
      );
    }

    const aspectRatio = nearestNovitaFluxAspectRatio(photo.width, photo.height);
    const novitaTask = await submitNovitaFluxKontextMaxImageEdit({
      base64Image: Buffer.from(sourceImage.bytes).toString("base64"),
      prompt,
      aspectRatio,
    });
    const novitaResult = await waitForNovitaImageResult(novitaTask.taskId);
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
          final_prompt: novitaTask.finalPrompt,
          aspect_ratio: novitaTask.aspectRatio,
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
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit AI photo edit",
      },
      { status: 500 }
    );
  }
}

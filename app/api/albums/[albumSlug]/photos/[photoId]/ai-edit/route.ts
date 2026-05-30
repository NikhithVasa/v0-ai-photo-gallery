import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAlbumAccess } from "@/lib/album-access";
import { ensurePhotoEditSchema } from "@/lib/customer-schema";
import { signedUrl } from "@/lib/s3";
import { submitRunpodJob } from "@/lib/runpod";

interface Props {
  params: Promise<{ albumSlug: string; photoId: string }>;
}

const PRESETS = new Map<string, string>([
  [
    "remove_background",
    "Remove the background and keep the subject cleanly isolated.",
  ],
  [
    "blur_background",
    "Blur the background while keeping the subject sharp and natural.",
  ],
  [
    "enhance_lighting",
    "Improve lighting, brighten the image, and keep skin tones natural.",
  ],
  [
    "remove_object",
    "Remove unwanted distracting objects and fill the background naturally.",
  ],
  [
    "add_dog",
    "Add a realistic dog next to the subject and match perspective and lighting naturally.",
  ],
  [
    "retouch_portrait",
    "Retouch the portrait subtly, smooth skin gently, and keep the face natural.",
  ],
  [
    "vibrant_colors",
    "Enhance colors to look vibrant and rich while staying natural.",
  ],
  [
    "studio_portrait",
    "Convert the image into a clean professional studio portrait style.",
  ],
  ["extend_background", "Extend the background naturally beyond the current frame."],
  ["oil_painting", "Transform the image into a detailed oil painting style."],
]);

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nestedString(data: Record<string, unknown>, path: string[]) {
  let current: unknown = data;
  for (const key of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : null;
}

export async function POST(request: Request, { params }: Props) {
  try {
    await ensurePhotoEditSchema();
    const { albumSlug, photoId } = await params;
    const accessDenied = await requireAlbumAccess(request, albumSlug);
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

    const editId = randomUUID();
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
        'web-ai-edit',
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

    const input = {
      mode: "photo_edit",
      album_slug: photo.album_slug,
      album_name: photo.album_name,
      event_slug: photo.event_slug,
      photo_id: photoId,
      edit_id: editId,
      source_s3_key: photo.original_s3_key,
      output_s3_key: `albums/${photo.album_slug}/events/${photo.event_slug}/edited/${photoId}/${editId}.png`,
      edit_prompt: prompt,
      preset_prompt_key: presetPromptKey || null,
      return_format: "png",
      chat_context: true,
    };

    const runpod = await submitRunpodJob(input);
    const runpodJobId =
      typeof runpod.id === "string"
        ? runpod.id
        : typeof runpod.job_id === "string"
          ? runpod.job_id
          : null;
    const editedS3Key =
      nestedString(runpod, ["output", "photo_edit", "edited_s3_key"]) ||
      nestedString(runpod, ["result", "photo_edit", "edited_s3_key"]) ||
      nestedString(runpod, ["photo_edit", "edited_s3_key"]);
    const thumbS3Key =
      nestedString(runpod, ["output", "photo_edit", "thumb_s3_key"]) ||
      nestedString(runpod, ["result", "photo_edit", "thumb_s3_key"]) ||
      nestedString(runpod, ["photo_edit", "thumb_s3_key"]);

    await queryOne<{ id: string }>(
      `
      UPDATE photo_edits
      SET runpod_job_id = $2,
          response = $3::jsonb,
          edited_s3_key = COALESCE($4, edited_s3_key),
          thumb_s3_key = COALESCE($5, thumb_s3_key),
          status = CASE WHEN $4::text IS NULL THEN 'submitted' ELSE 'completed' END,
          updated_at = now()
      WHERE id = $1::uuid
      RETURNING id
      `,
      [
        editId,
        runpodJobId,
        JSON.stringify(runpod),
        editedS3Key,
        thumbS3Key,
      ]
    );

    return NextResponse.json({
      ok: true,
      edit: {
        id: editId,
        status: editedS3Key ? "completed" : "submitted",
        photoId,
        sourceS3Key: photo.original_s3_key,
        editedS3Key,
        editedUrl: await signedUrl(editedS3Key),
        thumbS3Key,
        thumbUrl: await signedUrl(thumbS3Key),
        prompt,
        presetPromptKey: presetPromptKey || null,
        runpodJobId,
      },
      runpod,
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

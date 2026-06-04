import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getAuthAccess,
  requireAlbumCustomerAccess,
  unauthorizedResponse,
} from "@/lib/auth-access";
import { applyCubeLutToImage, parseCubeLut } from "@/lib/cube-lut";
import { queryOne, withTransaction } from "@/lib/db";
import { getAccessiblePresetRow, isUuid } from "@/lib/preset-data";
import { ensurePresetSchema } from "@/lib/preset-schema";
import { getS3ObjectBytes, signedUrl, uploadS3Object } from "@/lib/s3";

export const runtime = "nodejs";

interface Props {
  params: Promise<{ presetId: string }>;
}

function intensityValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.round(Math.min(100, Math.max(0, number))) : 75;
}

function slugPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function POST(request: Request, { params }: Props) {
  try {
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();

    const body = (await request.json()) as {
      albumSlug?: unknown;
      photoId?: unknown;
      intensity?: unknown;
    };
    const albumSlug = typeof body.albumSlug === "string" ? body.albumSlug : "";
    const photoId = typeof body.photoId === "string" ? body.photoId : "";
    const intensity = intensityValue(body.intensity);

    if (!albumSlug || !isUuid(photoId)) {
      return NextResponse.json(
        { error: "Photo and album are required." },
        { status: 400 },
      );
    }

    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;
    await ensurePresetSchema();

    const { presetId } = await params;
    if (!isUuid(presetId)) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    const preset = await getAccessiblePresetRow(presetId, access.email);
    if (!preset) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    const photo = await queryOne<{
      album_id: string;
      album_event_id: string;
      event_slug: string;
      file_name: string | null;
      original_s3_key: string | null;
    }>(
      `
      SELECT
        p.album_id,
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
        AND COALESCE(e.is_deleted, false) = false
      LIMIT 1
      `,
      [albumSlug, photoId],
    );
    if (!photo?.original_s3_key) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const [sourceImage, lutObject] = await Promise.all([
      getS3ObjectBytes(photo.original_s3_key),
      getS3ObjectBytes(preset.lut_s3_key),
    ]);
    if (!sourceImage || !lutObject) {
      throw new Error("Could not read the photo or preset file.");
    }

    const lut = parseCubeLut(new TextDecoder().decode(lutObject.bytes));
    const edited = await applyCubeLutToImage({
      imageBytes: sourceImage.bytes,
      lut,
      intensity,
    });

    const applicationId = randomUUID();
    const newPhotoUuid = randomUUID();
    const presetName = slugPart(preset.name) || "preset";
    const baseName = photo.file_name?.replace(/\.[^.]+$/, "") || "photo";
    const fileName = `${baseName}-${presetName}-${intensity}.jpg`;
    const outputS3Key = `albums/${albumSlug}/events/${photo.event_slug}/preset-edits/${photoId}/${applicationId}.jpg`;

    await uploadS3Object({
      key: outputS3Key,
      body: edited.bytes,
      contentType: edited.contentType,
    });

    const insertedPhoto = await withTransaction(async (client) => {
      const result = await client.query<{ id: string }>(
        `
        INSERT INTO photos(
          album_id, album_event_id, photo_uuid, source_s3_key,
          storage_album_slug, storage_event_slug, file_name, file_size_bytes,
          width, height, original_s3_key, ai_input_s3_key, upload_status,
          compression_status, watermark_status, face_index_status, qwen_status,
          search_index_status, created_at, updated_at
        )
        VALUES(
          $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8,
          $9, $10, $4, $4, 'completed', 'pending', 'pending', 'pending',
          'pending', 'pending', now(), now()
        )
        RETURNING id
        `,
        [
          photo.album_id,
          photo.album_event_id,
          newPhotoUuid,
          outputS3Key,
          albumSlug,
          photo.event_slug,
          fileName,
          edited.bytes.byteLength,
          edited.width,
          edited.height,
        ],
      );
      const editedPhotoId = result.rows[0]?.id;
      if (!editedPhotoId) throw new Error("Could not create edited copy.");

      await client.query(
        `
        INSERT INTO preset_applications(
          id, preset_id, album_id, album_event_id, source_photo_id,
          edited_photo_id, intensity, created_by_email, created_at
        )
        VALUES($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7, $8, now())
        `,
        [
          applicationId,
          presetId,
          photo.album_id,
          photo.album_event_id,
          photoId,
          editedPhotoId,
          intensity,
          access.email,
        ],
      );

      await client.query(
        `
        INSERT INTO processing_jobs(
          album_id, album_event_id, photo_id, job_type, status, created_at, updated_at
        )
        VALUES
          ($1::uuid, $2::uuid, $3::uuid, 'compress_photo', 'pending', now(), now()),
          ($1::uuid, $2::uuid, $3::uuid, 'face_index_photo', 'pending', now(), now())
        ON CONFLICT(photo_id, job_type) DO UPDATE SET
          status = 'pending',
          error_message = NULL,
          updated_at = now()
        `,
        [photo.album_id, photo.album_event_id, editedPhotoId],
      );

      return editedPhotoId;
    });

    return NextResponse.json({
      ok: true,
      message: "Preset applied successfully. Your original photo was not changed.",
      photo: {
        id: insertedPhoto,
        fileName,
        editedUrl: await signedUrl(outputS3Key),
      },
    });
  } catch (error) {
    console.error("Error applying preset:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "We couldn't apply this preset. Your original photo is safe.",
      },
      { status: 500 },
    );
  }
}

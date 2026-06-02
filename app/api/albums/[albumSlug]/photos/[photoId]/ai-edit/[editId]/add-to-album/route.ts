import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAlbumAccess } from "@/lib/album-access";
import { ensurePhotoEditSchema } from "@/lib/customer-schema";
import { requireAdminAccess } from "@/lib/auth-access";
import { query, queryOne, withTransaction } from "@/lib/db";

export const runtime = "nodejs";

interface Props {
  params: Promise<{ albumSlug: string; photoId: string; editId: string }>;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function editedFileName(fileName: string | null, editId: string) {
  const base = fileName?.replace(/\.[^.]+$/, "") || "photo";
  return `${base}-ai-edit-${editId.slice(0, 8)}.png`;
}

export async function POST(request: Request, { params }: Props) {
  try {
    await ensurePhotoEditSchema();
    const admin = await requireAdminAccess();
    if (admin.response) return admin.response;

    const { albumSlug, photoId, editId } = await params;
    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json()) as { eventId?: unknown };
    const eventId = stringValue(body.eventId);

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    const edit = await queryOne<{
      album_id: string;
      album_slug: string;
      original_file_name: string | null;
      edited_s3_key: string | null;
      status: string;
    }>(
      `
      SELECT
        pe.album_id,
        a.slug AS album_slug,
        p.file_name AS original_file_name,
        pe.edited_s3_key,
        pe.status
      FROM photo_edits pe
      JOIN albums a ON a.id = pe.album_id
      JOIN photos p ON p.id = pe.photo_id
      WHERE pe.id = $1::uuid
        AND pe.photo_id = $2::uuid
        AND a.slug = $3
        AND COALESCE(a.is_deleted, false) = false
        AND COALESCE(p.is_deleted, false) = false
      LIMIT 1
      `,
      [editId, photoId, albumSlug],
    );

    if (!edit?.edited_s3_key || edit.status !== "completed") {
      return NextResponse.json(
        { error: "Completed AI edit not found" },
        { status: 404 },
      );
    }

    const event = await queryOne<{
      id: string;
      slug: string;
      name: string;
    }>(
      `
      SELECT e.id, e.slug, e.name
      FROM album_events e
      WHERE e.id = $1::uuid
        AND e.album_id = $2::uuid
        AND COALESCE(e.is_deleted, false) = false
      LIMIT 1
      `,
      [eventId, edit.album_id],
    );

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const photoUuid = randomUUID();
    const fileName = editedFileName(edit.original_file_name, editId);

    const photo = await withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `
        INSERT INTO photos(
          album_id,
          album_event_id,
          photo_uuid,
          source_s3_key,
          storage_album_slug,
          storage_event_slug,
          file_name,
          file_size_bytes,
          original_s3_key,
          ai_input_s3_key,
          upload_status,
          compression_status,
          watermark_status,
          face_index_status,
          qwen_status,
          search_index_status,
          created_at,
          updated_at
        )
        VALUES(
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          $5,
          $6,
          $7,
          NULL,
          $4,
          $4,
          'completed',
          'pending',
          'pending',
          'pending',
          'pending',
          'pending',
          now(),
          now()
        )
        RETURNING id
        `,
        [
          edit.album_id,
          event.id,
          photoUuid,
          edit.edited_s3_key,
          edit.album_slug,
          event.slug,
          fileName,
        ],
      );

      const photoId = inserted.rows[0]?.id;

      if (!photoId) {
        throw new Error("Could not add edited photo to album");
      }

      await client.query(
        `
        INSERT INTO processing_jobs(
          album_id,
          album_event_id,
          photo_id,
          job_type,
          status,
          created_at,
          updated_at
        )
        VALUES
          ($1::uuid, $2::uuid, $3::uuid, 'compress_photo', 'pending', now(), now()),
          ($1::uuid, $2::uuid, $3::uuid, 'face_index_photo', 'pending', now(), now())
        ON CONFLICT(photo_id, job_type) DO UPDATE SET
          status = 'pending',
          error_message = NULL,
          updated_at = now()
        `,
        [edit.album_id, event.id, photoId],
      );

      return { id: photoId };
    });

    await query(
      `
      UPDATE photo_edits
      SET response = COALESCE(response, '{}'::jsonb) || $2::jsonb,
          updated_at = now()
      WHERE id = $1::uuid
      `,
      [
        editId,
        JSON.stringify({
          added_to_album_photo_id: photo.id,
          added_to_album_event_id: event.id,
          added_to_album_at: new Date().toISOString(),
        }),
      ],
    );

    return NextResponse.json({
      ok: true,
      photo: {
        id: photo.id,
        fileName,
        eventId: event.id,
        eventSlug: event.slug,
        eventName: event.name,
      },
    });
  } catch (error) {
    console.error("Error adding AI edit to album:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to add AI edit to album",
      },
      { status: 500 },
    );
  }
}

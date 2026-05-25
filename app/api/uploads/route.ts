import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { signedUploadUrl } from "@/lib/s3";

interface UploadFileInput {
  fileName: string;
  size: number;
  contentType: string;
}

interface UploadRequestBody {
  mode?: "existing" | "new";
  albumSlug?: string;
  albumName?: string;
  eventSlug?: string;
  eventName?: string;
  files?: UploadFileInput[];
}

interface AlbumRow {
  id: string;
  slug: string;
  name: string;
}

interface EventRow {
  id: string;
  slug: string;
  name: string;
}

interface PhotoInsertRow {
  id: string;
  original_s3_key: string;
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || randomUUID()
  );
}

function safeStem(fileName: string) {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  return slugify(withoutExt);
}

function extensionFromFileName(fileName: string) {
  const match = fileName.toLowerCase().match(/\.(jpe?g|png|webp|gif|avif|heic|heif)$/);
  return match ? `.${match[1]}` : ".jpg";
}

function contentTypeFromFile(file: UploadFileInput) {
  if (file.contentType?.startsWith("image/")) return file.contentType;

  const ext = extensionFromFileName(file.fileName);
  return (
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".avif": "image/avif",
      ".heic": "image/heic",
      ".heif": "image/heif",
    }[ext] ?? "application/octet-stream"
  );
}

async function createOrGetAlbum(body: UploadRequestBody) {
  if (body.mode === "new") {
    const albumName = body.albumName?.trim();
    if (!albumName) throw new Error("albumName is required");

    const slug = slugify(albumName);
    return queryOne<AlbumRow>(
      `
      INSERT INTO albums(
        name,
        slug,
        password_hash,
        password_required,
        created_by,
        watermark_enabled,
        created_at,
        updated_at
      )
      VALUES($1, $2, NULL, false, 'web-upload', false, now(), now())
      ON CONFLICT(slug) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = now()
      RETURNING id, slug, name
      `,
      [albumName, slug]
    );
  }

  if (!body.albumSlug) throw new Error("albumSlug is required");

  return queryOne<AlbumRow>(
    `
    SELECT id, slug, name
    FROM albums
    WHERE slug = $1
      AND COALESCE(is_deleted, false) = false
    `,
    [body.albumSlug]
  );
}

async function createOrGetEvent(albumId: string, body: UploadRequestBody) {
  const eventName = body.eventName?.trim();
  const eventSlug = body.eventSlug?.trim();

  if (eventName) {
    const slug = slugify(eventName);
    return queryOne<EventRow>(
      `
      INSERT INTO album_events(album_id, name, slug, sort_order, created_at, updated_at)
      VALUES(
        $1::uuid,
        $2,
        $3,
        COALESCE(
          (SELECT MAX(sort_order) + 1 FROM album_events WHERE album_id = $1::uuid),
          1
        ),
        now(),
        now()
      )
      ON CONFLICT(album_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = now()
      RETURNING id, slug, name
      `,
      [albumId, eventName, slug]
    );
  }

  if (!eventSlug) throw new Error("eventSlug or eventName is required");

  return queryOne<EventRow>(
    `
    SELECT id, slug, name
    FROM album_events
    WHERE album_id = $1::uuid
      AND slug = $2
      AND COALESCE(is_deleted, false) = false
    `,
    [albumId, eventSlug]
  );
}

function buildPhotoKeys(albumSlug: string, eventSlug: string, fileName: string) {
  const photoUuid = randomUUID();
  const ext = extensionFromFileName(fileName);
  const stem = safeStem(fileName);
  const base = `albums/${albumSlug}/events/${eventSlug}`;

  return {
    photoUuid,
    originalS3Key: `${base}/originals/${photoUuid}_${stem}${ext}`,
    aiInputS3Key: `${base}/ai-input/${photoUuid}.webp`,
    cleanPreviewS3Key: `${base}/previews-clean/${photoUuid}.webp`,
    watermarkedPreviewS3Key: `${base}/previews-watermarked/${photoUuid}.webp`,
    thumbnailS3Key: `${base}/thumbnails/${photoUuid}.webp`,
    annotatedS3Key: `${base}/annotated/${photoUuid}.jpg`,
  };
}

function validateFiles(files: unknown) {
  if (!Array.isArray(files)) return [];

  return files
    .filter((file): file is UploadFileInput => {
      if (!file || typeof file !== "object") return false;
      const item = file as Partial<UploadFileInput>;
      return (
        typeof item.fileName === "string" &&
        item.fileName.trim().length > 0 &&
        typeof item.size === "number" &&
        item.size > 0
      );
    })
    .slice(0, 100);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UploadRequestBody;
    const files = validateFiles(body.files);

    if (!files.length) {
      return NextResponse.json({ error: "files are required" }, { status: 400 });
    }

    const album = await createOrGetAlbum(body);
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const event = await createOrGetEvent(album.id, body);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const uploads = await Promise.all(
      files.map(async (file) => {
        const keys = buildPhotoKeys(album.slug, event.slug, file.fileName);
        const contentType = contentTypeFromFile(file);
        const row = await queryOne<PhotoInsertRow>(
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
            clean_preview_s3_key,
            watermarked_preview_s3_key,
            thumbnail_s3_key,
            annotated_s3_key,
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
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            'pending',
            'pending',
            'pending',
            'pending',
            'pending',
            'pending',
            now(),
            now()
          )
          RETURNING id, original_s3_key
          `,
          [
            album.id,
            event.id,
            keys.photoUuid,
            keys.originalS3Key,
            album.slug,
            event.slug,
            file.fileName,
            file.size,
            keys.originalS3Key,
            keys.aiInputS3Key,
            keys.cleanPreviewS3Key,
            keys.watermarkedPreviewS3Key,
            keys.thumbnailS3Key,
            keys.annotatedS3Key,
          ]
        );

        if (!row) throw new Error(`Could not create upload for ${file.fileName}`);

        return {
          id: row.id,
          fileName: file.fileName,
          size: file.size,
          contentType,
          originalS3Key: row.original_s3_key,
          uploadUrl: await signedUploadUrl(row.original_s3_key, contentType),
        };
      })
    );

    return NextResponse.json({
      album,
      event,
      uploads,
    });
  } catch (error) {
    console.error("Error preparing uploads:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prepare uploads" },
      { status: 500 }
    );
  }
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { ensurePhotoSortSchema } from "@/lib/photo-sort";
import { signedUploadUrl } from "@/lib/s3";
import { ensureUploadSourceSchema } from "@/lib/upload-source-schema";
import {
  requireAdminAccess,
  requireAlbumCustomerAccess,
} from "@/lib/auth-access";

interface UploadFileInput {
  fileName: string;
  size: number;
  contentType: string;
  width?: number | null;
  height?: number | null;
  originalTakenAt?: string | null;
  sourceProvider?: "google-drive" | "google-photos";
  sourceExternalId?: string | null;
  sourceModifiedAt?: string | null;
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
  customer_id: string | null;
}

interface EventRow {
  id: string;
  slug: string;
  name: string;
  source_prefix: string | null;
}

interface PhotoInsertRow {
  id: string;
  original_s3_key: string;
  upload_status?: string | null;
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
  const match = fileName.toLowerCase().match(
    /\.(jpe?g|jpe|png|webp|gif|avif|heic|heif|nef|cr2|arw|dng|tiff?|bmp|jfif)$/,
  );
  return match ? `.${match[1]}` : ".jpg";
}

function contentTypeFromFile(file: UploadFileInput) {
  if (file.contentType?.startsWith("image/")) return file.contentType;

  const ext = extensionFromFileName(file.fileName);
  return (
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".jpe": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".avif": "image/avif",
      ".heic": "image/heic",
      ".heif": "image/heif",
      ".nef": "image/x-nikon-nef",
      ".cr2": "image/x-canon-cr2",
      ".arw": "image/x-sony-arw",
      ".dng": "image/x-adobe-dng",
      ".tif": "image/tiff",
      ".tiff": "image/tiff",
      ".bmp": "image/bmp",
      ".jfif": "image/jpeg",
    }[ext] ?? "application/octet-stream"
  );
}

async function hasEventSourcePrefix() {
  const row = await queryOne<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'album_events'
        AND column_name = 'source_prefix'
    ) AS exists
    `,
    []
  );

  return Boolean(row?.exists);
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
      RETURNING id, slug, name, customer_id
      `,
      [albumName, slug]
    );
  }

  if (!body.albumSlug) throw new Error("albumSlug is required");

  return queryOne<AlbumRow>(
    `
    SELECT id, slug, name, customer_id
    FROM albums
    WHERE slug = $1
      AND COALESCE(is_deleted, false) = false
    `,
    [body.albumSlug]
  );
}

async function createOrGetEvent(album: AlbumRow, body: UploadRequestBody) {
  const eventName = body.eventName?.trim();
  const eventSlug = body.eventSlug?.trim();
  const sourcePrefixSelect = (await hasEventSourcePrefix())
    ? "source_prefix"
    : "NULL::text AS source_prefix";
  const hasSourcePrefix = sourcePrefixSelect === "source_prefix";

  if (eventName) {
    const slug = slugify(eventName);
    const sourcePrefix = `albums/${album.slug}/events/${slug}`;
    return queryOne<EventRow>(
      hasSourcePrefix
        ? `
      INSERT INTO album_events(album_id, customer_id, name, slug, source_prefix, sort_order, created_at, updated_at)
      VALUES(
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        $5,
        COALESCE(
          (SELECT MAX(sort_order) + 1 FROM album_events WHERE album_id = $1::uuid),
          1
        ),
        now(),
        now()
      )
      ON CONFLICT(album_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        customer_id = EXCLUDED.customer_id,
        source_prefix = COALESCE(album_events.source_prefix, EXCLUDED.source_prefix),
        updated_at = now()
      RETURNING id, slug, name, ${sourcePrefixSelect}
      `
        : `
      INSERT INTO album_events(album_id, customer_id, name, slug, sort_order, created_at, updated_at)
      VALUES(
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        COALESCE(
          (SELECT MAX(sort_order) + 1 FROM album_events WHERE album_id = $1::uuid),
          1
        ),
        now(),
        now()
      )
      ON CONFLICT(album_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        customer_id = EXCLUDED.customer_id,
        updated_at = now()
      RETURNING id, slug, name, ${sourcePrefixSelect}
      `,
      hasSourcePrefix
        ? [album.id, album.customer_id, eventName, slug, sourcePrefix]
        : [album.id, album.customer_id, eventName, slug]
    );
  }

  if (!eventSlug) throw new Error("eventSlug or eventName is required");

  return queryOne<EventRow>(
    `
    SELECT id, slug, name, ${sourcePrefixSelect}
    FROM album_events
    WHERE album_id = $1::uuid
      AND slug = $2
      AND COALESCE(is_deleted, false) = false
    `,
      [album.id, eventSlug]
  );
}

function buildPhotoKeys(
  albumSlug: string,
  eventSlug: string,
  fileName: string,
  sourcePrefix?: string | null
) {
  const photoUuid = randomUUID();
  const ext = extensionFromFileName(fileName);
  const stem = safeStem(fileName);
  // Events can carry an imported source prefix. Normalize bucket or URL-shaped
  // values back to object-key prefixes before creating derived upload keys.
  const base =
    sourcePrefix
      ?.trim()
      .replace(/^s3:\/\/[^/]+\//, "")
      .replace(/^https?:\/\/[^/]+\//, "")
      .replace(/^\/+|\/+$/g, "") ||
    `albums/${albumSlug}/events/${eventSlug}`;

  return {
    photoUuid,
    originalS3Key: `${base}/originals/${photoUuid}_${stem}${ext}`,
    aiInputS3Key: `${base}/ai-input/${photoUuid}.webp`,
    cleanPreviewS3Key: null,
    watermarkedPreviewS3Key: null,
    thumbnailS3Key: null,
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
    });
}

function imageDimensionValue(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0 || value > 100_000) return null;
  return Math.round(value);
}

function originalTakenAtValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function sourceProviderValue(value: unknown) {
  return value === "google-drive" || value === "google-photos" ? value : null;
}

function sourceExternalIdValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, 512);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UploadRequestBody;
    if (body.mode === "new") {
      const admin = await requireAdminAccess();
      if (admin.response) return admin.response;
    } else if (body.albumSlug) {
      const accessDenied = await requireAlbumCustomerAccess(body.albumSlug);
      if (accessDenied) return accessDenied;
    }

    const files = validateFiles(body.files);

    if (!files.length) {
      return NextResponse.json({ error: "files are required" }, { status: 400 });
    }

    await Promise.all([ensurePhotoSortSchema(), ensureUploadSourceSchema()]);

    const album = await createOrGetAlbum(body);
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const event = await createOrGetEvent(album, body);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const uploads: any[] = [];
    for (let i = 0; i < files.length; i += 3) {
      const chunk = files.slice(i, i + 3);
      const chunkResults = await Promise.all(
        chunk.map(async (file) => {
          let attempt = 0;
          while (true) {
            try {
              const sourceProvider = sourceProviderValue(file.sourceProvider);
              const sourceExternalId = sourceExternalIdValue(
                file.sourceExternalId,
              );
              const existing =
                sourceProvider && sourceExternalId
                  ? await queryOne<PhotoInsertRow>(
                      `
                      SELECT id, original_s3_key, upload_status
                      FROM photos
                      WHERE album_event_id = $1::uuid
                        AND source_provider = $2
                        AND source_external_id = $3
                        AND COALESCE(is_deleted, false) = false
                      ORDER BY created_at DESC
                      LIMIT 1
                      `,
                      [event.id, sourceProvider, sourceExternalId],
                    )
                  : null;

              if (existing?.upload_status === "completed") {
                return {
                  id: existing.id,
                  fileName: file.fileName,
                  size: file.size,
                  contentType: contentTypeFromFile(file),
                  originalS3Key: existing.original_s3_key,
                  skipped: true,
                };
              }

              const keys = buildPhotoKeys(
                album.slug,
                event.slug,
                file.fileName,
                event.source_prefix
              );
              const contentType = contentTypeFromFile(file);
              const row = existing ?? await queryOne<PhotoInsertRow>(
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
                  width,
                  height,
                  original_taken_at,
                  source_provider,
                  source_external_id,
                  source_modified_at,
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
                  $15,
                  $16,
                  $17,
                  $18,
                  $19,
                  $20,
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
                  imageDimensionValue(file.width),
                  imageDimensionValue(file.height),
                  originalTakenAtValue(file.originalTakenAt),
                  sourceProvider,
                  sourceExternalId,
                  originalTakenAtValue(file.sourceModifiedAt),
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
            } catch (err: any) {
              attempt++;
              if (attempt > 2) throw err;
              await new Promise((resolve) =>
                setTimeout(resolve, 500 * 2 ** (attempt - 1)),
              );
            }
          }
        })
      );
      uploads.push(...chunkResults);
    }

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

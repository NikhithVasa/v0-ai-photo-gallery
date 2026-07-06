import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { query, queryOne, withTransaction } from "@/lib/db";
import { customerPublicUrl } from "@/lib/customer-host";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";
import { copyS3Object } from "@/lib/s3";

const DEFAULT_AI_WORKER_LAMBDA_URL =
  "https://ytwjenx44g62fzjrrb2wdad6gi0pnbrt.lambda-url.us-east-1.on.aws/";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface AlbumRow {
  id: string;
  slug: string;
  name: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_slug: string | null;
}

interface ShareRow {
  token: string;
}

interface SourcePhotoRow {
  id: string;
  file_name: string | null;
  file_size_bytes: number | string | null;
  width: number | null;
  height: number | null;
  source_key: string | null;
  ai_input_s3_key: string | null;
  clean_preview_s3_key: string | null;
  watermarked_preview_s3_key: string | null;
  thumbnail_s3_key: string | null;
  annotated_s3_key: string | null;
  caption: string | null;
  search_text: string | null;
}

interface PreparedPhotoCopy extends SourcePhotoRow {
  photoUuid: string;
  originalS3Key: string;
  aiInputS3Key: string;
  annotatedS3Key: string;
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

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function uniqueUuidList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter(isUuid))).slice(0, 500);
}

function cleanName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
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

function numberValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || null;
  return null;
}

async function availableAlbumSlug(name: string) {
  const baseSlug = slugify(name);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${randomUUID().slice(0, 8)}`;
    const existing = await queryOne<{ id: string }>(
      `
      SELECT id
      FROM albums
      WHERE slug = $1
      LIMIT 1
      `,
      [candidate],
    );

    if (!existing) return candidate;
  }

  return `${baseSlug}-${randomUUID()}`;
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
    annotatedS3Key: `${base}/annotated/${photoUuid}.jpg`,
  };
}

function albumShareUrl(request: Request, albumSlug: string, token: string, customerSlug: string | null) {
  const baseUrl = customerSlug
    ? `${customerPublicUrl(customerSlug)}/albums/${encodeURIComponent(albumSlug)}`
    : `${new URL(request.url).origin}/albums/${encodeURIComponent(albumSlug)}`;
  return `${baseUrl}?share=${encodeURIComponent(token)}`;
}

function selectionShareUrl(request: Request, album: AlbumRow, token: string) {
  const url = new URL(albumShareUrl(request, album.slug, token, album.customer_slug));
  return url.toString();
}

function aiWorkerAdminKey() {
  return (
    process.env.ADMIN_KEY ||
    process.env.AI_WORKER_ADMIN_KEY ||
    process.env.RUNPOD_ADMIN_KEY ||
    ""
  ).trim();
}

async function startAiWorker(album: AlbumRow, event: { id: string; slug: string; name: string }) {
  const adminKey = aiWorkerAdminKey();
  if (!adminKey) return { configured: false, error: "AI worker admin key is not configured" };

  const lambdaUrl =
    process.env.AI_WORKER_LAMBDA_URL?.trim() || DEFAULT_AI_WORKER_LAMBDA_URL;
  const input = {
    mode: "album_pipeline",
    album_slug: album.slug,
    album_name: album.name,
    events: [
      {
        name: event.name,
        slug: event.slug,
        source_prefix: `albums/${album.slug}/events/${event.slug}/originals/`,
      },
    ],
    cleanup_temp: false,
    steps: {
      ingest: false,
      compress: true,
      image_embedding: true,
      face_index: true,
      safe_people_reconcile: true,
      crop_person_covers: true,
      enqueue_qwen: true,
      rebuild_people: true,
      qwen: true,
      embeddings: true,
      culling: true,
      cleanup_temp: false,
    },
  };

  const response = await fetch(lambdaUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
    },
    body: JSON.stringify({
      albumId: album.id,
      eventId: event.id,
      mode: "new_photos_only",
      full_mode: false,
      input,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  return {
    configured: true,
    ok: response.ok && payload.ok !== false,
    status: response.status,
    payload,
  };
}

async function fetchAlbum(albumSlug: string) {
  return queryOne<AlbumRow>(
    `
    SELECT
      a.id,
      a.slug,
      a.name,
      a.customer_id,
      c.name AS customer_name,
      c.slug AS customer_slug
    FROM albums a
    LEFT JOIN customers c
      ON c.id = a.customer_id
     AND COALESCE(c.is_deleted, false) = false
    WHERE lower(a.slug) = lower($1)
      AND COALESCE(a.is_deleted, false) = false
    LIMIT 1
    `,
    [albumSlug],
  );
}

async function getOrCreateShareToken(album: AlbumRow) {
  await ensureAlbumShareLinkSchema();

  const existing = await queryOne<ShareRow>(
    `
    SELECT token
    FROM album_share_links
    WHERE album_id = $1::uuid
      AND person_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [album.id],
  );

  if (existing?.token) return existing.token;

  const token = randomUUID().replace(/-/g, "");
  const inserted = await queryOne<ShareRow>(
    `
    INSERT INTO album_share_links (
      id,
      token,
      album_id,
      customer_id,
      album_name,
      customer_name,
      allow_downloads,
      hide_ai,
      watermark_enabled,
      watermark_text,
      watermark_mode,
      watermark_positions,
      expires_at,
      background_color,
      passcode,
      created_at,
      updated_at
    )
    VALUES (
      $1::uuid,
      $2,
      $3::uuid,
      $4::uuid,
      $5,
      $6,
      true,
      false,
      false,
      $7,
      'corners',
      ARRAY['bottom_right']::text[],
      NULL,
      '#f5f5f7',
      NULL,
      now(),
      now()
    )
    RETURNING token
    `,
    [
      randomUUID(),
      token,
      album.id,
      album.customer_id,
      album.name,
      album.customer_name,
      album.customer_name || album.name,
    ],
  );

  if (!inserted?.token) throw new Error("Could not create share link");
  return inserted.token;
}

async function fetchSourcePhotos(albumId: string, photoIds: string[]) {
  const rows = await query<SourcePhotoRow>(
    `
    WITH selected AS (
      SELECT input.photo_id, input.position
      FROM unnest($2::uuid[]) WITH ORDINALITY AS input(photo_id, position)
    )
    SELECT
      p.id,
      p.file_name,
      p.file_size_bytes,
      p.width,
      p.height,
      COALESCE(
        p.original_s3_key,
        p.source_s3_key,
        p.ai_input_s3_key,
        p.clean_preview_s3_key,
        p.watermarked_preview_s3_key,
        p.thumbnail_s3_key
      ) AS source_key,
      p.ai_input_s3_key,
      p.clean_preview_s3_key,
      p.watermarked_preview_s3_key,
      p.thumbnail_s3_key,
      p.annotated_s3_key,
      p.caption,
      p.search_text
    FROM selected
    JOIN photos p
      ON p.id = selected.photo_id
     AND p.album_id = $1::uuid
     AND COALESCE(p.is_deleted, false) = false
    WHERE COALESCE(
      p.original_s3_key,
      p.source_s3_key,
      p.ai_input_s3_key,
      p.clean_preview_s3_key,
      p.watermarked_preview_s3_key,
      p.thumbnail_s3_key
    ) IS NOT NULL
    ORDER BY selected.position
    `,
    [albumId, photoIds],
  );

  if (rows.length !== photoIds.length) {
    throw new Error("Some selected photos could not be copied");
  }

  return rows;
}

async function copyPreparedPhotoObjects(photos: PreparedPhotoCopy[]) {
  for (let index = 0; index < photos.length; index += 8) {
    const chunk = photos.slice(index, index + 8);
    await Promise.all(
      chunk.map((photo) =>
        copyS3Object({
          sourceKey: photo.source_key as string,
          destinationKey: photo.originalS3Key,
        }),
      ),
    );
  }
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json()) as {
      name?: unknown;
      albumName?: unknown;
      eventName?: unknown;
      photoIds?: unknown;
    };
    const albumName = cleanName(body.albumName ?? body.name);
    const eventName = cleanName(body.eventName);
    const photoIds = uniqueUuidList(body.photoIds);

    if (!albumName || !eventName) {
      return NextResponse.json(
        { error: "Album name and event name are required" },
        { status: 400 },
      );
    }

    if (!photoIds.length) {
      return NextResponse.json(
        { error: "Select at least one photo" },
        { status: 400 },
      );
    }

    const album = await fetchAlbum(albumSlug);
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const newAlbumSlug = await availableAlbumSlug(albumName);
    const newEventSlug = slugify(eventName);
    const sourcePhotos = await fetchSourcePhotos(album.id, photoIds);
    const preparedPhotos: PreparedPhotoCopy[] = sourcePhotos.map((photo) => {
      const keys = buildPhotoKeys(
        newAlbumSlug,
        newEventSlug,
        photo.file_name || `${photo.id}.jpg`,
      );

      return {
        ...photo,
        ...keys,
      };
    });

    await copyPreparedPhotoObjects(preparedPhotos);

    const created = await withTransaction(async (client) => {
      const insertedAlbum = await client.query<AlbumRow>(
        `
        INSERT INTO albums(
          name,
          slug,
          description,
          album_date,
          expires_at,
          customer_id,
          password_hash,
          password_required,
          created_by,
          watermark_enabled,
          created_at,
          updated_at
        )
        SELECT
          $2,
          $3,
          a.description,
          a.album_date,
          a.expires_at,
          a.customer_id,
          NULL,
          false,
          'culling-selection-create',
          COALESCE(a.watermark_enabled, false),
          now(),
          now()
        FROM albums a
        WHERE a.id = $1::uuid
        RETURNING id, slug, name, customer_id, NULL::text AS customer_name, $4::text AS customer_slug
        `,
        [album.id, albumName, newAlbumSlug, album.customer_slug],
      );
      const newAlbum = insertedAlbum.rows[0];
      if (!newAlbum) throw new Error("Could not create album");

      const insertedEvent = await client.query<{ id: string; slug: string; name: string }>(
        `
        INSERT INTO album_events(album_id, customer_id, name, slug, sort_order, created_at, updated_at)
        VALUES(
          $1::uuid,
          $2::uuid,
          $3,
          $4,
          1,
          now(),
          now()
        )
        RETURNING id, slug, name
        `,
        [newAlbum.id, album.customer_id, eventName, newEventSlug],
      );
      const targetEvent = insertedEvent.rows[0];
      if (!targetEvent) throw new Error("Could not create event");

      const insertedPhotos = await client.query<{ id: string }>(
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
          original_s3_key,
          ai_input_s3_key,
          clean_preview_s3_key,
          watermarked_preview_s3_key,
          thumbnail_s3_key,
          annotated_s3_key,
          caption,
          search_text,
          upload_status,
          compression_status,
          watermark_status,
          face_index_status,
          qwen_status,
          search_index_status,
          custom_sort_order,
          created_at,
          updated_at
        )
        SELECT
          $1::uuid,
          $2::uuid,
          input.photo_uuid,
          input.original_s3_key,
          $3,
          $4,
          input.file_name,
          input.file_size_bytes,
          input.width,
          input.height,
          input.original_s3_key,
          input.ai_input_s3_key,
          input.clean_preview_s3_key,
          input.watermarked_preview_s3_key,
          input.thumbnail_s3_key,
          input.annotated_s3_key,
          input.caption,
          input.search_text,
          'completed',
          'pending',
          'pending',
          'pending',
          'pending',
          'pending',
          input.position::int,
          now(),
          now()
        FROM unnest(
          $5::uuid[],
          $6::text[],
          $7::bigint[],
          $8::int[],
          $9::int[],
          $10::text[],
          $11::text[],
          $12::text[],
          $13::text[],
          $14::text[],
          $15::text[],
          $16::text[],
          $17::text[]
        ) WITH ORDINALITY AS input(
          photo_uuid,
          file_name,
          file_size_bytes,
          width,
          height,
          original_s3_key,
          ai_input_s3_key,
          clean_preview_s3_key,
          watermarked_preview_s3_key,
          thumbnail_s3_key,
          annotated_s3_key,
          caption,
          search_text,
          position
        )
        RETURNING id
        `,
        [
          newAlbum.id,
          targetEvent.id,
          newAlbum.slug,
          targetEvent.slug,
          preparedPhotos.map((photo) => photo.photoUuid),
          preparedPhotos.map((photo) => photo.file_name || `${photo.id}.jpg`),
          preparedPhotos.map((photo) => numberValue(photo.file_size_bytes)),
          preparedPhotos.map((photo) => photo.width),
          preparedPhotos.map((photo) => photo.height),
          preparedPhotos.map((photo) => photo.originalS3Key),
          preparedPhotos.map((photo) => photo.aiInputS3Key),
          preparedPhotos.map((photo) => photo.clean_preview_s3_key),
          preparedPhotos.map((photo) => photo.watermarked_preview_s3_key),
          preparedPhotos.map((photo) => photo.thumbnail_s3_key),
          preparedPhotos.map((photo) => photo.annotatedS3Key),
          preparedPhotos.map((photo) => photo.caption),
          preparedPhotos.map((photo) => photo.search_text),
        ],
      );

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
        SELECT
          $1::uuid,
          $2::uuid,
          photo.id,
          job.job_type,
          'pending',
          now(),
          now()
        FROM unnest($3::uuid[]) AS photo(id)
        CROSS JOIN (VALUES ('compress_photo'), ('face_index_photo')) AS job(job_type)
        ON CONFLICT(photo_id, job_type) DO UPDATE SET
          status = 'pending',
          error_message = NULL,
          updated_at = now()
        `,
        [newAlbum.id, targetEvent.id, insertedPhotos.rows.map((row) => row.id)],
      );

      return {
        album: newAlbum,
        event: targetEvent,
        copiedCount: insertedPhotos.rows.length,
      };
    });

    const token = await getOrCreateShareToken(created.album);
    const lambda = await startAiWorker(created.album, created.event);

    return NextResponse.json({
      album: {
        id: created.album.id,
        slug: created.album.slug,
        name: created.album.name,
      },
      event: {
        id: created.event.id,
        slug: created.event.slug,
        name: created.event.name,
        photoCount: created.copiedCount,
      },
      shareUrl: selectionShareUrl(request, created.album, token),
      lambda,
    });
  } catch (error) {
    console.error("Error creating selection album:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create selection album",
      },
      { status: 500 },
    );
  }
}
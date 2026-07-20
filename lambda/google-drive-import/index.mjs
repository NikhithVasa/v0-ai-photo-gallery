import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Signer } from "@aws-sdk/rds-signer";
import pg from "pg";

// Values set here take precedence over Lambda environment variables. The Drive
// API key is the only missing value; paste it below to stop forwarding it from
// the app, or leave it blank to keep using NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY.
const HARDCODED_ENV = Object.freeze({
  GOOGLE_DRIVE_API_KEY: "",
  S3_BUCKET: "nikhith-ai-photo-gallery-dev",
  AWS_REGION: "us-east-1",
  DATABASE_URL: "",
  RDS_HOST: "photo-gallery-postgres-dev.c7o2u4ouqyim.us-east-1.rds.amazonaws.com",
  RDS_PORT: "5432",
  RDS_USER: "postgres",
  RDS_DB: "postgres",
  RDS_PASSWORD: "PhotoWorkerPassword123!",
  PG_SSL: "true",
  PG_POOL_MAX: "4",
  DRIVE_LIST_CONCURRENCY: "4",
  DRIVE_IMPORT_CONCURRENCY: "3",
});

let invocationGoogleDriveApiKey = "";

function configurationValue(name) {
  const hardcodedValue = HARDCODED_ENV[name]?.trim();
  if (hardcodedValue) return hardcodedValue;
  if (name === "GOOGLE_DRIVE_API_KEY" && invocationGoogleDriveApiKey) {
    return invocationGoogleDriveApiKey;
  }
  return process.env[name]?.trim() || "";
}

const { Pool } = pg;
const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const DRIVE_API_BASE_URL = "https://www.googleapis.com/drive/v3";
const SOURCE_PROVIDER = "google-drive";
const LIST_CONCURRENCY = positiveInteger(configurationValue("DRIVE_LIST_CONCURRENCY"), 4, 12);
const IMPORT_CONCURRENCY = positiveInteger(configurationValue("DRIVE_IMPORT_CONCURRENCY"), 3, 10);
const s3 = new S3Client({
  region: configurationValue("AWS_REGION"),
  requestChecksumCalculation: "WHEN_REQUIRED",
  requestStreamBufferSize: 65_536,
});
let poolPromise;
let sourceSchemaPromise;

function positiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function requiredEnv(name) {
  const value = configurationValue(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function normalizeDatabaseUrl(value) {
  const url = new URL(value);
  for (const parameter of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
    url.searchParams.delete(parameter);
  }
  return url.toString();
}

async function createPool() {
  const connectionString = configurationValue("DATABASE_URL");
  if (connectionString) {
    return new Pool({
      connectionString: normalizeDatabaseUrl(connectionString),
      max: positiveInteger(configurationValue("PG_POOL_MAX"), 4, 10),
      idleTimeoutMillis: 1_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
      ssl: configurationValue("PG_SSL") === "false" ? false : { rejectUnauthorized: false },
      application_name: "google-drive-import-lambda",
    });
  }

  const host = requiredEnv("RDS_HOST");
  const port = positiveInteger(configurationValue("RDS_PORT"), 5_432, 65_535);
  const user = requiredEnv("RDS_USER");
  const region = requiredEnv("AWS_REGION");
  const configuredPassword = configurationValue("RDS_PASSWORD");
  const signer = configuredPassword
    ? null
    : new Signer({ hostname: host, port, username: user, region });
  const password = configuredPassword || (() => signer.getAuthToken());

  return new Pool({
    host,
    port,
    user,
    database: configurationValue("RDS_DB") || "postgres",
    password,
    max: positiveInteger(configurationValue("PG_POOL_MAX"), 4, 10),
    idleTimeoutMillis: 1_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    ssl: configurationValue("PG_SSL") === "false" ? false : { rejectUnauthorized: false },
    application_name: "google-drive-import-lambda",
  });
}

async function getPool() {
  poolPromise ??= createPool().catch((error) => {
    poolPromise = undefined;
    throw error;
  });
  return poolPromise;
}

async function ensureSourceSchema() {
  sourceSchemaPromise ??= (async () => {
    const pool = await getPool();
    await pool.query(`
      ALTER TABLE photos
        ADD COLUMN IF NOT EXISTS source_provider text,
        ADD COLUMN IF NOT EXISTS source_external_id text,
        ADD COLUMN IF NOT EXISTS source_modified_at timestamptz
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS photos_source_identity_idx
      ON photos (album_event_id, source_provider, source_external_id)
      WHERE source_provider IS NOT NULL
        AND source_external_id IS NOT NULL
        AND COALESCE(is_deleted, false) = false
    `);
  })().catch((error) => {
    sourceSchemaPromise = undefined;
    throw error;
  });
  return sourceSchemaPromise;
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || randomUUID();
}

function safeStem(fileName) {
  return slugify(fileName.replace(/\.[^.]+$/, ""));
}

function extensionFromFileName(fileName) {
  const match = fileName.toLowerCase().match(
    /\.(jpe?g|jpe|png|webp|gif|avif|heic|heif|nef|cr2|arw|dng|tiff?|bmp|jfif)$/,
  );
  return match ? `.${match[1]}` : ".jpg";
}

function normalizeSourcePrefix(value, albumSlug, eventSlug) {
  return (
    value
      ?.trim()
      .replace(/^s3:\/\/[^/]+\//, "")
      .replace(/^https?:\/\/[^/]+\//, "")
      .replace(/^\/+|\/+$/g, "") || `albums/${albumSlug}/events/${eventSlug}`
  );
}

function buildPhotoKeys(album, albumEvent, fileName) {
  const photoUuid = randomUUID();
  const base = normalizeSourcePrefix(
    albumEvent.source_prefix,
    album.slug,
    albumEvent.slug,
  );
  const stem = safeStem(fileName);
  const extension = extensionFromFileName(fileName);
  return {
    photoUuid,
    originalS3Key: `${base}/originals/${photoUuid}_${stem}${extension}`,
    aiInputS3Key: `${base}/ai-input/${photoUuid}.webp`,
    annotatedS3Key: `${base}/annotated/${photoUuid}.jpg`,
  };
}

export function parseFolderLink(folderLink) {
  let url;
  try {
    url = new URL(folderLink.trim());
  } catch {
    throw new Error("folderLink must be a valid Google Drive folder URL");
  }
  if (url.protocol !== "https:" || url.hostname !== "drive.google.com") {
    throw new Error("folderLink must be a public Google Drive folder URL");
  }
  const id =
    url.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1] ||
    url.pathname.match(/^\/folders\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1] ||
    (url.pathname === "/open" ? url.searchParams.get("id") : null);
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error("folderLink must identify a Google Drive folder");
  }
  return { id, resourceKey: url.searchParams.get("resourcekey") || undefined };
}

export function validateEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new Error("Invocation payload must be an object");
  }
  const allowed = new Set([
    "requestId",
    "folderLink",
    "mode",
    "albumSlug",
    "albumName",
    "eventSlug",
    "eventName",
    "runAi",
    "googleDriveApiKey",
  ]);
  for (const key of Object.keys(event)) {
    if (!allowed.has(key)) throw new Error(`Unexpected invocation field: ${key}`);
  }
  if (typeof event.requestId !== "string" || !event.requestId.trim()) {
    throw new Error("requestId is required");
  }
  if (typeof event.folderLink !== "string") throw new Error("folderLink is required");
  if (event.mode !== "new" && event.mode !== "existing") {
    throw new Error("mode must be new or existing");
  }
  if (event.runAi !== undefined && typeof event.runAi !== "boolean") {
    throw new Error("runAi must be a boolean");
  }

  const text = (name) => {
    const value = event[name];
    if (value === undefined) return undefined;
    if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string`);
    return value.trim();
  };
  const input = {
    requestId: event.requestId.trim(),
    folderLink: event.folderLink.trim(),
    mode: event.mode,
    albumSlug: text("albumSlug"),
    albumName: text("albumName"),
    eventSlug: text("eventSlug"),
    eventName: text("eventName"),
    googleDriveApiKey: text("googleDriveApiKey"),
    runAi: event.runAi !== false,
  };
  parseFolderLink(input.folderLink);
  if (input.mode === "new") {
    if (!input.albumName || !input.eventName || input.albumSlug || input.eventSlug) {
      throw new Error("new mode requires albumName and eventName only");
    }
  } else if (!input.albumSlug || (!input.eventSlug && !input.eventName)) {
    throw new Error("existing mode requires albumSlug and eventSlug or eventName");
  }
  return input;
}

async function hasEventSourcePrefix(client) {
  const { rows } = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'album_events'
        AND column_name = 'source_prefix'
    ) AS exists
  `);
  return Boolean(rows[0]?.exists);
}

async function resolveTarget(input) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let album;
    if (input.mode === "new") {
      const slug = slugify(input.albumName);
      const result = await client.query(
        `
        INSERT INTO albums(
          name, slug, password_hash, password_required, created_by,
          watermark_enabled, created_at, updated_at
        )
        VALUES($1, $2, NULL, false, 'google-drive-import', false, now(), now())
        ON CONFLICT(slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
        RETURNING id, slug, name, customer_id
        `,
        [input.albumName, slug],
      );
      album = result.rows[0];
    } else {
      const result = await client.query(
        `
        SELECT id, slug, name, customer_id
        FROM albums
        WHERE lower(slug) = lower($1) AND COALESCE(is_deleted, false) = false
        LIMIT 1
        `,
        [input.albumSlug],
      );
      album = result.rows[0];
    }
    if (!album) throw new Error("Album not found");

    const sourcePrefixSupported = await hasEventSourcePrefix(client);
    let albumEvent;
    if (input.eventName) {
      const slug = slugify(input.eventName);
      const sourcePrefix = `albums/${album.slug}/events/${slug}`;
      const result = sourcePrefixSupported
        ? await client.query(
            `
            INSERT INTO album_events(
              album_id, customer_id, name, slug, source_prefix, sort_order, created_at, updated_at
            )
            VALUES(
              $1::uuid, $2::uuid, $3, $4, $5,
              COALESCE((SELECT MAX(sort_order) + 1 FROM album_events WHERE album_id = $1::uuid), 1),
              now(), now()
            )
            ON CONFLICT(album_id, slug) DO UPDATE SET
              name = EXCLUDED.name,
              customer_id = EXCLUDED.customer_id,
              source_prefix = COALESCE(album_events.source_prefix, EXCLUDED.source_prefix),
              updated_at = now()
            RETURNING id, slug, name, source_prefix
            `,
            [album.id, album.customer_id, input.eventName, slug, sourcePrefix],
          )
        : await client.query(
            `
            INSERT INTO album_events(
              album_id, customer_id, name, slug, sort_order, created_at, updated_at
            )
            VALUES(
              $1::uuid, $2::uuid, $3, $4,
              COALESCE((SELECT MAX(sort_order) + 1 FROM album_events WHERE album_id = $1::uuid), 1),
              now(), now()
            )
            ON CONFLICT(album_id, slug) DO UPDATE SET
              name = EXCLUDED.name,
              customer_id = EXCLUDED.customer_id,
              updated_at = now()
            RETURNING id, slug, name, NULL::text AS source_prefix
            `,
            [album.id, album.customer_id, input.eventName, slug],
          );
      albumEvent = result.rows[0];
    } else {
      const result = await client.query(
        `
        SELECT id, slug, name, ${sourcePrefixSupported ? "source_prefix" : "NULL::text AS source_prefix"}
        FROM album_events
        WHERE album_id = $1::uuid
          AND lower(slug) = lower($2)
          AND COALESCE(is_deleted, false) = false
        LIMIT 1
        `,
        [album.id, input.eventSlug],
      );
      albumEvent = result.rows[0];
    }
    if (!albumEvent) throw new Error("Event not found");
    await client.query("COMMIT");
    return { album, albumEvent };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function driveHeaders(file) {
  return file.resourceKey
    ? { "X-Goog-Drive-Resource-Keys": `${file.id}/${file.resourceKey}` }
    : {};
}

async function driveFetch(path, file, responseType = "json") {
  const apiKey = requiredEnv("GOOGLE_DRIVE_API_KEY");
  const url = new URL(`${DRIVE_API_BASE_URL}${path}`);
  url.searchParams.set("key", apiKey);
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: driveHeaders(file) });
      if (response.ok) return responseType === "stream" ? response : response.json();
      const detail = await response.text();
      const error = new Error(`Google Drive API ${response.status}: ${detail.slice(0, 500)}`);
      error.status = response.status;
      if (response.status !== 429 && response.status < 500) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (error.status && error.status !== 429 && error.status < 500) throw error;
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw lastError || new Error("Google Drive request failed");
}

async function getRootFolder(parsed) {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,resourceKey,webViewLink",
    supportsAllDrives: "true",
  });
  const payload = await driveFetch(
    `/files/${encodeURIComponent(parsed.id)}?${params}`,
    parsed,
  );
  if (payload.mimeType !== DRIVE_FOLDER_MIME_TYPE) {
    throw new Error("The Google Drive link does not identify a folder");
  }
  return {
    id: payload.id || parsed.id,
    name: payload.name || "Google Drive folder",
    mimeType: payload.mimeType,
    resourceKey: payload.resourceKey || parsed.resourceKey,
    webViewLink: payload.webViewLink,
  };
}

async function listFolderChildren(folder) {
  const files = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      fields: "nextPageToken,files(id,name,mimeType,resourceKey,size,modifiedTime,webViewLink,capabilities(canDownload))",
      pageSize: "1000",
      q: `'${folder.id.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' in parents and trashed = false`,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const payload = await driveFetch(`/files?${params}`, folder);
    for (const file of payload.files || []) {
      if (!file.id || !file.mimeType) continue;
      if (file.mimeType === DRIVE_FOLDER_MIME_TYPE || file.mimeType.startsWith("image/")) {
        files.push({
          ...file,
          size: file.size ? Number(file.size) : undefined,
        });
      }
    }
    pageToken = payload.nextPageToken;
  } while (pageToken);
  return files;
}

async function discoverImages(root) {
  const queue = [root];
  const seenFolders = new Set();
  const seenImages = new Set();
  const images = [];
  const errors = [];
  while (queue.length) {
    const batch = queue.splice(0, LIST_CONCURRENCY).filter((folder) => {
      if (seenFolders.has(folder.id)) return false;
      seenFolders.add(folder.id);
      return true;
    });
    const results = await Promise.allSettled(batch.map(listFolderChildren));
    results.forEach((result, index) => {
      const folder = batch[index];
      if (result.status === "rejected") {
        errors.push({
          kind: "folder",
          id: folder.id,
          name: folder.name,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
        return;
      }
      for (const child of result.value) {
        if (child.mimeType === DRIVE_FOLDER_MIME_TYPE) {
          if (!seenFolders.has(child.id)) queue.push(child);
        } else if (!seenImages.has(child.id)) {
          seenImages.add(child.id);
          images.push(child);
        }
      }
    });
  }
  return { images, folderCount: seenFolders.size, errors };
}

async function reservePhoto(album, albumEvent, file) {
  const pool = await getPool();
  const client = await pool.connect();
  let locked = false;
  const release = async () => {
    if (locked) {
      locked = false;
      await client
        .query("SELECT pg_advisory_unlock(hashtext($1), hashtext($2))", [
          albumEvent.id,
          file.id,
        ])
        .catch(() => undefined);
    }
    client.release();
  };

  try {
    const lockResult = await client.query(
      "SELECT pg_try_advisory_lock(hashtext($1), hashtext($2)) AS locked",
      [albumEvent.id, file.id],
    );
    locked = Boolean(lockResult.rows[0]?.locked);
    if (!locked) {
      await release();
      return { claimed: false };
    }

    const existingResult = await client.query(
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
      [albumEvent.id, SOURCE_PROVIDER, file.id],
    );
    const existing = existingResult.rows[0];
    if (existing?.upload_status === "completed") {
      await release();
      return { claimed: false, photo: existing };
    }
    if (existing) {
      const claimed = await client.query(
        `
        UPDATE photos
        SET upload_status = 'pending',
            file_name = $2,
            file_size_bytes = $3,
            source_modified_at = $4,
            updated_at = now()
        WHERE id = $1
        RETURNING id, original_s3_key, upload_status
        `,
        [
          existing.id,
          file.name,
          Number.isSafeInteger(file.size) ? file.size : null,
          file.modifiedTime || null,
        ],
      );
      return {
        claimed: true,
        retrying: true,
        photo: claimed.rows[0],
        client,
        release,
      };
    }

    const keys = buildPhotoKeys(album, albumEvent, file.name);
    const inserted = await client.query(
      `
      INSERT INTO photos(
        album_id, album_event_id, photo_uuid, source_s3_key,
        storage_album_slug, storage_event_slug, file_name, file_size_bytes,
        width, height, original_taken_at, source_provider, source_external_id,
        source_modified_at, original_s3_key, ai_input_s3_key,
        clean_preview_s3_key, watermarked_preview_s3_key, thumbnail_s3_key,
        annotated_s3_key, upload_status, compression_status, watermark_status,
        face_index_status, qwen_status, search_index_status, created_at, updated_at
      )
      VALUES(
        $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8,
        NULL, NULL, NULL, $9, $10, $11, $4, $12,
        NULL, NULL, NULL, $13,
        'pending', 'pending', 'pending', 'pending', 'pending', 'pending', now(), now()
      )
      RETURNING id, original_s3_key, upload_status
      `,
      [
        album.id,
        albumEvent.id,
        keys.photoUuid,
        keys.originalS3Key,
        album.slug,
        albumEvent.slug,
        file.name,
        Number.isSafeInteger(file.size) ? file.size : null,
        SOURCE_PROVIDER,
        file.id,
        file.modifiedTime || null,
        keys.aiInputS3Key,
        keys.annotatedS3Key,
      ],
    );
    return {
      claimed: true,
      retrying: false,
      photo: inserted.rows[0],
      client,
      release,
    };
  } catch (error) {
    await release();
    throw error;
  }
}

async function objectExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: requiredEnv("S3_BUCKET"), Key: key }));
    return true;
  } catch (error) {
    if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) return false;
    throw error;
  }
}

async function downloadToS3(file, key) {
  if (file.capabilities?.canDownload === false) {
    throw new Error("Google Drive does not allow this file to be downloaded");
  }
  const params = new URLSearchParams({ alt: "media", supportsAllDrives: "true" });
  const response = await driveFetch(
    `/files/${encodeURIComponent(file.id)}?${params}`,
    file,
    "stream",
  );
  if (!response.body) throw new Error("Google Drive returned an empty response body");
  await s3.send(
    new PutObjectCommand({
      Bucket: requiredEnv("S3_BUCKET"),
      Key: key,
      Body: Readable.fromWeb(response.body),
      ContentType: file.mimeType,
      ContentLength: Number.isSafeInteger(file.size) ? file.size : undefined,
      Metadata: {
        "source-provider": SOURCE_PROVIDER,
        "source-file-id": file.id,
        "source-modified-at": file.modifiedTime || "",
        "source-resource-key": file.resourceKey || "",
        "source-file-name": encodeURIComponent(file.name).slice(0, 1_024),
      },
    }),
  );
}

async function completePhoto(client, photoId, runAi) {
  try {
    await client.query("BEGIN");
    await client.query(
      `
      UPDATE photos
      SET upload_status = 'completed',
          face_index_status = CASE WHEN $2::boolean THEN face_index_status ELSE 'skipped' END,
          qwen_status = CASE WHEN $2::boolean THEN qwen_status ELSE 'skipped' END,
          search_index_status = CASE WHEN $2::boolean THEN search_index_status ELSE 'skipped' END,
          updated_at = now()
      WHERE id = $1
      `,
      [photoId, runAi],
    );
    await client.query(
      `
      INSERT INTO processing_jobs(
        album_id, album_event_id, photo_id, job_type, status, created_at, updated_at
      )
      SELECT album_id, album_event_id, id, 'compress_photo', 'pending', now(), now()
      FROM photos WHERE id = $1
      ON CONFLICT(photo_id, job_type) DO UPDATE SET
        status = 'pending', error_message = NULL, updated_at = now()
      `,
      [photoId],
    );
    if (runAi) {
      await client.query(
        `
        INSERT INTO processing_jobs(
          album_id, album_event_id, photo_id, job_type, status, created_at, updated_at
        )
        SELECT album_id, album_event_id, id, 'face_index_photo', 'pending', now(), now()
        FROM photos WHERE id = $1
        ON CONFLICT(photo_id, job_type) DO UPDATE SET
          status = 'pending', error_message = NULL, updated_at = now()
        `,
        [photoId],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function markPhotoFailed(client, photoId) {
  await client.query(
    `UPDATE photos SET upload_status = 'failed', updated_at = now() WHERE id = $1 AND upload_status = 'pending'`,
    [photoId],
  );
}

async function importFile(target, file, runAi) {
  const reservation = await reservePhoto(target.album, target.albumEvent, file);
  if (!reservation.claimed) return { status: "skipped", photoId: reservation.photo?.id };
  const photo = reservation.photo;
  try {
    const alreadyUploaded = reservation.retrying && (await objectExists(photo.original_s3_key));
    if (!alreadyUploaded) await downloadToS3(file, photo.original_s3_key);
    await completePhoto(reservation.client, photo.id, runAi);
    return { status: "imported", photoId: photo.id };
  } catch (error) {
    await markPhotoFailed(reservation.client, photo.id).catch((markError) => {
      console.error("Failed to mark photo import failed", { photoId: photo.id, markError });
    });
    throw error;
  } finally {
    await reservation.release();
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

export async function handler(event) {
  const input = validateEvent(event);
  invocationGoogleDriveApiKey = input.googleDriveApiKey || "";
  requiredEnv("GOOGLE_DRIVE_API_KEY");
  requiredEnv("S3_BUCKET");
  await ensureSourceSchema();
  const target = await resolveTarget(input);
  const parsedFolder = parseFolderLink(input.folderLink);
  const root = await getRootFolder(parsedFolder);
  const discovery = await discoverImages(root);
  const results = await mapWithConcurrency(
    discovery.images,
    IMPORT_CONCURRENCY,
    (file) => importFile(target, file, input.runAi),
  );

  const errors = [...discovery.errors];
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  results.forEach((result, index) => {
    const file = discovery.images[index];
    if (result.status === "fulfilled") {
      if (result.value.status === "imported") imported += 1;
      else skipped += 1;
      return;
    }
    failed += 1;
    errors.push({
      kind: "file",
      id: file.id,
      name: file.name,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
  });

  const output = {
    requestId: input.requestId,
    folder: { id: root.id, name: root.name },
    album: { id: target.album.id, slug: target.album.slug },
    event: { id: target.albumEvent.id, slug: target.albumEvent.slug },
    counts: {
      foldersVisited: discovery.folderCount,
      imagesDiscovered: discovery.images.length,
      imported,
      skipped,
      failed,
      folderFailures: discovery.errors.length,
    },
    errors,
  };
  console.info(
    "[google-drive-import] completed",
    JSON.stringify({
      requestId: output.requestId,
      counts: output.counts,
      errorMessages: output.errors.slice(0, 10).map(({ error }) => error),
    }),
  );
  return output;
}

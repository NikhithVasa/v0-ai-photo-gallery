import { query, queryOne } from "@/lib/db";

export const PHOTO_SORT_MODES = [
  "title_asc",
  "title_desc",
  "added_newest",
  "added_oldest",
  "original_newest",
  "original_oldest",
  "rating",
  "custom",
] as const;

export type PhotoSortMode = (typeof PHOTO_SORT_MODES)[number];

export const DEFAULT_PHOTO_SORT_MODE: PhotoSortMode = "added_oldest";

const PHOTO_SORT_MODE_SET = new Set<string>(PHOTO_SORT_MODES);

let photoSortSchemaPromise: Promise<void> | null = null;

export function normalizePhotoSortMode(value: unknown): PhotoSortMode {
  return typeof value === "string" && PHOTO_SORT_MODE_SET.has(value)
    ? (value as PhotoSortMode)
    : DEFAULT_PHOTO_SORT_MODE;
}

export function ensurePhotoSortSchema() {
  photoSortSchemaPromise ??= (async () => {
    await query(
      `
      ALTER TABLE albums
        ADD COLUMN IF NOT EXISTS photo_sort_mode text NOT NULL DEFAULT 'added_oldest'
      `,
      [],
    );

    await query(
      `
      ALTER TABLE album_events
        ADD COLUMN IF NOT EXISTS photo_sort_mode text NOT NULL DEFAULT 'added_oldest'
      `,
      [],
    );

    await query(
      `
      ALTER TABLE photos
        ADD COLUMN IF NOT EXISTS original_taken_at timestamptz,
        ADD COLUMN IF NOT EXISTS custom_sort_order integer
      `,
      [],
    );

    await query(
      `
      CREATE TABLE IF NOT EXISTS photo_sort_positions (
        album_id uuid NOT NULL,
        album_event_id uuid,
        scope text NOT NULL,
        photo_id uuid NOT NULL,
        position integer NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (album_id, scope, photo_id)
      )
      `,
      [],
    );

    await query(
      `
      CREATE INDEX IF NOT EXISTS photos_album_event_custom_sort_idx
      ON photos (album_id, album_event_id, custom_sort_order)
      `,
      [],
    );

    await query(
      `
      CREATE INDEX IF NOT EXISTS photos_album_event_original_taken_idx
      ON photos (album_id, album_event_id, original_taken_at)
      `,
      [],
    );
  })().catch((error) => {
    photoSortSchemaPromise = null;
    throw error;
  });

  return photoSortSchemaPromise;
}

async function tableColumns(tableName: string) {
  const rows = await query<{ column_name: string }>(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = $1
    `,
    [tableName],
  );

  return new Set(rows.map((row) => row.column_name));
}

export async function photoOriginalDateExpression() {
  const columns = await tableColumns("photos");
  const candidates = [
    "taken_at",
    "captured_at",
    "original_taken_at",
    "original_created_at",
    "date_taken",
    "shot_at",
    "exif_created_at",
  ];
  const column = candidates.find((candidate) => columns.has(candidate));

  return column ? `p.${column}` : "p.created_at";
}

export async function photoRatingExpression() {
  const columns = await tableColumns("photos");

  if (columns.has("rating")) return "p.rating";
  if (columns.has("album_score")) return "p.album_score";
  if (!columns.has("qwen_json")) return "NULL::numeric";

  return `
    CASE
      WHEN (p.qwen_json::jsonb->'raw'->>'album_worthy_score') ~ '^\\d+(\\.\\d+)?$'
        THEN (p.qwen_json::jsonb->'raw'->>'album_worthy_score')::numeric
      WHEN (p.qwen_json::jsonb->>'album_worthy_score') ~ '^\\d+(\\.\\d+)?$'
        THEN (p.qwen_json::jsonb->>'album_worthy_score')::numeric
      ELSE NULL::numeric
    END
  `;
}

export async function photoOrderBySql(sortMode: PhotoSortMode) {
  const fileNameExpression = "lower(NULLIF(p.file_name, ''))";

  switch (sortMode) {
    case "title_asc":
      return `${fileNameExpression} ASC NULLS LAST, p.created_at ASC, p.id ASC`;
    case "title_desc":
      return `${fileNameExpression} DESC NULLS LAST, p.created_at ASC, p.id ASC`;
    case "added_newest":
      return "p.created_at DESC, p.id DESC";
    case "original_newest":
      return `${await photoOriginalDateExpression()} DESC NULLS LAST, p.created_at DESC, p.id DESC`;
    case "original_oldest":
      return `${await photoOriginalDateExpression()} ASC NULLS LAST, p.created_at ASC, p.id ASC`;
    case "rating":
      return `${await photoRatingExpression()} DESC NULLS LAST, p.created_at ASC, p.id ASC`;
    case "custom":
      return "COALESCE(pso.position, p.custom_sort_order) ASC NULLS LAST, p.created_at ASC, p.id ASC";
    case "added_oldest":
    default:
      return "p.created_at ASC, p.id ASC";
  }
}

export async function albumSortMode(albumSlug: string) {
  const row = await queryOne<{ photo_sort_mode: string | null }>(
    `
    SELECT photo_sort_mode
    FROM albums
    WHERE lower(slug) = lower($1)
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
    `,
    [albumSlug],
  );

  return normalizePhotoSortMode(row?.photo_sort_mode);
}

export async function eventSortMode(albumSlug: string, eventSlug: string) {
  const row = await queryOne<{ photo_sort_mode: string | null }>(
    `
    SELECT e.photo_sort_mode
    FROM album_events e
    JOIN albums a ON a.id = e.album_id
    WHERE lower(a.slug) = lower($1)
      AND e.slug = $2
      AND COALESCE(a.is_deleted, false) = false
      AND COALESCE(e.is_deleted, false) = false
    LIMIT 1
    `,
    [albumSlug, eventSlug],
  );

  return normalizePhotoSortMode(row?.photo_sort_mode);
}

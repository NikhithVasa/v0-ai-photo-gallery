import { query } from "@/lib/db";

let uploadSourceSchemaPromise: Promise<void> | null = null;

export function ensureUploadSourceSchema() {
  uploadSourceSchemaPromise ??= (async () => {
    await query(
      `
      ALTER TABLE photos
        ADD COLUMN IF NOT EXISTS source_provider text,
        ADD COLUMN IF NOT EXISTS source_external_id text,
        ADD COLUMN IF NOT EXISTS source_modified_at timestamptz
      `,
      [],
    );

    await query(
      `
      CREATE UNIQUE INDEX IF NOT EXISTS photos_source_identity_idx
      ON photos (album_event_id, source_provider, source_external_id)
      WHERE source_provider IS NOT NULL
        AND source_external_id IS NOT NULL
        AND COALESCE(is_deleted, false) = false
      `,
      [],
    );
  })().catch((error) => {
    uploadSourceSchemaPromise = null;
    throw error;
  });

  return uploadSourceSchemaPromise;
}

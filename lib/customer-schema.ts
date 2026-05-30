import { query } from "@/lib/db";

let customerAccessSchemaPromise: Promise<void> | null = null;

export function ensureCustomerAccessSchema() {
  customerAccessSchemaPromise ??= query(
    `
    ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS cover_photo_s3_key text,
      ADD COLUMN IF NOT EXISTS password_hash text,
      ADD COLUMN IF NOT EXISTS password_required boolean NOT NULL DEFAULT false
    `,
    []
  ).then(() => undefined);

  return customerAccessSchemaPromise;
}

let peopleMergeSchemaPromise: Promise<void> | null = null;

export function ensurePeopleMergeSchema() {
  peopleMergeSchemaPromise ??= (async () => {
    await query(
      `
      ALTER TABLE people
        ADD COLUMN IF NOT EXISTS merged_into_person_id uuid,
        ADD COLUMN IF NOT EXISTS merged_at timestamptz
      `,
      []
    );

    await query(
      `
      CREATE TABLE IF NOT EXISTS person_merge_history (
        id bigserial PRIMARY KEY,
        album_id uuid NOT NULL,
        target_person_id uuid NOT NULL,
        source_person_id uuid NOT NULL,
        cover_person_id uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      )
      `,
      []
    );
  })();

  return peopleMergeSchemaPromise;
}

let photoEditSchemaPromise: Promise<void> | null = null;

export function ensurePhotoEditSchema() {
  photoEditSchemaPromise ??= query(
    `
    CREATE TABLE IF NOT EXISTS photo_edits (
      id uuid PRIMARY KEY,
      album_id uuid NOT NULL,
      album_event_id uuid NOT NULL,
      photo_id uuid NOT NULL,
      source_s3_key text NOT NULL,
      edited_s3_key text,
      thumb_s3_key text,
      prompt text NOT NULL,
      preset_prompt_key text,
      status text NOT NULL DEFAULT 'pending',
      runpod_job_id text,
      response jsonb,
      error_message text,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
    `,
    []
  ).then(() => undefined);

  return photoEditSchemaPromise;
}

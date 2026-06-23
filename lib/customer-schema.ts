import { query } from "@/lib/db";

let customerAccessSchemaPromise: Promise<void> | null = null;

export async function ensureCustomerAccessSchema() {
  return;
}

let peopleMergeSchemaPromise: Promise<void> | null = null;

export function ensurePeopleMergeSchema() {
  peopleMergeSchemaPromise ??= (async () => {
    await query(
      `
      ALTER TABLE people
        ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
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
        cover_face_s3_key text,
        merged_photo_count integer,
        merged_face_count integer,
        created_at timestamptz NOT NULL DEFAULT now()
      )
      `,
      []
    );

    await query(
      `
      ALTER TABLE person_merge_history
        ADD COLUMN IF NOT EXISTS cover_face_s3_key text,
        ADD COLUMN IF NOT EXISTS merged_photo_count integer,
        ADD COLUMN IF NOT EXISTS merged_face_count integer
      `,
      []
    );

    await query(
      `
      CREATE INDEX IF NOT EXISTS people_merged_into_person_id_idx
      ON people (merged_into_person_id)
      `,
      []
    );

    await query(
      `
      CREATE INDEX IF NOT EXISTS person_merge_history_album_target_idx
      ON person_merge_history (album_id, target_person_id)
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

let albumShareLinkSchemaPromise: Promise<void> | null = null;

export function ensureAlbumShareLinkSchema() {
  albumShareLinkSchemaPromise ??= (async () => {
    await query(
      `
      CREATE TABLE IF NOT EXISTS album_share_links (
        id uuid PRIMARY KEY,
        token text NOT NULL UNIQUE,
        album_id uuid NOT NULL,
        customer_id uuid,
        album_name text NOT NULL,
        customer_name text,
        allow_downloads boolean NOT NULL DEFAULT false,
        hide_ai boolean NOT NULL DEFAULT false,
        watermark_enabled boolean NOT NULL DEFAULT false,
        watermark_text text,
        watermark_mode text NOT NULL DEFAULT 'corners',
        watermark_positions text[] NOT NULL DEFAULT ARRAY['bottom_right']::text[],
        expires_at date,
        background_color text NOT NULL DEFAULT '#f5f5f7',
        passcode text,
        person_id uuid,
        person_ids uuid[],
        person_name text,
        link_name text,
        only_person boolean NOT NULL DEFAULT false,
        allow_event_tabs boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
      `,
      []
    );

    await query(
      `
      ALTER TABLE album_share_links
        ADD COLUMN IF NOT EXISTS expires_at date,
        ADD COLUMN IF NOT EXISTS background_color text NOT NULL DEFAULT '#f5f5f7',
        ADD COLUMN IF NOT EXISTS passcode text,
        ADD COLUMN IF NOT EXISTS person_id uuid,
        ADD COLUMN IF NOT EXISTS person_ids uuid[],
        ADD COLUMN IF NOT EXISTS person_name text,
        ADD COLUMN IF NOT EXISTS link_name text,
        ADD COLUMN IF NOT EXISTS only_person boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS allow_event_tabs boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS hide_ai boolean NOT NULL DEFAULT false
      `,
      []
    );

    await query(
      `
      CREATE INDEX IF NOT EXISTS album_share_links_album_id_idx
      ON album_share_links (album_id)
      `,
      []
    );

    await query(
      `
      CREATE INDEX IF NOT EXISTS album_share_links_token_idx
      ON album_share_links (token)
      `,
      []
    );

    await query(
      `
      CREATE INDEX IF NOT EXISTS album_share_links_person_id_idx
      ON album_share_links (person_id)
      `,
      []
    );
  })().catch((error) => {
    albumShareLinkSchemaPromise = null;
    throw error;
  });

  return albumShareLinkSchemaPromise;
}

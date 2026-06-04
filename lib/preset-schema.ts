import { query } from "@/lib/db";

let presetSchemaPromise: Promise<void> | null = null;

export function ensurePresetSchema() {
  presetSchemaPromise ??= (async () => {
    await query(
      `
      CREATE TABLE IF NOT EXISTS presets (
        id uuid PRIMARY KEY,
        owner_email text NOT NULL,
        name text NOT NULL,
        description text,
        creator_name text NOT NULL,
        category text NOT NULL,
        tags text[] NOT NULL DEFAULT '{}',
        best_for text[] NOT NULL DEFAULT '{}',
        visibility text NOT NULL DEFAULT 'private',
        status text NOT NULL DEFAULT 'published',
        lut_s3_key text NOT NULL,
        lut_size integer NOT NULL,
        preview_before_s3_key text NOT NULL,
        preview_after_s3_key text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
      `,
      [],
    );

    await query(
      `
      CREATE TABLE IF NOT EXISTS preset_saves (
        preset_id uuid NOT NULL,
        user_email text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (preset_id, user_email)
      )
      `,
      [],
    );

    await query(
      `
      CREATE TABLE IF NOT EXISTS preset_applications (
        id uuid PRIMARY KEY,
        preset_id uuid NOT NULL,
        album_id uuid NOT NULL,
        album_event_id uuid NOT NULL,
        source_photo_id uuid NOT NULL,
        edited_photo_id uuid NOT NULL,
        intensity integer NOT NULL,
        created_by_email text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
      `,
      [],
    );

    await query(
      `
      CREATE INDEX IF NOT EXISTS presets_visibility_status_idx
      ON presets (visibility, status, created_at DESC)
      `,
      [],
    );

    await query(
      `
      CREATE INDEX IF NOT EXISTS presets_owner_email_idx
      ON presets (lower(owner_email), created_at DESC)
      `,
      [],
    );

    await query(
      `
      CREATE INDEX IF NOT EXISTS preset_saves_user_email_idx
      ON preset_saves (lower(user_email), created_at DESC)
      `,
      [],
    );
  })();

  return presetSchemaPromise;
}

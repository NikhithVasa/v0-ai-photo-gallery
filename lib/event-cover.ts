import { query } from "@/lib/db";

let eventCoverSchemaPromise: Promise<void> | null = null;

export function ensureEventCoverSchema() {
  eventCoverSchemaPromise ??= query(
    `
    ALTER TABLE album_events
      ADD COLUMN IF NOT EXISTS cover_photo_s3_key text
    `,
    [],
  ).then(() => undefined);

  return eventCoverSchemaPromise;
}
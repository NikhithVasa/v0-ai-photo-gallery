import { queryOne } from "@/lib/db";
import { signedObjectUrl } from "@/lib/s3";
import type { Preset } from "@/lib/preset-types";

export interface PresetRow {
  id: string;
  owner_email: string;
  name: string;
  description: string | null;
  creator_name: string;
  category: string;
  tags: string[] | null;
  best_for: string[] | null;
  visibility: string;
  status: string;
  lut_s3_key: string;
  lut_size: number;
  preview_before_s3_key: string;
  preview_after_s3_key: string;
  save_count: number | string | null;
  is_saved: boolean | null;
  created_at: Date | string;
}

function numberValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function serializePreset(
  row: PresetRow,
  userEmail: string,
): Promise<Preset> {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    creatorName: row.creator_name,
    category: row.category,
    tags: row.tags ?? [],
    bestFor: row.best_for ?? [],
    visibility: row.visibility === "public" ? "public" : "private",
    status: row.status,
    lutSize: row.lut_size,
    previewBeforeUrl: await signedObjectUrl(row.preview_before_s3_key),
    previewAfterUrl: await signedObjectUrl(row.preview_after_s3_key),
    saveCount: numberValue(row.save_count),
    isSaved: Boolean(row.is_saved),
    isOwner: row.owner_email.toLowerCase() === userEmail.toLowerCase(),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
  };
}

export async function getAccessiblePresetRow(
  presetId: string,
  userEmail: string,
) {
  return queryOne<PresetRow>(
    `
    SELECT
      p.*,
      (SELECT COUNT(*)::int FROM preset_saves ps WHERE ps.preset_id = p.id) AS save_count,
      EXISTS(
        SELECT 1
        FROM preset_saves ps
        WHERE ps.preset_id = p.id
          AND lower(ps.user_email) = lower($2)
      ) AS is_saved
    FROM presets p
    WHERE p.id = $1::uuid
      AND p.status = 'published'
      AND (
        p.visibility = 'public'
        OR lower(p.owner_email) = lower($2)
        OR EXISTS(
          SELECT 1
          FROM preset_saves ps
          WHERE ps.preset_id = p.id
            AND lower(ps.user_email) = lower($2)
        )
      )
    LIMIT 1
    `,
    [presetId, userEmail],
  );
}

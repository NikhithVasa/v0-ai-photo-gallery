import { query, queryOne, withTransaction } from "@/lib/db";
import {
  toCullingCluster,
  toCullingClusterItem,
  type CullingClusterItemRow,
  type CullingClusterRow,
} from "@/lib/culling-data";
import type { CullingCluster, CullingClusterItem } from "@/lib/types";

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

function numericColumn(
  columns: Set<string>,
  tableAlias: string,
  candidates: string[],
) {
  const column = candidates.find((candidate) => columns.has(candidate));
  return column ? `${tableAlias}.${column}` : "NULL::numeric";
}

function textColumn(
  columns: Set<string>,
  tableAlias: string,
  candidates: string[],
) {
  const column = candidates.find((candidate) => columns.has(candidate));
  return column ? `${tableAlias}.${column}` : "NULL::text";
}

async function cullingScoreSql() {
  const columns = await tableColumns("photo_culling_scores");

  return {
    overall: numericColumn(columns, "cs", [
      "overall_score",
      "score",
      "quality_score",
      "culling_score",
      "final_score",
      "album_score",
      "album_worthy_score",
    ]),
    technical: numericColumn(columns, "cs", [
      "technical_score",
      "sharpness_score",
      "clarity_score",
      "frame_clarity",
    ]),
    face: numericColumn(columns, "cs", [
      "face_score",
      "face_quality_score",
      "people_score",
    ]),
    gaze: numericColumn(columns, "cs", [
      "gaze_score",
      "camera_gaze_score",
      "eye_contact_score",
    ]),
    reason: textColumn(columns, "cs", [
      "reason",
      "score_reason",
      "summary",
      "explanation",
    ]),
  };
}

export async function fetchCullingClusters({
  albumSlug,
  eventSlug,
  mode,
  limit,
}: {
  albumSlug: string;
  eventSlug?: string | null;
  mode?: string | null;
  limit?: number;
}): Promise<CullingCluster[]> {
  const scoreSql = await cullingScoreSql();
  const rows = await query<CullingClusterRow>(
    `
    SELECT
      a.slug AS album_slug,
      e.slug AS event_slug,
      c.id AS cluster_id,
      c.cluster_type,
      c.best_photo_id,
      c.cluster_score,
      c.reason AS cluster_reason,
      COUNT(ci.photo_id)::int AS similar_count,
      p.file_name,
      p.original_s3_key,
      p.ai_input_s3_key,
      p.thumbnail_s3_key,
      p.clean_preview_s3_key,
      p.watermarked_preview_s3_key,
      MAX(${scoreSql.overall}) AS overall_score,
      MAX(${scoreSql.technical}) AS technical_score,
      MAX(${scoreSql.face}) AS face_score,
      MAX(${scoreSql.gaze}) AS gaze_score,
      MAX(${scoreSql.reason}) AS score_reason
    FROM photo_similarity_clusters c
    JOIN photo_similarity_cluster_items ci
      ON ci.cluster_id = c.id
    JOIN albums a
      ON a.id = c.album_id
    JOIN album_events e
      ON e.id = c.album_event_id
    LEFT JOIN photos p
      ON p.id = c.best_photo_id
     AND COALESCE(p.is_deleted, false) = false
    LEFT JOIN photo_culling_scores cs
      ON cs.photo_id = c.best_photo_id
    WHERE lower(a.slug) = lower($1)
      AND ($2::text IS NULL OR e.slug = $2)
      AND COALESCE(a.is_deleted, false) = false
      AND c.best_photo_id IS NOT NULL
      AND p.id IS NOT NULL
      AND (
        $3::text IS NULL
        OR $3::text IN ('best', 'duplicates')
        OR ($3::text = 'needs_review' AND (
          ${scoreSql.overall} IS NULL
          OR ${scoreSql.overall} < 70
          OR c.best_photo_id IS NULL
        ))
        OR ($3::text = 'low_score' AND COALESCE(${scoreSql.overall}, c.cluster_score, 0) < 70)
      )
    GROUP BY c.id, a.slug, e.slug, p.id
    ORDER BY
      COALESCE(MAX(${scoreSql.overall}), c.cluster_score, 0) DESC,
      COUNT(ci.photo_id) DESC,
      p.file_name ASC NULLS LAST
    LIMIT $4
    `,
    [albumSlug, eventSlug ?? null, mode ?? null, limit ?? 200],
  );

  return Promise.all(rows.map(toCullingCluster));
}

export async function fetchCullingClusterItems(
  clusterId: string,
): Promise<CullingClusterItem[]> {
  const scoreSql = await cullingScoreSql();
  const rows = await query<CullingClusterItemRow>(
    `
    SELECT
      ci.cluster_id,
      ci.photo_id,
      ci.rank_in_cluster,
      ci.is_best,
      ci.similarity_score,
      ci.quality_score,
      ci.reason AS cluster_item_reason,
      p.file_name,
      p.original_s3_key,
      p.ai_input_s3_key,
      p.thumbnail_s3_key,
      p.clean_preview_s3_key,
      p.watermarked_preview_s3_key,
      ${scoreSql.overall} AS overall_score,
      ${scoreSql.technical} AS technical_score,
      ${scoreSql.face} AS face_score,
      ${scoreSql.gaze} AS gaze_score,
      ${scoreSql.reason} AS score_reason
    FROM photo_similarity_cluster_items ci
    JOIN photos p
      ON p.id = ci.photo_id
    LEFT JOIN photo_culling_scores cs
      ON cs.photo_id = p.id
    WHERE ci.cluster_id = $1::uuid
      AND COALESCE(p.is_deleted, false) = false
    ORDER BY ci.rank_in_cluster ASC NULLS LAST, ci.is_best DESC
    `,
    [clusterId],
  );

  return Promise.all(rows.map(toCullingClusterItem));
}

export async function fetchClusterAccess(clusterId: string) {
  return queryOne<{
    album_slug: string;
    album_id: string;
    cluster_id: string;
  }>(
    `
    SELECT
      a.slug AS album_slug,
      a.id AS album_id,
      c.id AS cluster_id
    FROM photo_similarity_clusters c
    JOIN albums a ON a.id = c.album_id
    WHERE c.id = $1::uuid
      AND COALESCE(a.is_deleted, false) = false
    LIMIT 1
    `,
    [clusterId],
  );
}

export async function setCullingClusterBest({
  clusterId,
  photoId,
}: {
  clusterId: string;
  photoId: string;
}) {
  return withTransaction(async (client) => {
    const {
      rows: [item],
    } = await client.query<{ photo_id: string }>(
      `
      SELECT photo_id
      FROM photo_similarity_cluster_items
      WHERE cluster_id = $1::uuid
        AND photo_id = $2::uuid
      LIMIT 1
      `,
      [clusterId, photoId],
    );

    if (!item) {
      throw new Error("Photo is not in this cluster");
    }

    await client.query(
      `
      UPDATE photo_similarity_clusters
      SET best_photo_id = $2::uuid,
          updated_at = now()
      WHERE id = $1::uuid
      `,
      [clusterId, photoId],
    );

    await client.query(
      `
      UPDATE photo_similarity_cluster_items
      SET is_best = (photo_id = $2::uuid)
      WHERE cluster_id = $1::uuid
      `,
      [clusterId, photoId],
    );

    await client.query(
      `
      WITH ranked AS (
        SELECT
          photo_id,
          row_number() OVER (
            ORDER BY
              CASE WHEN photo_id = $2::uuid THEN 0 ELSE 1 END,
              rank_in_cluster ASC NULLS LAST,
              quality_score DESC NULLS LAST
          ) AS next_rank
        FROM photo_similarity_cluster_items
        WHERE cluster_id = $1::uuid
      )
      UPDATE photo_similarity_cluster_items ci
      SET rank_in_cluster = ranked.next_rank
      FROM ranked
      WHERE ci.cluster_id = $1::uuid
        AND ci.photo_id = ranked.photo_id
      `,
      [clusterId, photoId],
    );

    return { clusterId, photoId };
  });
}

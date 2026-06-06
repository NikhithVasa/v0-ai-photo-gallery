import { query, queryOne, withTransaction } from "@/lib/db";
import {
  toCullingCluster,
  toCullingClusterItem,
  type CullingClusterItemRow,
  type CullingClusterRow,
} from "@/lib/culling-data";
import type { CullingCluster, CullingClusterItem } from "@/lib/types";

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
      p.thumbnail_s3_key,
      p.clean_preview_s3_key,
      p.watermarked_preview_s3_key,
      cs.overall_score,
      cs.technical_score,
      cs.face_score,
      cs.gaze_score,
      cs.reason AS score_reason
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
    WHERE a.slug = $1
      AND ($2::text IS NULL OR e.slug = $2)
      AND COALESCE(a.is_deleted, false) = false
      AND c.best_photo_id IS NOT NULL
      AND p.id IS NOT NULL
      AND (
        $3::text IS NULL
        OR $3::text IN ('best', 'duplicates')
        OR ($3::text = 'needs_review' AND (
          cs.overall_score IS NULL
          OR cs.overall_score < 70
          OR c.best_photo_id IS NULL
        ))
        OR ($3::text = 'low_score' AND COALESCE(cs.overall_score, c.cluster_score, 0) < 70)
      )
    GROUP BY c.id, a.slug, e.slug, p.id, cs.id
    ORDER BY
      COALESCE(cs.overall_score, c.cluster_score, 0) DESC,
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
      p.thumbnail_s3_key,
      p.clean_preview_s3_key,
      p.watermarked_preview_s3_key,
      cs.overall_score,
      cs.technical_score,
      cs.face_score,
      cs.gaze_score,
      cs.reason AS score_reason
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

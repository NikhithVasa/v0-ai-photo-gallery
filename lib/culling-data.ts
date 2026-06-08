import { signedUrl } from "@/lib/s3";
import type {
  CullingCluster,
  CullingClusterItem,
  CullingClusterPhoto,
  CullingScore,
} from "@/lib/types";

export interface CullingClusterRow {
  album_slug: string;
  event_slug: string;
  cluster_id: string;
  cluster_type: string | null;
  best_photo_id: string | null;
  cluster_score: number | string | null;
  cluster_reason: string | null;
  similar_count: number | string | null;
  file_name: string | null;
  original_s3_key: string | null;
  ai_input_s3_key: string | null;
  thumbnail_s3_key: string | null;
  clean_preview_s3_key: string | null;
  watermarked_preview_s3_key: string | null;
  overall_score: number | string | null;
  technical_score: number | string | null;
  face_score: number | string | null;
  gaze_score: number | string | null;
  score_reason: string | null;
}

export interface CullingClusterItemRow {
  cluster_id: string;
  photo_id: string;
  rank_in_cluster: number | string | null;
  is_best: boolean | null;
  similarity_score: number | string | null;
  quality_score: number | string | null;
  cluster_item_reason: string | null;
  file_name: string | null;
  original_s3_key: string | null;
  ai_input_s3_key: string | null;
  thumbnail_s3_key: string | null;
  clean_preview_s3_key: string | null;
  watermarked_preview_s3_key: string | null;
  overall_score: number | string | null;
  technical_score: number | string | null;
  face_score: number | string | null;
  gaze_score: number | string | null;
  score_reason: string | null;
}

function numberValue(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function integerValue(value: number | string | null | undefined) {
  return Math.round(numberValue(value) ?? 0);
}

function scoreFromRow(row: {
  overall_score: number | string | null;
  technical_score: number | string | null;
  face_score: number | string | null;
  gaze_score: number | string | null;
  score_reason: string | null;
}): CullingScore {
  return {
    overallScore: numberValue(row.overall_score),
    technicalScore: numberValue(row.technical_score),
    faceScore: numberValue(row.face_score),
    gazeScore: numberValue(row.gaze_score),
    reason: row.score_reason,
  };
}

async function photoFromRow(row: {
  best_photo_id?: string | null;
  photo_id?: string | null;
  file_name: string | null;
  original_s3_key: string | null;
  ai_input_s3_key: string | null;
  thumbnail_s3_key: string | null;
  clean_preview_s3_key: string | null;
  watermarked_preview_s3_key: string | null;
}): Promise<CullingClusterPhoto> {
  const [thumbnailUrl, previewUrl] = await Promise.all([
    signedUrl(row.ai_input_s3_key),
    signedUrl(row.ai_input_s3_key),
  ]);

  return {
    id: row.photo_id ?? row.best_photo_id ?? "",
    fileName: row.file_name,
    thumbnailUrl,
    previewUrl,
    thumbnailS3Key: row.thumbnail_s3_key,
    cleanPreviewS3Key: row.clean_preview_s3_key,
    watermarkedPreviewS3Key: row.watermarked_preview_s3_key,
  };
}

export async function toCullingCluster(
  row: CullingClusterRow,
): Promise<CullingCluster> {
  const scoreDetails = scoreFromRow(row);
  const score = scoreDetails.overallScore ?? numberValue(row.cluster_score);

  return {
    clusterId: row.cluster_id,
    albumSlug: row.album_slug,
    eventSlug: row.event_slug,
    clusterType: row.cluster_type,
    bestPhotoId: row.best_photo_id,
    similarCount: integerValue(row.similar_count),
    score,
    reason: row.score_reason || row.cluster_reason,
    scoreReason: row.score_reason,
    scoreDetails,
    photo: row.best_photo_id ? await photoFromRow(row) : null,
  };
}

export async function toCullingClusterItem(
  row: CullingClusterItemRow,
): Promise<CullingClusterItem> {
  return {
    clusterId: row.cluster_id,
    photoId: row.photo_id,
    rankInCluster: integerValue(row.rank_in_cluster),
    isBest: Boolean(row.is_best),
    similarityScore: numberValue(row.similarity_score),
    qualityScore: numberValue(row.quality_score),
    reason: row.score_reason || row.cluster_item_reason,
    scoreReason: row.score_reason,
    scoreDetails: scoreFromRow(row),
    photo: await photoFromRow(row),
  };
}

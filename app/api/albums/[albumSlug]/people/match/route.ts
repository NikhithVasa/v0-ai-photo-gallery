import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireAlbumAccess } from "@/lib/album-access";
import { query, queryOne } from "@/lib/db";
import { getShareLinkAccess } from "@/lib/share-access";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const EMBEDDING_MAX_SIDE = Number.parseInt(
  process.env.PHOTO_IMAGE_EMBED_MAX_SIDE || "768",
  10
);
const EMBEDDING_JPEG_QUALITY = Number.parseInt(
  process.env.PHOTO_IMAGE_EMBED_JPEG_QUALITY || "82",
  10
);

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface EmbeddingProfileRow {
  model: string;
  dimensions: number | string;
  photos: number | string;
}

interface OpenRouterEmbeddingResponse {
  data?: Array<{
    embedding?: unknown;
    index?: number;
  }>;
  usage?: unknown;
  error?: {
    message?: string;
  };
}

interface MatchedPersonRow {
  person_id: string;
  person_number: number;
  default_name: string;
  display_name: string | null;
}

interface NearestPhotoRow {
  id: string;
  file_name: string | null;
  event_slug: string;
  similarity: number | string;
  vector_distance: number | string;
}

function vectorNorm(values: number[]) {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

function normalizeEmbedding(values: number[]) {
  const norm = vectorNorm(values);
  if (!Number.isFinite(norm) || norm === 0) {
    throw new Error("OpenRouter returned an invalid zero-length embedding");
  }
  return values.map((value) => value / norm);
}

function embeddingToPgVector(values: number[]) {
  return `[${values.map((value) => Number(value).toString()).join(",")}]`;
}

function openRouterReferer(request: Request) {
  const configured =
    process.env.OPENROUTER_HTTP_REFERER ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured;

  const host = request.headers.get("host");
  if (!host) return "https://www.saathidesk.com";
  return `${host.includes("localhost") ? "http" : "https"}://${host}`;
}

async function prepareEmbeddingImage(image: File) {
  if (!image.type.startsWith("image/")) {
    throw new Error("Choose a supported image file");
  }
  if (image.size <= 0 || image.size > MAX_UPLOAD_BYTES) {
    throw new Error("Choose an image smaller than 10 MB");
  }

  const input = Buffer.from(await image.arrayBuffer());
  const output = await sharp(input, { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({
      width: EMBEDDING_MAX_SIDE,
      height: EMBEDDING_MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: EMBEDDING_JPEG_QUALITY,
    })
    .toBuffer({ resolveWithObject: true });

  return {
    dataUrl: `data:image/jpeg;base64,${output.data.toString("base64")}`,
    inputBytes: input.length,
    outputBytes: output.data.length,
    width: output.info.width,
    height: output.info.height,
  };
}

async function requestOpenRouterImageEmbedding({
  request,
  model,
  dimensions,
  dataUrl,
}: {
  request: Request;
  model: string;
  dimensions: number;
  dataUrl: string;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const startedAt = Date.now();
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": openRouterReferer(request),
      "X-Title":
        process.env.OPENROUTER_APP_TITLE || "Saathidesk Find Yourself",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          content: [
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      dimensions,
      encoding_format: "float",
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as
    OpenRouterEmbeddingResponse;

  console.info(
    JSON.stringify({
      level: response.ok ? "info" : "error",
      event: "find_yourself_openrouter_response",
      model,
      dimensions,
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
      responseRows: payload.data?.length ?? 0,
      usage: payload.usage ?? null,
      error: payload.error?.message ?? null,
    })
  );

  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        `OpenRouter image embedding failed (${response.status})`
    );
  }

  const embedding = payload.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("OpenRouter response did not include an image embedding");
  }

  const numericEmbedding = embedding.map((value) => Number(value));
  if (
    numericEmbedding.length !== dimensions ||
    numericEmbedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      `OpenRouter embedding shape mismatch: expected ${dimensions}, received ${numericEmbedding.length}`
    );
  }

  const normalizedEmbedding = normalizeEmbedding(numericEmbedding);
  return {
    pgVector: embeddingToPgVector(normalizedEmbedding),
    normBefore: vectorNorm(numericEmbedding),
    normAfter: vectorNorm(normalizedEmbedding),
    preview: normalizedEmbedding.slice(0, 8),
  };
}

export async function POST(request: Request, { params }: Props) {
  const startedAt = Date.now();

  try {
    const { albumSlug } = await params;
    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get("event")?.trim() || null;

    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) return accessDenied;

    const shareAccess = await getShareLinkAccess(request, albumSlug);
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "Upload an image using the image field" },
        { status: 400 }
      );
    }

    console.info(
      JSON.stringify({
        level: "info",
        event: "find_yourself_start",
        albumSlug,
        eventSlug,
        fileName: image.name,
        contentType: image.type,
        uploadBytes: image.size,
      })
    );

    const profile = await queryOne<EmbeddingProfileRow>(
      `
      SELECT
        p.image_embedding_model AS model,
        vector_dims(p.image_embedding) AS dimensions,
        COUNT(*)::int AS photos
      FROM photos p
      JOIN albums a ON a.id = p.album_id
      JOIN album_events e ON e.id = p.album_event_id
      WHERE lower(a.slug) = lower($1)
        AND ($2::text IS NULL OR e.slug = $2)
        AND COALESCE(a.is_deleted, false) = false
        AND COALESCE(e.is_deleted, false) = false
        AND COALESCE(p.is_deleted, false) = false
        AND p.upload_status = 'completed'
        AND p.image_embedding IS NOT NULL
        AND p.image_embedding_model IS NOT NULL
      GROUP BY p.image_embedding_model, vector_dims(p.image_embedding)
      ORDER BY COUNT(*) DESC
      LIMIT 1
      `,
      [albumSlug, eventSlug]
    );

    if (!profile) {
      return NextResponse.json(
        { error: "This album does not have full-photo embeddings yet" },
        { status: 409 }
      );
    }

    const dimensions = Number(profile.dimensions);
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      throw new Error("Stored photo embedding dimensions are invalid");
    }

    const configuredModel = process.env.OPENROUTER_EMBEDDING_MODEL?.trim();
    if (configuredModel && configuredModel !== profile.model) {
      return NextResponse.json(
        {
          error:
            "The configured OpenRouter model does not match this album's stored photo embeddings",
          configuredModel,
          storedModel: profile.model,
        },
        { status: 409 }
      );
    }

    const preparedImage = await prepareEmbeddingImage(image);
    const embedding = await requestOpenRouterImageEmbedding({
      request,
      model: profile.model,
      dimensions,
      dataUrl: preparedImage.dataUrl,
    });

    const nearestPhoto = await queryOne<NearestPhotoRow>(
      `
      SELECT
        p.id,
        p.file_name,
        e.slug AS event_slug,
        1 - (p.image_embedding <=> $3::vector) AS similarity,
        p.image_embedding <=> $3::vector AS vector_distance
      FROM photos p
      JOIN albums a ON a.id = p.album_id
      JOIN album_events e ON e.id = p.album_event_id
      WHERE lower(a.slug) = lower($1)
        AND ($2::text IS NULL OR e.slug = $2)
        AND (
          $5::uuid[] IS NULL
          OR EXISTS (
            SELECT 1
            FROM photo_people scoped_pp
            WHERE scoped_pp.photo_id = p.id
              AND scoped_pp.person_id = ANY($5::uuid[])
          )
        )
        AND (
          $5::uuid[] IS NULL
          OR $6::boolean = false
          OR (
            SELECT COUNT(DISTINCT scoped_pp.person_id)
            FROM photo_people scoped_pp
            WHERE scoped_pp.photo_id = p.id
              AND scoped_pp.person_id = ANY($5::uuid[])
          ) = (
            SELECT COUNT(DISTINCT scoped_pp.person_id)
            FROM photo_people scoped_pp
            JOIN people scoped_pe
              ON scoped_pe.id = scoped_pp.person_id
             AND COALESCE(scoped_pe.is_hidden, false) = false
            WHERE scoped_pp.photo_id = p.id
          )
        )
        AND COALESCE(a.is_deleted, false) = false
        AND COALESCE(e.is_deleted, false) = false
        AND COALESCE(p.is_deleted, false) = false
        AND p.upload_status = 'completed'
        AND p.image_embedding IS NOT NULL
        AND p.image_embedding_model = $4
      ORDER BY p.image_embedding <=> $3::vector, p.created_at ASC
      LIMIT 1
      `,
      [
        albumSlug,
        eventSlug,
        embedding.pgVector,
        profile.model,
        shareAccess?.personIds.length ? shareAccess.personIds : null,
        Boolean(shareAccess?.personIds.length && shareAccess.onlyPerson),
      ]
    );

    const rows = nearestPhoto
      ? await query<MatchedPersonRow>(
          `
      SELECT
        pe.id AS person_id,
        pe.person_number,
        pe.default_name,
        pe.display_name
      FROM photo_people pp
      JOIN people pe ON pe.id = pp.person_id
      WHERE pp.photo_id = $1
        AND COALESCE(pe.is_hidden, false) = false
        AND ($2::uuid[] IS NULL OR pe.id = ANY($2::uuid[]))
      ORDER BY pe.person_number ASC
      `,
          [
            nearestPhoto.id,
            shareAccess?.personIds.length ? shareAccess.personIds : null,
          ]
        )
      : [];

    const similarity = nearestPhoto ? Number(nearestPhoto.similarity) : null;
    const vectorDistance = nearestPhoto
      ? Number(nearestPhoto.vector_distance)
      : null;

    console.info(
      JSON.stringify({
        level: "info",
        event: "find_yourself_result",
        albumSlug,
        eventSlug,
        model: profile.model,
        dimensions,
        embeddedPhotos: Number(profile.photos),
        preparedImage: {
          inputBytes: preparedImage.inputBytes,
          outputBytes: preparedImage.outputBytes,
          width: preparedImage.width,
          height: preparedImage.height,
        },
        embedding: {
          normBefore: embedding.normBefore,
          normAfter: embedding.normAfter,
          preview: embedding.preview,
        },
        matchedPhotoId: nearestPhoto?.id ?? null,
        matchedFileName: nearestPhoto?.file_name ?? null,
        similarity,
        vectorDistance,
        matchedPeople: rows.map((row) => ({
          personId: row.person_id,
          name: row.display_name || row.default_name,
        })),
        totalDurationMs: Date.now() - startedAt,
      })
    );

    return NextResponse.json({
      model: profile.model,
      dimensions,
      matchedPhoto: nearestPhoto
        ? {
            id: nearestPhoto.id,
            fileName: nearestPhoto.file_name,
            eventSlug: nearestPhoto.event_slug,
            similarity,
            vectorDistance,
          }
        : null,
      matches: rows.map((row) => ({
        personId: row.person_id,
        personNumber: row.person_number,
        name: row.display_name || row.default_name,
        similarity,
      })),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "find_yourself_failed",
        error: error instanceof Error ? error.message : String(error),
        totalDurationMs: Date.now() - startedAt,
      })
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not find matching people",
      },
      { status: 500 }
    );
  }
}

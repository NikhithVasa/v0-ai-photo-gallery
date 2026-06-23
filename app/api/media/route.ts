import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { listS3Keys, s3 } from "@/lib/s3";
import { queryOne } from "@/lib/db";
import { requireAlbumAccess } from "@/lib/album-access";
import {
  requireAdminAccess,
  requireCustomerAccessBySlug,
} from "@/lib/auth-access";
import { ensurePhotoEditSchema } from "@/lib/customer-schema";
import { getShareLinkAccess } from "@/lib/share-access";

function isAllowedMediaKey(value: string) {
  if (!value || value.includes("..") || value.startsWith("/") || value.endsWith("/")) {
    return false;
  }

  const allowedPrefixes = [
    "albums/",
    "customers/",
    process.env.ORIGINAL_PREFIX,
    process.env.AI_INPUT_PREFIX,
    process.env.PREVIEW_PREFIX,
    process.env.THUMB_PREFIX,
    process.env.FACES_PREFIX,
    process.env.ANNOTATED_PREFIX,
  ]
    .filter((prefix): prefix is string => Boolean(prefix?.trim()))
    .map((prefix) => (prefix.endsWith("/") ? prefix : `${prefix}/`));

  return allowedPrefixes.some((prefix) => value.startsWith(prefix));
}

function toWebStream(body: unknown): ReadableStream<Uint8Array> | null {
  if (!body || typeof body !== "object") return null;
  if ("transformToWebStream" in body) {
    return (body as { transformToWebStream: () => ReadableStream<Uint8Array> })
      .transformToWebStream();
  }
  return null;
}

async function getMediaObject(key: string) {
  return s3.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    })
  );
}

async function fallbackOriginalKey(key: string) {
  const match = key.match(
    /^(.*?)\/(?:thumbnails|previews-clean|previews-watermarked|ai-input|annotated)\/([0-9a-f-]+)\.(?:webp|jpe?g|png)$/i
  );

  if (!match) return null;

  const [, basePrefix, photoUuid] = match;
  const originalPrefix = `${basePrefix}/originals/${photoUuid}_`;
  const keys = await listS3Keys(originalPrefix);
  return keys[0] ?? null;
}

async function requireMediaAccess(request: Request, key: string) {
  await ensurePhotoEditSchema();

  const album = await queryOne<{ slug: string }>(
    `
    WITH album_matches AS (
      SELECT a.slug
      FROM albums a
      WHERE a.cover_photo_s3_key = $1
        AND COALESCE(a.is_deleted, false) = false

      UNION

      SELECT a.slug
      FROM photos p
      JOIN albums a
        ON a.id = p.album_id
       AND COALESCE(a.is_deleted, false) = false
      WHERE COALESCE(p.is_deleted, false) = false
        AND $1 = ANY(ARRAY[
          p.original_s3_key,
          p.ai_input_s3_key,
          p.clean_preview_s3_key,
          p.watermarked_preview_s3_key,
          p.thumbnail_s3_key,
          p.annotated_s3_key
        ]::text[])

      UNION

      SELECT a.slug
      FROM people pe
      JOIN albums a
        ON a.id = pe.album_id
       AND COALESCE(a.is_deleted, false) = false
      WHERE pe.cover_face_s3_key = $1

      UNION

      SELECT a.slug
      FROM photo_edits pe
      JOIN albums a
        ON a.id = pe.album_id
       AND COALESCE(a.is_deleted, false) = false
      WHERE $1 = ANY(ARRAY[pe.source_s3_key, pe.edited_s3_key, pe.thumb_s3_key]::text[])
    )
    SELECT slug
    FROM album_matches
    LIMIT 1
    `,
    [key],
  );

  if (album) {
    const accessDenied = await requireAlbumAccess(request, album.slug);
    if (accessDenied) return accessDenied;

    const shareAccess = await getShareLinkAccess(request, album.slug);
    if (!shareAccess?.personIds.length) return null;

    const scopedMedia = await queryOne<{ allowed: boolean }>(
      `
      SELECT true AS allowed
      FROM albums a
      WHERE lower(a.slug) = lower($1)
        AND a.cover_photo_s3_key = $2

      UNION ALL

      SELECT true AS allowed
      FROM people pe
      JOIN albums a ON a.id = pe.album_id
      WHERE lower(a.slug) = lower($1)
        AND pe.id = ANY($3::uuid[])
        AND pe.cover_face_s3_key = $2

      UNION ALL

      SELECT true AS allowed
      FROM photos p
      JOIN albums a ON a.id = p.album_id
      WHERE lower(a.slug) = lower($1)
        AND $2 = ANY(ARRAY[
          p.original_s3_key,
          p.ai_input_s3_key,
          p.clean_preview_s3_key,
          p.watermarked_preview_s3_key,
          p.thumbnail_s3_key,
          p.annotated_s3_key
        ]::text[])
        AND EXISTS (
          SELECT 1
          FROM photo_people scoped_pp
          WHERE scoped_pp.photo_id = p.id
            AND scoped_pp.person_id = ANY($3::uuid[])
        )
        AND (
          $3::uuid[] IS NULL
          OR (
            (
              SELECT COUNT(DISTINCT scoped_pp.person_id)
              FROM photo_people scoped_pp
              WHERE scoped_pp.photo_id = p.id
                AND scoped_pp.person_id = ANY($3::uuid[])
            ) = (
              SELECT COUNT(DISTINCT scoped_pp.person_id)
              FROM photo_people scoped_pp
              JOIN people scoped_pe
                ON scoped_pe.id = scoped_pp.person_id
               AND COALESCE(scoped_pe.is_hidden, false) = false
              WHERE scoped_pp.photo_id = p.id
            )
            AND (
              $4::boolean = false
              OR (
                SELECT COUNT(DISTINCT scoped_pp.person_id)
                FROM photo_people scoped_pp
                WHERE scoped_pp.photo_id = p.id
                  AND scoped_pp.person_id = ANY($3::uuid[])
              ) = cardinality($3::uuid[])
            )
          )
        )
      LIMIT 1
      `,
      [album.slug, key, shareAccess.personIds, shareAccess.onlyPerson],
    );

    return scopedMedia
      ? null
      : NextResponse.json({ error: "Media not available" }, { status: 403 });
  }

  const fallbackKey = await fallbackOriginalKey(key).catch(() => null);
  if (fallbackKey && fallbackKey !== key) {
    return requireMediaAccess(request, fallbackKey);
  }

  const customer = await queryOne<{ slug: string }>(
    `
    SELECT slug
    FROM customers
    WHERE cover_photo_s3_key = $1
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
    `,
    [key],
  );

  if (customer) return requireCustomerAccessBySlug(request, customer.slug);

  const admin = await requireAdminAccess();
  return admin.response;
}

function mediaResponse(object: Awaited<ReturnType<typeof getMediaObject>>) {
  const stream = toWebStream(object.Body);

  if (!stream) {
    return NextResponse.json(
      { error: "Media body unavailable" },
      { status: 404 }
    );
  }

  return new Response(stream, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Type": object.ContentType ?? "application/octet-stream",
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? "";

  if (!isAllowedMediaKey(key)) {
    return NextResponse.json({ error: "Invalid media key" }, { status: 400 });
  }

  const accessDenied = await requireMediaAccess(request, key);
  if (accessDenied) return accessDenied;

  try {
    return mediaResponse(await getMediaObject(key));
  } catch (error) {
    const fallbackKey = await fallbackOriginalKey(key).catch(() => null);

    if (fallbackKey) {
      try {
        return mediaResponse(await getMediaObject(fallbackKey));
      } catch (fallbackError) {
        console.error("Error proxying fallback media:", fallbackError);
      }
    }

    console.error("Error proxying media:", error);
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
}

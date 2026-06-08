import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { signedPhotoUrlBundle, type PhotoRow } from "@/lib/gallery-data";
import { requireAlbumAccess } from "@/lib/album-access";
import { getShareLinkAccess } from "@/lib/share-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function shortToken(value: string | null) {
  if (!value) return "";
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const url = new URL(request.url);
    const shareToken = url.searchParams.get("share");
    console.log("[share-debug] signed photo urls API start", {
      albumSlug,
      hasShareToken: Boolean(shareToken),
      shareToken: shortToken(shareToken),
    });

    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) {
      console.log("[share-debug] signed photo urls API access denied", {
        albumSlug,
        status: accessDenied.status,
        hasShareToken: Boolean(shareToken),
      });
      return accessDenied;
    }

    const body = (await request.json()) as {
      photoIds?: unknown;
      ids?: unknown;
    };
    const rawIds = Array.isArray(body.photoIds)
      ? body.photoIds
      : Array.isArray(body.ids)
        ? body.ids
        : [];
    const photoIds = rawIds
      .filter((id): id is string => typeof id === "string" && isUuid(id))
      .slice(0, 60);

    if (!photoIds.length) {
      console.log("[share-debug] signed photo urls API empty ids", {
        albumSlug,
        rawIdCount: rawIds.length,
      });
      return NextResponse.json({ urls: {}, photos: [] });
    }

    console.log("[share-debug] signed photo urls API querying photos", {
      albumSlug,
      requested: rawIds.length,
      valid: photoIds.length,
    });

    const rows = await query<PhotoRow>(
      `
      SELECT
        p.id,
        p.album_id,
        a.slug AS album_slug,
        p.album_event_id,
        p.file_name,
        p.caption,
        p.search_text,
        p.width,
        p.height,
        p.original_s3_key,
        p.ai_input_s3_key,
        p.clean_preview_s3_key,
        p.watermarked_preview_s3_key,
        p.thumbnail_s3_key,
        p.annotated_s3_key,
        p.compression_status,
        p.watermark_status,
        e.slug AS event_slug,
        e.name AS event_name
      FROM photos p
      JOIN albums a ON a.id = p.album_id
      JOIN album_events e ON e.id = p.album_event_id
      WHERE lower(a.slug) = lower($1)
        AND p.id = ANY($2::uuid[])
        AND COALESCE(p.is_deleted, false) = false
        AND p.upload_status = 'completed'
      `,
      [albumSlug, photoIds]
    );

    const shareAccess = await getShareLinkAccess(request, albumSlug);
    const allowOriginalAccess = shareAccess ? shareAccess.allowDownloads : true;

    const photos = await Promise.all(
      rows.map(async (row) => {
        const bundle = await signedPhotoUrlBundle(row);
        if (!allowOriginalAccess) {
          return {
            ...bundle,
            downloadUrl: null,
          };
        }
        return bundle;
      }),
    );
    console.log("[share-debug] signed photo urls API rows loaded", {
      albumSlug,
      requested: photoIds.length,
      rows: rows.length,
      signed: photos.length,
      shareRestricted: Boolean(shareAccess && !shareAccess.allowDownloads),
    });

    const urls = Object.fromEntries(
      photos.map((photo) => [
        photo.id,
        {
          previewUrl: photo.previewUrl,
          downloadUrl: photo.downloadUrl,
          thumbnailUrl: photo.thumbnailUrl,
          originalUrl: photo.originalUrl,
        },
      ]),
    );

    return NextResponse.json({ urls, photos });
  } catch (error) {
    console.error("[share-debug] signed photo urls API failed", error);
    return NextResponse.json(
      { error: "Failed to sign photo URLs" },
      { status: 500 }
    );
  }
}

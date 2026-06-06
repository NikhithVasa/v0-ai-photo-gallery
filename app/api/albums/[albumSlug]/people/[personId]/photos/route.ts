import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { toPhoto, type PhotoRow } from "@/lib/gallery-data";
import { requireAlbumAccess } from "@/lib/album-access";
import type { Photo } from "@/lib/types";

interface Props {
  params: Promise<{ albumSlug: string; personId: string }>;
}

function shortToken(value: string | null) {
  if (!value) return "";
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug, personId } = await params;
    const { searchParams } = new URL(request.url);
    const shareToken = searchParams.get("share");
    const eventSlug = searchParams.get("event") || null;
    console.log("[share-debug] person photos API start", {
      albumSlug,
      personId,
      eventSlug,
      hasShareToken: Boolean(shareToken),
      shareToken: shortToken(shareToken),
    });

    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) {
      console.log("[share-debug] person photos API access denied", {
        albumSlug,
        personId,
        eventSlug,
        status: accessDenied.status,
        hasShareToken: Boolean(shareToken),
      });
      return accessDenied;
    }

    console.log("[share-debug] person photos API querying", {
      albumSlug,
      personId,
      eventSlug,
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
        p.clean_preview_s3_key,
        p.watermarked_preview_s3_key,
        p.thumbnail_s3_key,
        p.annotated_s3_key,
        p.compression_status,
        p.watermark_status,
        e.slug AS event_slug,
        e.name AS event_name,
        pp.qwen_description,
        pp.search_text AS person_search_text,
        COALESCE(photo_people_summary.people, '[]'::jsonb) AS people
      FROM photo_people pp
      JOIN photos p ON p.id = pp.photo_id
      JOIN albums a ON a.id = p.album_id
      JOIN album_events e ON e.id = p.album_event_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pe.id,
            'person_number', pe.person_number,
            'default_name', pe.default_name,
            'display_name', pe.display_name,
            'photo_count', pe.photo_count,
            'cover_face_s3_key', pe.cover_face_s3_key
          )
          ORDER BY pe.person_number ASC NULLS LAST, pe.default_name ASC
        ) AS people
        FROM photo_people selected_pp
        JOIN people pe ON pe.id = selected_pp.person_id
        WHERE selected_pp.photo_id = p.id
          AND COALESCE(pe.is_hidden, false) = false
      ) photo_people_summary ON true
      WHERE lower(a.slug) = lower($1)
        AND pp.person_id = $2
        AND ($3::text IS NULL OR e.slug = $3)
        AND COALESCE(p.is_deleted, false) = false
        AND p.upload_status = 'completed'
      ORDER BY p.created_at ASC
      `,
      [albumSlug, personId, eventSlug]
    );

    const photos: Photo[] = await Promise.all(rows.map(toPhoto));
    console.log("[share-debug] person photos API rows loaded", {
      albumSlug,
      personId,
      eventSlug,
      rows: rows.length,
      photos: photos.length,
    });

    return NextResponse.json({ photos });
  } catch (error) {
    console.error("[share-debug] person photos API failed", error);
    return NextResponse.json(
      { error: "Failed to fetch person photos" },
      { status: 500 }
    );
  }
}

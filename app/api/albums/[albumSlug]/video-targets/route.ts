import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { signedUploadUrl } from "@/lib/s3";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface TargetUploadBody {
  eventSlug?: string;
  fileName?: string;
  size?: number;
  contentType?: string;
}

interface AlbumRow {
  id: string;
  slug: string;
}

interface EventRow {
  id: string;
  slug: string;
  source_prefix: string | null;
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || randomUUID()
  );
}

function safeStem(fileName: string) {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  return slugify(withoutExt);
}

function imageExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.(jpe?g|png|webp|heic|heif|avif)$/);
  return match ? `.${match[1]}` : ".jpg";
}

function imageContentType(fileName: string, contentType?: string) {
  if (contentType?.startsWith("image/")) return contentType;
  const ext = imageExtension(fileName);
  return (
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".heic": "image/heic",
      ".heif": "image/heif",
      ".avif": "image/avif",
    }[ext] ?? "image/jpeg"
  );
}

function cleanSourcePrefix(value?: string | null) {
  return value
    ?.trim()
    .replace(/^s3:\/\/[^/]+\//, "")
    .replace(/^https?:\/\/[^/]+\//, "")
    .replace(/^\/+|\/+$/g, "");
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json()) as TargetUploadBody;
    const fileName = body.fileName?.trim();
    const eventSlug = body.eventSlug?.trim();

    if (!fileName || !body.size || body.size <= 0) {
      return NextResponse.json({ error: "fileName and size are required" }, { status: 400 });
    }

    const album = await queryOne<AlbumRow>(
      `
      SELECT id, slug
      FROM albums
      WHERE lower(slug) = lower($1)
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      `,
      [albumSlug],
    );
    if (!album) return NextResponse.json({ error: "Album not found" }, { status: 404 });

    const event = eventSlug
      ? await queryOne<EventRow>(
          `
          SELECT id, slug, source_prefix
          FROM album_events
          WHERE album_id = $1::uuid
            AND slug = $2
            AND COALESCE(is_deleted, false) = false
          LIMIT 1
          `,
          [album.id, eventSlug],
        )
      : null;

    const base = event
      ? cleanSourcePrefix(event.source_prefix) || `albums/${album.slug}/events/${event.slug}`
      : `albums/${album.slug}`;
    const contentType = imageContentType(fileName, body.contentType);
    const s3Key = `${base}/video-targets/${randomUUID()}_${safeStem(fileName)}${imageExtension(fileName)}`;

    return NextResponse.json({
      s3Key,
      contentType,
      uploadUrl: await signedUploadUrl(s3Key, contentType),
    });
  } catch (error) {
    console.error("Failed to prepare video target upload", error);
    return NextResponse.json({ error: "Failed to prepare target upload" }, { status: 500 });
  }
}

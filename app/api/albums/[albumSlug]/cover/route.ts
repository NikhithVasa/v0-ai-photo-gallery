import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { ensureEventCoverSchema } from "@/lib/event-cover";
import { signedUploadUrl } from "@/lib/s3";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface CoverRequestBody {
  eventSlug?: unknown;
  fileName?: unknown;
  size?: unknown;
  contentType?: unknown;
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

function extensionFromFileName(fileName: string) {
  const match = fileName
    .toLowerCase()
    .match(/\.(jpe?g|png|webp|gif|avif|heic|heif)$/);
  return match ? `.${match[1]}` : ".jpg";
}

function contentTypeFromInput(contentType: unknown, fileName: string) {
  if (typeof contentType === "string" && contentType.startsWith("image/")) {
    return contentType;
  }

  const ext = extensionFromFileName(fileName);
  return (
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".avif": "image/avif",
      ".heic": "image/heic",
      ".heif": "image/heif",
    }[ext] ?? "application/octet-stream"
  );
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json()) as CoverRequestBody;
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const eventSlug =
      typeof body.eventSlug === "string" && body.eventSlug.trim()
        ? slugify(body.eventSlug)
        : "";

    if (!fileName) {
      return NextResponse.json({ error: "fileName is required" }, { status: 400 });
    }

    if (typeof body.size !== "number" || body.size <= 0) {
      return NextResponse.json({ error: "size is required" }, { status: 400 });
    }

    const album = await queryOne<{ id: string; slug: string }>(
      `
      SELECT id, slug
      FROM albums
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      `,
      [albumSlug],
    );

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    await ensureEventCoverSchema();

    const contentType = contentTypeFromInput(body.contentType, fileName);
    const key = `albums/${album.slug}/events/${eventSlug || "cover"}/cover/${randomUUID()}${extensionFromFileName(
      fileName,
    )}`;

    const updated = eventSlug
      ? await queryOne<{ id: string }>(
          `
          UPDATE album_events e
          SET cover_photo_s3_key = $3,
              updated_at = now()
          FROM albums a
          WHERE e.album_id = a.id
            AND a.id = $1::uuid
            AND e.slug = $2
            AND COALESCE(e.is_deleted, false) = false
          RETURNING e.id
          `,
          [album.id, eventSlug, key],
        )
      : await queryOne<{ id: string }>(
          `
          UPDATE albums
          SET cover_photo_s3_key = $2,
              updated_at = now()
          WHERE id = $1::uuid
          RETURNING id
          `,
          [album.id, key],
        );

    if (!updated) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({
      upload: {
        key,
        contentType,
        uploadUrl: await signedUploadUrl(key, contentType),
      },
    });
  } catch (error) {
    console.error("Error preparing cover upload:", error);
    return NextResponse.json(
      { error: "Failed to prepare cover upload" },
      { status: 500 },
    );
  }
}

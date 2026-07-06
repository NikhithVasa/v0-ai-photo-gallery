import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { queryOne, withTransaction } from "@/lib/db";
import { customerPublicUrl } from "@/lib/customer-host";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface AlbumRow {
  id: string;
  slug: string;
  name: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_slug: string | null;
}

interface ShareRow {
  token: string;
}

interface SelectionEventRow {
  id: string;
  slug: string;
  name: string;
  copied_count: number | string | null;
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

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function uniqueUuidList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter(isUuid))).slice(0, 500);
}

function cleanName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

async function newEventSlug(albumId: string, name: string) {
  const baseSlug = slugify(name);
  const existing = await queryOne<{ id: string }>(
    `
    SELECT id
    FROM album_events
    WHERE album_id = $1::uuid
      AND (slug = $2 OR lower(name) = lower($3))
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
    `,
    [albumId, baseSlug, name],
  );

  if (existing) {
    throw new Error("An event with this name already exists");
  }

  return baseSlug;
}

function albumShareUrl(request: Request, albumSlug: string, token: string, customerSlug: string | null) {
  const baseUrl = customerSlug
    ? `${customerPublicUrl(customerSlug)}/albums/${encodeURIComponent(albumSlug)}`
    : `${new URL(request.url).origin}/albums/${encodeURIComponent(albumSlug)}`;
  return `${baseUrl}?share=${encodeURIComponent(token)}`;
}

function selectionShareUrl(request: Request, album: AlbumRow, eventSlug: string, token: string) {
  const url = new URL(albumShareUrl(request, album.slug, token, album.customer_slug));
  url.searchParams.set("event", eventSlug);
  return url.toString();
}

async function fetchAlbum(albumSlug: string) {
  return queryOne<AlbumRow>(
    `
    SELECT
      a.id,
      a.slug,
      a.name,
      a.customer_id,
      c.name AS customer_name,
      c.slug AS customer_slug
    FROM albums a
    LEFT JOIN customers c
      ON c.id = a.customer_id
     AND COALESCE(c.is_deleted, false) = false
    WHERE lower(a.slug) = lower($1)
      AND COALESCE(a.is_deleted, false) = false
    LIMIT 1
    `,
    [albumSlug],
  );
}

async function getOrCreateShareToken(album: AlbumRow) {
  await ensureAlbumShareLinkSchema();

  const existing = await queryOne<ShareRow>(
    `
    SELECT token
    FROM album_share_links
    WHERE album_id = $1::uuid
      AND person_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [album.id],
  );

  if (existing?.token) return existing.token;

  const token = randomUUID().replace(/-/g, "");
  const inserted = await queryOne<ShareRow>(
    `
    INSERT INTO album_share_links (
      id,
      token,
      album_id,
      customer_id,
      album_name,
      customer_name,
      allow_downloads,
      hide_ai,
      watermark_enabled,
      watermark_text,
      watermark_mode,
      watermark_positions,
      expires_at,
      background_color,
      passcode,
      created_at,
      updated_at
    )
    VALUES (
      $1::uuid,
      $2,
      $3::uuid,
      $4::uuid,
      $5,
      $6,
      true,
      false,
      false,
      $7,
      'corners',
      ARRAY['bottom_right']::text[],
      NULL,
      '#f5f5f7',
      NULL,
      now(),
      now()
    )
    RETURNING token
    `,
    [
      randomUUID(),
      token,
      album.id,
      album.customer_id,
      album.name,
      album.customer_name,
      album.customer_name || album.name,
    ],
  );

  if (!inserted?.token) throw new Error("Could not create share link");
  return inserted.token;
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json()) as {
      name?: unknown;
      photoIds?: unknown;
    };
    const name = cleanName(body.name);
    const photoIds = uniqueUuidList(body.photoIds);

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!photoIds.length) {
      return NextResponse.json(
        { error: "Select at least one photo" },
        { status: 400 },
      );
    }

    const album = await fetchAlbum(albumSlug);
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const eventSlug = await newEventSlug(album.id, name);
    const photoUuids = photoIds.map(() => randomUUID());
    const token = await getOrCreateShareToken(album);

    const event = await withTransaction(async (client) => {
      const insertedEvent = await client.query<{ id: string; slug: string; name: string }>(
        `
        INSERT INTO album_events(album_id, customer_id, name, slug, sort_order, created_at, updated_at)
        VALUES(
          $1::uuid,
          $2::uuid,
          $3,
          $4,
          COALESCE((SELECT MAX(sort_order) + 1 FROM album_events WHERE album_id = $1::uuid), 1),
          now(),
          now()
        )
        RETURNING id, slug, name
        `,
        [album.id, album.customer_id, name, eventSlug],
      );
      const targetEvent = insertedEvent.rows[0];
      if (!targetEvent) throw new Error("Could not create selection album");

      const copied = await client.query<{ source_photo_id: string; copied_photo_id: string }>(
        `
        WITH selected AS (
          SELECT input.source_photo_id, input.photo_uuid, input.position
          FROM unnest($2::uuid[], $3::uuid[]) WITH ORDINALITY AS input(source_photo_id, photo_uuid, position)
        ),
        copied AS (
          INSERT INTO photos(
            album_id,
            album_event_id,
            photo_uuid,
            source_s3_key,
            storage_album_slug,
            storage_event_slug,
            file_name,
            file_size_bytes,
            width,
            height,
            original_s3_key,
            ai_input_s3_key,
            clean_preview_s3_key,
            watermarked_preview_s3_key,
            thumbnail_s3_key,
            annotated_s3_key,
            caption,
            search_text,
            upload_status,
            compression_status,
            watermark_status,
            face_index_status,
            qwen_status,
            search_index_status,
            custom_sort_order,
            created_at,
            updated_at
          )
          SELECT
            p.album_id,
            $4::uuid,
            selected.photo_uuid,
            NULL,
            p.storage_album_slug,
            $5,
            p.file_name,
            p.file_size_bytes,
            p.width,
            p.height,
            NULL,
            p.ai_input_s3_key,
            p.clean_preview_s3_key,
            p.watermarked_preview_s3_key,
            p.thumbnail_s3_key,
            p.annotated_s3_key,
            p.caption,
            p.search_text,
            p.upload_status,
            p.compression_status,
            p.watermark_status,
            p.face_index_status,
            p.qwen_status,
            p.search_index_status,
            selected.position::int,
            now(),
            now()
          FROM selected
          JOIN photos p
            ON p.id = selected.source_photo_id
           AND p.album_id = $1::uuid
           AND COALESCE(p.is_deleted, false) = false
          ORDER BY selected.position
          RETURNING id AS copied_photo_id, photo_uuid
        )
        SELECT selected.source_photo_id, copied.copied_photo_id
        FROM selected
        JOIN copied ON copied.photo_uuid = selected.photo_uuid
        ORDER BY selected.position
        `,
        [album.id, photoIds, photoUuids, targetEvent.id, targetEvent.slug],
      );

      if (copied.rows.length !== photoIds.length) {
        throw new Error("Some selected photos could not be copied");
      }

      await client.query(
        `
        WITH copied AS (
          SELECT input.source_photo_id, input.copied_photo_id
          FROM unnest($2::uuid[], $3::uuid[]) AS input(source_photo_id, copied_photo_id)
        )
        INSERT INTO photo_people(
          album_id,
          album_event_id,
          photo_id,
          person_id,
          person_label,
          face_ids,
          co_person_ids,
          search_text,
          confidence,
          qwen_description,
          qwen_json,
          search_embedding,
          created_at,
          updated_at
        )
        SELECT
          pp.album_id,
          $1::uuid,
          copied.copied_photo_id,
          pp.person_id,
          pp.person_label,
          pp.face_ids,
          pp.co_person_ids,
          pp.search_text,
          pp.confidence,
          pp.qwen_description,
          pp.qwen_json,
          pp.search_embedding,
          now(),
          now()
        FROM copied
        JOIN photo_people pp ON pp.photo_id = copied.source_photo_id
        `,
        [
          targetEvent.id,
          copied.rows.map((row) => row.source_photo_id),
          copied.rows.map((row) => row.copied_photo_id),
        ],
      );

      await client.query(
        `
        INSERT INTO person_event_stats(person_id, album_event_id, photo_count, face_count)
        SELECT
          pp.person_id,
          pp.album_event_id,
          COUNT(DISTINCT pp.photo_id)::int,
          COUNT(*)::int
        FROM photo_people pp
        WHERE pp.album_event_id = $1::uuid
        GROUP BY pp.person_id, pp.album_event_id
        `,
        [targetEvent.id],
      );

      return {
        ...targetEvent,
        copied_count: copied.rows.length,
      };
    });

    return NextResponse.json({
      event: {
        id: event.id,
        slug: event.slug,
        name: event.name,
        photoCount: Number.parseInt(String(event.copied_count ?? "0"), 10) || 0,
      },
      shareUrl: selectionShareUrl(request, album, event.slug, token),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "An event with this name already exists"
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("Error creating selection album:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create selection album",
      },
      { status: 500 },
    );
  }
}
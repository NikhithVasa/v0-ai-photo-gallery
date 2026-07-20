import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { NextResponse } from "next/server";
import { getAuthAccess, forbiddenResponse, unauthorizedResponse } from "@/lib/auth-access";
import { query, queryOne, withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface AlbumRow {
  id: string;
  slug: string;
  name: string;
  customer_id: string | null;
}

interface EventRow {
  id: string;
  slug: string;
  name: string;
}

type Destination =
  | { kind: "existing"; albumSlug: string; eventSlug: string }
  | { kind: "new"; albumName: string; eventName: string };

class MoveRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function parsePhotoIds(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 500) return null;
  if (!value.every(isUuid)) return null;
  const normalized = value.map((id) => id.toLowerCase());
  return new Set(normalized).size === normalized.length ? normalized : null;
}

function cleanName(value: unknown) {
  if (typeof value !== "string") return "";
  const name = value.trim().replace(/\s+/g, " ");
  return name.length <= 120 ? name : "";
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

function parseBody(value: unknown): { photoIds: string[]; destination: Destination } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).sort().join(",") !== "destination,photoIds") return null;

  const photoIds = parsePhotoIds(body.photoIds);
  const rawDestination = body.destination;
  if (!photoIds || !rawDestination || typeof rawDestination !== "object" || Array.isArray(rawDestination)) {
    return null;
  }

  const destination = rawDestination as Record<string, unknown>;
  if (destination.kind === "existing") {
    if (Object.keys(destination).sort().join(",") !== "albumSlug,eventSlug,kind") return null;
    const albumSlug = typeof destination.albumSlug === "string" ? destination.albumSlug.trim() : "";
    const eventSlug = typeof destination.eventSlug === "string" ? destination.eventSlug.trim() : "";
    if (!albumSlug || !eventSlug) return null;
    return { photoIds, destination: { kind: "existing", albumSlug, eventSlug } };
  }

  if (destination.kind === "new") {
    if (Object.keys(destination).sort().join(",") !== "albumName,eventName,kind") return null;
    const albumName = cleanName(destination.albumName);
    const eventName = cleanName(destination.eventName);
    if (!albumName || !eventName) return null;
    return { photoIds, destination: { kind: "new", albumName, eventName } };
  }

  return null;
}

async function fetchSourceAlbum(albumSlug: string) {
  return queryOne<AlbumRow>(
    `
    SELECT id, slug, name, customer_id
    FROM albums
    WHERE lower(slug) = lower($1)
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
    `,
    [albumSlug],
  );
}

function canAccessCustomer(access: { isAdmin: boolean; customerIds: string[] }, customerId: string | null) {
  return access.isAdmin || (customerId !== null && access.customerIds.includes(customerId));
}

async function ownerCustomerIds(email: string, client?: PoolClient) {
  const sql = `
    SELECT cu.customer_id
    FROM customer_users cu
    JOIN customers c ON c.id = cu.customer_id
      AND COALESCE(c.is_deleted, false) = false
    WHERE lower(cu.email) = lower($1)
      AND lower(COALESCE(cu.role, '')) = 'owner'
    ${client ? "FOR SHARE OF cu" : ""}
  `;
  const rows = client
    ? (await client.query<{ customer_id: string }>(sql, [email])).rows
    : await query<{ customer_id: string }>(sql, [email]);
  return Array.from(new Set(rows.map((row) => row.customer_id)));
}

async function tableColumns(client: PoolClient, tableName: string) {
  const result = await client.query<{ column_name: string }>(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = $1
    `,
    [tableName],
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function createDestination(client: PoolClient, source: AlbumRow, destination: Extract<Destination, { kind: "new" }>) {
  const baseSlug = slugify(destination.albumName);
  let album: AlbumRow | undefined;

  for (let attempt = 0; attempt < 12 && !album; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${randomUUID().slice(0, 8)}`;
    const inserted = await client.query<AlbumRow>(
      `
      INSERT INTO albums(
        name, slug, description, album_date, expires_at, customer_id,
        password_hash, password_required, created_by, watermark_enabled,
        created_at, updated_at
      )
      SELECT
        $2, $3, description, album_date, expires_at, customer_id,
        NULL, false, 'photo-move', COALESCE(watermark_enabled, false),
        now(), now()
      FROM albums
      WHERE id = $1::uuid
        AND COALESCE(is_deleted, false) = false
      ON CONFLICT (slug) DO NOTHING
      RETURNING id, slug, name, customer_id
      `,
      [source.id, destination.albumName, slug],
    );
    album = inserted.rows[0];
  }

  if (!album) throw new MoveRequestError("Could not allocate an album slug", 409);

  const insertedEvent = await client.query<EventRow>(
    `
    INSERT INTO album_events(album_id, customer_id, name, slug, sort_order, created_at, updated_at)
    VALUES($1::uuid, $2::uuid, $3, $4, 1, now(), now())
    RETURNING id, slug, name
    `,
    [album.id, album.customer_id, destination.eventName, slugify(destination.eventName)],
  );
  const event = insertedEvent.rows[0];
  if (!event) throw new Error("Could not create destination event");
  return { album, event, created: true };
}

async function lockExistingDestination(
  client: PoolClient,
  source: AlbumRow,
  destination: Extract<Destination, { kind: "existing" }>,
  access: { isAdmin: boolean; customerIds: string[] },
  ownedCustomerIds: string[],
) {
  const albumResult = await client.query<AlbumRow>(
    `
    SELECT id, slug, name, customer_id
    FROM albums
    WHERE lower(slug) = lower($1)
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
    FOR UPDATE
    `,
    [destination.albumSlug],
  );
  const album = albumResult.rows[0];
  if (!album) throw new MoveRequestError("Destination album not found", 404);
  if (!canAccessCustomer(access, album.customer_id)) throw new MoveRequestError("Access denied", 403);
  if (album.id !== source.id) {
    const mayMoveAcrossAlbums = access.isAdmin || (
      source.customer_id !== null &&
      ownedCustomerIds.includes(source.customer_id) &&
      album.customer_id !== null &&
      ownedCustomerIds.includes(album.customer_id)
    );
    if (!mayMoveAcrossAlbums) throw new MoveRequestError("Owner access is required for cross-album moves", 403);
  }

  const eventResult = await client.query<EventRow>(
    `
    SELECT id, slug, name
    FROM album_events
    WHERE album_id = $1::uuid
      AND lower(slug) = lower($2)
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
    FOR UPDATE
    `,
    [album.id, destination.eventSlug],
  );
  const event = eventResult.rows[0];
  if (!event) throw new MoveRequestError("Destination event not found", 404);
  return { album, event, created: false };
}

async function rebuildPersonStats(client: PoolClient, personIds: string[]) {
  if (!personIds.length) return;
  await client.query(`DELETE FROM person_event_stats WHERE person_id = ANY($1::uuid[])`, [personIds]);
  await client.query(
    `
    INSERT INTO person_event_stats(person_id, album_event_id, photo_count, face_count)
    SELECT person_id, album_event_id, COUNT(DISTINCT photo_id)::int, COUNT(*)::int
    FROM photo_people
    WHERE person_id = ANY($1::uuid[])
    GROUP BY person_id, album_event_id
    `,
    [personIds],
  );

  const peopleColumns = await tableColumns(client, "people");
  const assignments: string[] = [];
  if (peopleColumns.has("photo_count")) {
    assignments.push("photo_count = (SELECT COUNT(DISTINCT pp.photo_id)::int FROM photo_people pp WHERE pp.person_id = pe.id)");
  }
  if (peopleColumns.has("face_count")) {
    assignments.push("face_count = (SELECT COUNT(*)::int FROM photo_people pp WHERE pp.person_id = pe.id)");
  }
  if (peopleColumns.has("occurrence_count")) {
    assignments.push("occurrence_count = (SELECT COUNT(*)::int FROM photo_people pp WHERE pp.person_id = pe.id)");
  }
  if (peopleColumns.has("cover_face_s3_key")) {
    assignments.push(`cover_face_s3_key = (
      SELECT COALESCE(p.thumbnail_s3_key, p.ai_input_s3_key, p.clean_preview_s3_key, p.watermarked_preview_s3_key)
      FROM photo_people pp
      JOIN photos p ON p.id = pp.photo_id
      WHERE pp.person_id = pe.id
        AND COALESCE(p.is_deleted, false) = false
      ORDER BY p.created_at ASC NULLS LAST, p.id ASC
      LIMIT 1
    )`);
  }
  if (peopleColumns.has("is_hidden")) {
    assignments.push("is_hidden = CASE WHEN EXISTS (SELECT 1 FROM photo_people pp WHERE pp.person_id = pe.id) THEN pe.is_hidden ELSE true END");
  }
  if (peopleColumns.has("updated_at")) assignments.push("updated_at = now()");
  if (assignments.length) {
    await client.query(`UPDATE people pe SET ${assignments.join(", ")} WHERE pe.id = ANY($1::uuid[])`, [personIds]);
  }
}

async function repairCulling(client: PoolClient, photoIds: string[]) {
  if ((await tableColumns(client, "photo_similarity_cluster_items")).has("photo_id")) {
    const clusters = await client.query<{ cluster_id: string }>(
      `DELETE FROM photo_similarity_cluster_items WHERE photo_id = ANY($1::uuid[]) RETURNING cluster_id`,
      [photoIds],
    );
    const clusterIds = Array.from(new Set(clusters.rows.map((row) => row.cluster_id)));
    if (clusterIds.length) {
      await client.query(
        `
        UPDATE photo_similarity_clusters c
        SET best_photo_id = (
              SELECT ci.photo_id
              FROM photo_similarity_cluster_items ci
              WHERE ci.cluster_id = c.id
              ORDER BY ci.is_best DESC, ci.rank_in_cluster ASC NULLS LAST
              LIMIT 1
            ),
            updated_at = now()
        WHERE c.id = ANY($1::uuid[])
          AND (c.best_photo_id = ANY($2::uuid[]) OR c.best_photo_id IS NULL)
        `,
        [clusterIds, photoIds],
      );
      await client.query(
        `
        UPDATE photo_similarity_cluster_items ci
        SET is_best = (ci.photo_id = c.best_photo_id)
        FROM photo_similarity_clusters c
        WHERE ci.cluster_id = c.id
          AND c.id = ANY($1::uuid[])
        `,
        [clusterIds],
      );
      await client.query(
        `DELETE FROM photo_similarity_clusters c WHERE c.id = ANY($1::uuid[]) AND NOT EXISTS (SELECT 1 FROM photo_similarity_cluster_items ci WHERE ci.cluster_id = c.id)`,
        [clusterIds],
      );
    }
  }

  const relationshipColumns = await tableColumns(client, "photo_relationships");
  const endpoints = ["photo_id", "source_photo_id", "target_photo_id", "photo_a_id", "photo_b_id"].filter((column) => relationshipColumns.has(column));
  if (endpoints.length) {
    await client.query(`DELETE FROM photo_relationships WHERE ${endpoints.map((column) => `${column} = ANY($1::uuid[])`).join(" OR ")}`, [photoIds]);
  }
}

async function moveAcrossAlbums(
  client: PoolClient,
  source: AlbumRow,
  target: { album: AlbumRow; event: EventRow },
  photoIds: string[],
  mediaKeys: string[],
) {
  const affectedPeople = await client.query<{ person_id: string }>(
    `SELECT DISTINCT person_id FROM photo_people WHERE photo_id = ANY($1::uuid[])`,
    [photoIds],
  );
  const personIds = affectedPeople.rows.map((row) => row.person_id);

  const sortColumns = await tableColumns(client, "photo_sort_positions");
  if (sortColumns.has("photo_id")) {
    await client.query(`DELETE FROM photo_sort_positions WHERE photo_id = ANY($1::uuid[])`, [photoIds]);
  }

  await repairCulling(client, photoIds);

  const presetColumns = await tableColumns(client, "preset_applications");
  if (presetColumns.has("source_photo_id") && presetColumns.has("edited_photo_id")) {
    await client.query(
      `
      UPDATE preset_applications
      SET album_id = $2::uuid, album_event_id = $3::uuid
      WHERE source_photo_id = ANY($1::uuid[])
        AND edited_photo_id = ANY($1::uuid[])
      `,
      [photoIds, target.album.id, target.event.id],
    );
    await client.query(
      `
      DELETE FROM preset_applications
      WHERE (source_photo_id = ANY($1::uuid[]))
         <> (edited_photo_id = ANY($1::uuid[]))
      `,
      [photoIds],
    );
  }

  await client.query(`DELETE FROM photo_people WHERE photo_id = ANY($1::uuid[])`, [photoIds]);
  const faceColumns = await tableColumns(client, "faces");
  if (faceColumns.has("photo_id")) {
    await client.query(`DELETE FROM faces WHERE photo_id = ANY($1::uuid[])`, [photoIds]);
  }

  const editColumns = await tableColumns(client, "photo_edits");
  if (editColumns.has("photo_id")) {
    await client.query(
      `UPDATE photo_edits SET album_id = $2::uuid, album_event_id = $3::uuid${editColumns.has("updated_at") ? ", updated_at = now()" : ""} WHERE photo_id = ANY($1::uuid[])`,
      [photoIds, target.album.id, target.event.id],
    );
  }

  const jobColumns = await tableColumns(client, "processing_jobs");
  if (jobColumns.has("photo_id")) {
    await client.query(
      `UPDATE processing_jobs SET album_id = $2::uuid, album_event_id = $3::uuid WHERE photo_id = ANY($1::uuid[])`,
      [photoIds, target.album.id, target.event.id],
    );
  }

  const photoColumns = await tableColumns(client, "photos");
  const assignments = ["album_id = $2::uuid", "album_event_id = $3::uuid"];
  if (photoColumns.has("custom_sort_order")) assignments.push("custom_sort_order = NULL");
  for (const column of ["face_index_status", "qwen_status", "search_index_status", "image_embedding_status"]) {
    if (photoColumns.has(column)) assignments.push(`${column} = 'pending'`);
  }
  for (const column of [
    "face_index_error", "face_indexed_at", "qwen_error", "qwen_completed_at", "qwen_json",
    "qwen_description", "ai_description", "search_index_error", "search_indexed_at", "search_embedding",
    "image_embedding", "image_embedding_model", "image_embedded_at",
  ]) {
    if (photoColumns.has(column)) assignments.push(`${column} = NULL`);
  }
  if (photoColumns.has("updated_at")) assignments.push("updated_at = now()");
  await client.query(`UPDATE photos SET ${assignments.join(", ")} WHERE id = ANY($1::uuid[])`, [photoIds, target.album.id, target.event.id]);

  if (jobColumns.has("photo_id")) {
    await client.query(
      `
      INSERT INTO processing_jobs(album_id, album_event_id, photo_id, job_type, status, created_at, updated_at)
      SELECT $2::uuid, $3::uuid, id, 'face_index_photo', 'pending', now(), now()
      FROM photos WHERE id = ANY($1::uuid[])
      ON CONFLICT(photo_id, job_type) DO UPDATE SET
        album_id = EXCLUDED.album_id,
        album_event_id = EXCLUDED.album_event_id,
        status = 'pending',
        error_message = NULL,
        updated_at = now()
      `,
      [photoIds, target.album.id, target.event.id],
    );
  }

  if (mediaKeys.length) {
    await client.query(
      `UPDATE albums SET cover_photo_s3_key = NULL, updated_at = now() WHERE id = $1::uuid AND cover_photo_s3_key = ANY($2::text[])`,
      [source.id, mediaKeys],
    );
    await client.query(
      `UPDATE album_events SET cover_photo_s3_key = NULL, updated_at = now() WHERE album_id = $1::uuid AND cover_photo_s3_key = ANY($2::text[])`,
      [source.id, mediaKeys],
    );
  }

  await rebuildPersonStats(client, personIds);
}

async function moveWithinAlbum(client: PoolClient, album: AlbumRow, event: EventRow, photoIds: string[], oldEventIds: string[]) {
  await client.query(
    `UPDATE photos SET album_event_id = $2::uuid, updated_at = now() WHERE id = ANY($1::uuid[])`,
    [photoIds, event.id],
  );
  await client.query(`UPDATE photo_people SET album_event_id = $2::uuid WHERE photo_id = ANY($1::uuid[])`, [photoIds, event.id]);

  const sortColumns = await tableColumns(client, "photo_sort_positions");
  if (sortColumns.has("photo_id")) {
    await client.query(
      `DELETE FROM photo_sort_positions WHERE album_id = $1::uuid AND photo_id = ANY($2::uuid[]) AND scope = 'event'`,
      [album.id, photoIds],
    );
  }

  const affectedPeople = await client.query<{ person_id: string }>(
    `SELECT DISTINCT person_id FROM photo_people WHERE photo_id = ANY($1::uuid[])`,
    [photoIds],
  );
  const personIds = affectedPeople.rows.map((row) => row.person_id);
  if (personIds.length) {
    const eventIds = Array.from(new Set([...oldEventIds, event.id]));
    await client.query(
      `DELETE FROM person_event_stats WHERE person_id = ANY($1::uuid[]) AND album_event_id = ANY($2::uuid[])`,
      [personIds, eventIds],
    );
    await client.query(
      `
      INSERT INTO person_event_stats(person_id, album_event_id, photo_count, face_count)
      SELECT person_id, album_event_id, COUNT(DISTINCT photo_id)::int, COUNT(*)::int
      FROM photo_people
      WHERE person_id = ANY($1::uuid[]) AND album_event_id = ANY($2::uuid[])
      GROUP BY person_id, album_event_id
      `,
      [personIds, eventIds],
    );
  }
}

export async function GET(_request: Request, { params }: Props) {
  try {
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();
    const { albumSlug } = await params;
    const source = await fetchSourceAlbum(albumSlug);
    if (!source) return NextResponse.json({ error: "Album not found" }, { status: 404 });
    if (!canAccessCustomer(access, source.customer_id)) return forbiddenResponse();

    const ownedCustomerIds = access.isAdmin ? [] : await ownerCustomerIds(access.email);
    const mayManageAcrossAlbums = access.isAdmin || (
      source.customer_id !== null && ownedCustomerIds.includes(source.customer_id)
    );
    const rows = await query<{ id: string; slug: string; name: string; events: EventRow[] }>(
      `
      SELECT a.id, a.slug, a.name,
        COALESCE(jsonb_agg(jsonb_build_object('id', e.id, 'slug', e.slug, 'name', e.name)
          ORDER BY e.sort_order ASC NULLS LAST, e.name ASC, e.id ASC)
          FILTER (WHERE e.id IS NOT NULL), '[]'::jsonb) AS events
      FROM albums a
      LEFT JOIN album_events e ON e.album_id = a.id AND COALESCE(e.is_deleted, false) = false
      WHERE COALESCE(a.is_deleted, false) = false
        AND (
          ($2::boolean = true AND $3::boolean = true)
          OR ($3::boolean = true AND a.customer_id = ANY($4::uuid[]))
          OR a.id = $1::uuid
        )
      GROUP BY a.id
      ORDER BY a.name ASC, a.id ASC
      `,
      [source.id, access.isAdmin, mayManageAcrossAlbums, ownedCustomerIds],
    );

    return NextResponse.json(
      { destinations: rows, canCreate: mayManageAcrossAlbums },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error fetching photo move destinations:", error);
    return NextResponse.json({ error: "Failed to fetch move destinations" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Props) {
  try {
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();
    const { albumSlug } = await params;
    const source = await fetchSourceAlbum(albumSlug);
    if (!source) return NextResponse.json({ error: "Album not found" }, { status: 404 });
    if (!canAccessCustomer(access, source.customer_id)) return forbiddenResponse();

    const parsed = parseBody(await request.json().catch(() => null));
    if (!parsed) {
      return NextResponse.json({ error: "Invalid move request" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const lockedSourceResult = await client.query<AlbumRow>(
        `SELECT id, slug, name, customer_id FROM albums WHERE id = $1::uuid AND COALESCE(is_deleted, false) = false FOR UPDATE`,
        [source.id],
      );
      const lockedSource = lockedSourceResult.rows[0];
      if (!lockedSource || !canAccessCustomer(access, lockedSource.customer_id)) {
        throw new MoveRequestError("Access denied", 403);
      }

      const transactionOwnedCustomerIds = access.isAdmin
        ? []
        : await ownerCustomerIds(access.email, client);

      const selected = await client.query<{
        id: string;
        album_event_id: string;
        original_s3_key: string | null;
        source_s3_key: string | null;
        ai_input_s3_key: string | null;
        clean_preview_s3_key: string | null;
        watermarked_preview_s3_key: string | null;
        thumbnail_s3_key: string | null;
        annotated_s3_key: string | null;
      }>(
        `
        SELECT id, album_event_id, original_s3_key, source_s3_key, ai_input_s3_key,
          clean_preview_s3_key, watermarked_preview_s3_key, thumbnail_s3_key, annotated_s3_key
        FROM photos
        WHERE album_id = $1::uuid
          AND id = ANY($2::uuid[])
          AND COALESCE(is_deleted, false) = false
        ORDER BY id
        FOR UPDATE
        `,
        [lockedSource.id, parsed.photoIds],
      );
      if (selected.rows.length !== parsed.photoIds.length) {
        throw new MoveRequestError("One or more photos are unavailable in the source album", 409);
      }

      if (
        parsed.destination.kind === "new" &&
        !access.isAdmin &&
        (lockedSource.customer_id === null || !transactionOwnedCustomerIds.includes(lockedSource.customer_id))
      ) {
        throw new MoveRequestError("Owner access is required to create a destination album", 403);
      }

      const target = parsed.destination.kind === "new"
        ? await createDestination(client, lockedSource, parsed.destination)
        : await lockExistingDestination(client, lockedSource, parsed.destination, access, transactionOwnedCustomerIds);

      const sameAlbum = target.album.id === lockedSource.id;
      const changedPhotos = selected.rows.filter((photo) => photo.album_event_id !== target.event.id);
      const movedPhotoIds = changedPhotos.map((photo) => photo.id);
      if (movedPhotoIds.length) {
        const oldEventIds = changedPhotos.map((photo) => photo.album_event_id);
        if (sameAlbum) {
          await moveWithinAlbum(client, lockedSource, target.event, movedPhotoIds, oldEventIds);
        } else {
          const mediaKeys = Array.from(new Set(changedPhotos.flatMap((photo) => [
            photo.original_s3_key, photo.source_s3_key, photo.ai_input_s3_key,
            photo.clean_preview_s3_key, photo.watermarked_preview_s3_key,
            photo.thumbnail_s3_key, photo.annotated_s3_key,
          ]).filter((key): key is string => Boolean(key))));
          await moveAcrossAlbums(client, lockedSource, target, movedPhotoIds, mediaKeys);
        }
      }

      return {
        destination: {
          album: { id: target.album.id, slug: target.album.slug, name: target.album.name },
          event: target.event,
          created: target.created,
        },
        movedPhotoIds,
      };
    });

    return NextResponse.json({
      ok: true,
      destination: result.destination,
      movedPhotoIds: result.movedPhotoIds,
      movedCount: result.movedPhotoIds.length,
    });
  } catch (error) {
    if (error instanceof MoveRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error moving photos:", error);
    return NextResponse.json({ error: "Failed to move selected photos" }, { status: 500 });
  }
}

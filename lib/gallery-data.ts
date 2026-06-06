import { query } from "@/lib/db";
import { signedDownloadUrl, signedUrl } from "@/lib/s3";
import type { AlbumEvent, Photo, PhotoPerson, Person } from "@/lib/types";

export interface AlbumEventRow {
  id: string;
  slug: string;
  name: string;
  sort_order: number | null;
  photo_count: number | string | null;
  people_count: number | string | null;
}

export interface PhotoRow {
  id: string;
  album_id: string;
  album_slug: string;
  album_event_id: string;
  event_slug: string;
  event_name: string;
  file_name: string | null;
  caption: string | null;
  search_text: string | null;
  width: number | null;
  height: number | null;
  original_s3_key: string | null;
  clean_preview_s3_key: string | null;
  watermarked_preview_s3_key: string | null;
  thumbnail_s3_key: string | null;
  annotated_s3_key: string | null;
  compression_status?: string | null;
  watermark_status?: string | null;
  person_search_text?: string | null;
  qwen_description?: string | null;
  people?: unknown;
}

export interface PersonRow {
  id: string;
  album_id: string;
  person_number: number | null;
  default_name: string;
  display_name: string | null;
  cover_face_s3_key: string | null;
  face_count: number | string | null;
  photo_count: number | string | null;
  occurrence_count: number | string | null;
}

interface PersonEventStatsRow {
  person_id: string;
  event_slug: string;
  event_name: string;
  photo_count: number | string | null;
  face_count: number | string | null;
}

function numberValue(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

export function toAlbumEvent(row: AlbumEventRow): AlbumEvent {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sortOrder: numberValue(row.sort_order),
    photoCount: numberValue(row.photo_count),
    peopleCount: numberValue(row.people_count),
  };
}

function derivativeReady(status: string | null | undefined) {
  return status === undefined || status === null || status === "completed";
}

function gridKey(row: PhotoRow) {
  return (
    (derivativeReady(row.compression_status) ? row.thumbnail_s3_key : null) ??
    (derivativeReady(row.watermark_status)
      ? row.watermarked_preview_s3_key
      : null) ??
    (derivativeReady(row.compression_status)
      ? row.clean_preview_s3_key
      : null) ??
    row.original_s3_key
  );
}

function previewKey(row: PhotoRow) {
  return (
    (derivativeReady(row.watermark_status)
      ? row.watermarked_preview_s3_key
      : null) ??
    (derivativeReady(row.compression_status)
      ? row.clean_preview_s3_key
      : null) ??
    row.original_s3_key
  );
}

interface PhotoPersonRow {
  id?: unknown;
  person_number?: unknown;
  default_name?: unknown;
  display_name?: unknown;
  photo_count?: unknown;
  cover_face_s3_key?: unknown;
}

function parsePhotoPeople(value: unknown): PhotoPersonRow[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as PhotoPersonRow[];
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as PhotoPersonRow[]) : [];
  } catch {
    return [];
  }
}

async function toPhotoPerson(row: PhotoPersonRow): Promise<PhotoPerson | null> {
  if (typeof row.id !== "string") return null;

  return {
    id: row.id,
    personNumber:
      typeof row.person_number === "number"
        ? row.person_number
        : typeof row.person_number === "string"
          ? Number.parseInt(row.person_number, 10) || 0
          : 0,
    defaultName:
      typeof row.default_name === "string" ? row.default_name : "Person",
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    photoCount: numberValue(row.photo_count as number | string | null),
    coverFaceUrl: await signedUrl(
      typeof row.cover_face_s3_key === "string" ? row.cover_face_s3_key : null
    ),
  };
}

export async function toPhoto(row: PhotoRow): Promise<Photo> {
  const [thumbnailUrl, previewUrl, people] = await Promise.all([
    signedUrl(gridKey(row)),
    signedUrl(previewKey(row)),
    Promise.all(parsePhotoPeople(row.people).map(toPhotoPerson)).then((items) =>
      items.filter((item): item is PhotoPerson => Boolean(item))
    ),
  ]);

  return {
    id: row.id,
    albumId: row.album_id,
    albumSlug: row.album_slug,
    eventId: row.album_event_id,
    eventSlug: row.event_slug,
    eventName: row.event_name,
    fileName: row.file_name,
    caption: row.caption,
    searchText: row.search_text,
    previewUrl,
    thumbnailUrl,
    downloadUrl: null,
    width: row.width,
    height: row.height,
    personSearchText: row.person_search_text,
    qwenDescription: row.qwen_description,
    originalS3Key: row.original_s3_key,
    cleanPreviewS3Key: row.clean_preview_s3_key,
    watermarkedPreviewS3Key: row.watermarked_preview_s3_key,
    thumbnailS3Key: row.thumbnail_s3_key,
    annotatedS3Key: row.annotated_s3_key,
    people,
  };
}

export async function signedPhotoUrlBundle(row: Pick<
  PhotoRow,
  | "id"
  | "file_name"
  | "original_s3_key"
  | "clean_preview_s3_key"
  | "watermarked_preview_s3_key"
  | "thumbnail_s3_key"
  | "compression_status"
  | "watermark_status"
>) {
  const [previewUrl, downloadUrl, thumbnailUrl, originalUrl] = await Promise.all([
    signedUrl(previewKey(row as PhotoRow)),
    signedDownloadUrl(row.original_s3_key, row.file_name ?? undefined),
    signedUrl(gridKey(row as PhotoRow)),
    signedUrl(row.original_s3_key),
  ]);

  return {
    id: row.id,
    previewUrl,
    downloadUrl,
    thumbnailUrl,
    originalUrl,
  };
}

export async function fetchAlbumEvents(albumSlug: string) {
  const rows = await query<AlbumEventRow>(
    `
    SELECT
      e.id,
      e.slug,
      e.name,
      e.sort_order,
      COUNT(DISTINCT p.id)::int AS photo_count,
      COUNT(DISTINCT CASE
        WHEN COALESCE(pes.photo_count, 0) > 0 THEN pes.person_id
      END)::int AS people_count
    FROM album_events e
    JOIN albums a ON a.id = e.album_id
    LEFT JOIN photos p
      ON p.album_event_id = e.id
     AND COALESCE(p.is_deleted, false) = false
     AND p.upload_status = 'completed'
    LEFT JOIN person_event_stats pes ON pes.album_event_id = e.id
    WHERE lower(a.slug) = lower($1)
      AND COALESCE(e.is_deleted, false) = false
    GROUP BY e.id, e.slug, e.name, e.sort_order
    ORDER BY e.sort_order ASC NULLS LAST, e.name ASC
    `,
    [albumSlug]
  );

  return rows.map(toAlbumEvent);
}

export async function attachPersonEventStats(
  albumSlug: string,
  people: Person[]
) {
  if (!people.length) return people;

  const personIds = people.map((person) => person.id);
  const rows = await query<PersonEventStatsRow>(
    `
    SELECT
      selected.person_id,
      e.slug AS event_slug,
      e.name AS event_name,
      COALESCE(pes.photo_count, 0)::int AS photo_count,
      COALESCE(pes.face_count, 0)::int AS face_count
    FROM unnest($2::uuid[]) AS selected(person_id)
    JOIN albums a ON a.slug = $1
    JOIN album_events e ON e.album_id = a.id
    LEFT JOIN person_event_stats pes
      ON pes.person_id = selected.person_id
     AND pes.album_event_id = e.id
    ORDER BY e.sort_order ASC NULLS LAST, e.name ASC
    `,
    [albumSlug, personIds]
  );

  const statsByPerson = new Map<string, Person["eventStats"]>();
  for (const row of rows) {
    const stats = statsByPerson.get(row.person_id) ?? [];
    stats.push({
      eventSlug: row.event_slug,
      eventName: row.event_name,
      photoCount: numberValue(row.photo_count),
      faceCount: numberValue(row.face_count),
    });
    statsByPerson.set(row.person_id, stats);
  }

  return people.map((person) => ({
    ...person,
    eventStats: statsByPerson.get(person.id) ?? [],
  }));
}

export async function toPerson(row: PersonRow): Promise<Person> {
  return {
    id: row.id,
    albumId: row.album_id,
    personNumber: row.person_number ?? 0,
    defaultName: row.default_name,
    displayName: row.display_name,
    photoCount: numberValue(row.photo_count),
    faceCount: numberValue(row.face_count),
    occurrenceCount: numberValue(row.occurrence_count),
    coverFaceUrl: await signedUrl(row.cover_face_s3_key),
  };
}

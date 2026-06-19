import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { query } from "@/lib/db";
import { s3 } from "@/lib/s3";
import { requireAlbumAccess } from "@/lib/album-access";
import { getShareLinkAccess } from "@/lib/share-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface DownloadPhotoRow {
  id: string;
  file_name: string | null;
  original_s3_key: string | null;
  event_slug: string;
  event_name: string;
}

interface ZipEntry {
  row: DownloadPhotoRow;
  path: string;
}

type DownloadFormat = "original" | "png" | "jpeg";

interface CentralDirectoryEntry {
  fileName: Uint8Array;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const textEncoder = new TextEncoder();

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function shortToken(value: string | null) {
  if (!value) return "";
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function sanitizeSegment(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/(^[.\s]+|[.\s]+$)/g, "") || "photos"
  );
}

function parseDownloadFormat(value: string | null): DownloadFormat {
  return value === "png" || value === "jpeg" ? value : "original";
}

function zipFileName(
  albumSlug: string,
  eventSlug: string | null,
  hasPeople: boolean,
  hasSelectedPhotos: boolean,
  format: DownloadFormat,
) {
  const suffix = hasSelectedPhotos
    ? "selected"
    : eventSlug
      ? eventSlug
      : hasPeople
        ? "filtered-people"
        : "all";
  const formatSuffix = format === "original" ? "" : `-${format}`;
  return `${sanitizeSegment(albumSlug)}-${sanitizeSegment(suffix)}${formatSuffix}.zip`;
}

function withDownloadFormatExtension(fileName: string, format: DownloadFormat) {
  if (format === "original") return fileName;

  const extension = format === "jpeg" ? "jpg" : "png";
  const dotIndex = fileName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;

  return `${baseName}.${extension}`;
}

function uniqueZipEntries(rows: DownloadPhotoRow[], format: DownloadFormat) {
  const used = new Map<string, number>();

  return rows
    .filter((row) => row.original_s3_key)
    .map((row): ZipEntry => {
      const eventFolder = sanitizeSegment(row.event_slug || row.event_name || "event");
      const fileName = withDownloadFormatExtension(
        sanitizeSegment(row.file_name || `${row.id}.jpg`),
        format,
      );
      const path = `${eventFolder}/${fileName}`;
      const count = used.get(path) ?? 0;
      used.set(path, count + 1);

      if (count === 0) return { row, path };

      const dotIndex = fileName.lastIndexOf(".");
      const dedupedName =
        dotIndex > 0
          ? `${fileName.slice(0, dotIndex)}-${count + 1}${fileName.slice(dotIndex)}`
          : `${fileName}-${count + 1}`;

      return { row, path: `${eventFolder}/${dedupedName}` };
    });
}

function dosTimeDate(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const day = (year - 1980) << 9 | ((date.getMonth() + 1) << 5) | date.getDate();

  return { time, day };
}

function uint16(value: number) {
  const bytes = new Uint8Array(2);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, value, true);
  return bytes;
}

function uint32(value: number) {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value >>> 0, true);
  return bytes;
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }

  return bytes;
}

function localHeader(fileName: Uint8Array) {
  const { time, day } = dosTimeDate();
  return concatBytes([
    uint32(0x04034b50),
    uint16(20),
    uint16(0x0808),
    uint16(0),
    uint16(time),
    uint16(day),
    uint32(0),
    uint32(0),
    uint32(0),
    uint16(fileName.byteLength),
    uint16(0),
    fileName,
  ]);
}

function dataDescriptor(crc32Value: number, size: number) {
  return concatBytes([
    uint32(0x08074b50),
    uint32(crc32Value),
    uint32(size),
    uint32(size),
  ]);
}

function centralDirectoryHeader(entry: CentralDirectoryEntry) {
  const { time, day } = dosTimeDate();
  return concatBytes([
    uint32(0x02014b50),
    uint16(20),
    uint16(20),
    uint16(0x0808),
    uint16(0),
    uint16(time),
    uint16(day),
    uint32(entry.crc32),
    uint32(entry.compressedSize),
    uint32(entry.uncompressedSize),
    uint16(entry.fileName.byteLength),
    uint16(0),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(0),
    uint32(entry.localHeaderOffset),
    entry.fileName,
  ]);
}

function endOfCentralDirectory(entryCount: number, centralSize: number, centralOffset: number) {
  return concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entryCount),
    uint16(entryCount),
    uint32(centralSize),
    uint32(centralOffset),
    uint16(0),
  ]);
}

function updateCrc32(crc: number, chunk: Uint8Array) {
  let current = crc;
  for (const byte of chunk) {
    current = crcTable[(current ^ byte) & 0xff] ^ (current >>> 8);
  }
  return current >>> 0;
}

async function* objectChunks(key: string): AsyncGenerator<Uint8Array> {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    }),
  );

  const body = response.Body;
  if (!body) return;

  if (Symbol.asyncIterator in Object(body)) {
    for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
      yield typeof chunk === "string" ? Buffer.from(chunk) : new Uint8Array(chunk);
    }
    return;
  }

  if ("transformToByteArray" in Object(body)) {
    yield await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
  }
}

async function convertedObjectBytes(key: string, format: Exclude<DownloadFormat, "original">) {
  const chunks: Uint8Array[] = [];

  for await (const chunk of objectChunks(key)) {
    chunks.push(chunk);
  }

  const input = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  const image = sharp(input, { failOn: "none" }).rotate();

  if (format === "png") {
    return image.png().toBuffer();
  }

  return image.flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
}

async function* downloadEntryChunks(entry: ZipEntry, format: DownloadFormat) {
  const key = entry.row.original_s3_key;
  if (!key) return;

  if (format === "original") {
    yield* objectChunks(key);
    return;
  }

  yield await convertedObjectBytes(key, format);
}

async function fetchDownloadRows(
  albumSlug: string,
  eventSlug: string | null,
  personIds: string[],
  peopleMode: "all" | "any" | "only",
  photoIds: string[],
) {
  return query<DownloadPhotoRow>(
    `
    SELECT
      p.id,
      p.file_name,
      p.original_s3_key,
      e.slug AS event_slug,
      e.name AS event_name
    FROM photos p
    JOIN albums a
      ON a.id = p.album_id
    JOIN album_events e
      ON e.id = p.album_event_id
     AND COALESCE(e.is_deleted, false) = false
    WHERE lower(a.slug) = lower($1)
      AND COALESCE(a.is_deleted, false) = false
      AND ($2::text IS NULL OR e.slug = $2)
      AND (
        $3::uuid[] IS NULL
        OR CASE
          WHEN $4::text = 'only' THEN (
            SELECT COUNT(DISTINCT pp.person_id)
            FROM photo_people pp
            WHERE pp.photo_id = p.id
              AND pp.person_id = ANY($3::uuid[])
          ) = cardinality($3::uuid[])
          AND (
            SELECT COUNT(DISTINCT pp.person_id)
            FROM photo_people pp
            JOIN people pe
              ON pe.id = pp.person_id
             AND COALESCE(pe.is_hidden, false) = false
            WHERE pp.photo_id = p.id
          ) = cardinality($3::uuid[])
          WHEN $4::text = 'all' THEN (
            SELECT COUNT(DISTINCT pp.person_id)
            FROM photo_people pp
            WHERE pp.photo_id = p.id
              AND pp.person_id = ANY($3::uuid[])
          ) = cardinality($3::uuid[])
          ELSE EXISTS (
            SELECT 1
            FROM photo_people pp
            WHERE pp.photo_id = p.id
              AND pp.person_id = ANY($3::uuid[])
          )
        END
      )
      AND COALESCE(p.is_deleted, false) = false
      AND p.upload_status = 'completed'
      AND p.original_s3_key IS NOT NULL
      AND ($5::uuid[] IS NULL OR p.id = ANY($5::uuid[]))
    ORDER BY e.sort_order ASC NULLS LAST, e.name ASC, p.created_at ASC
    `,
    [
      albumSlug,
      eventSlug,
      personIds.length ? personIds : null,
      peopleMode,
      photoIds.length ? photoIds : null,
    ],
  );
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const { searchParams } = new URL(request.url);
    const shareToken = searchParams.get("share");
    const eventSlug = searchParams.get("event") || null;
    const format = parseDownloadFormat(searchParams.get("format"));
    const rawPeopleMode = searchParams.get("peopleMode");
    let peopleMode: "all" | "any" | "only" =
      rawPeopleMode === "any" || rawPeopleMode === "only"
        ? rawPeopleMode
        : "all";
    let personIds = (searchParams.get("people") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id && isUuid(id));
    const photoIds = (searchParams.get("photos") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id && isUuid(id))
      .slice(0, 500);

    console.log("[share-debug] album download API start", {
      albumSlug,
      eventSlug,
      format,
      peopleMode,
      peopleCount: personIds.length,
      selectedPhotoCount: photoIds.length,
      hasShareToken: Boolean(shareToken),
      shareToken: shortToken(shareToken),
    });

    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) {
      console.log("[share-debug] album download API access denied", {
        albumSlug,
        eventSlug,
        status: accessDenied.status,
        hasShareToken: Boolean(shareToken),
      });
      return accessDenied;
    }

    const shareAccess = await getShareLinkAccess(request, albumSlug);
    if (shareAccess && !shareAccess.allowDownloads) {
      return NextResponse.json(
        { error: "Downloads are disabled for this share link" },
        { status: 403 },
      );
    }
    if (shareAccess?.personId) {
      personIds = [shareAccess.personId];
      peopleMode = shareAccess.onlyPerson ? "only" : "all";
    }

    const rows = await fetchDownloadRows(
      albumSlug,
      eventSlug,
      personIds,
      peopleMode,
      photoIds,
    );
    const entries = uniqueZipEntries(rows, format);
    console.log("[share-debug] album download API rows loaded", {
      albumSlug,
      eventSlug,
      rows: rows.length,
      entries: entries.length,
      format,
    });

    if (!entries.length) {
      console.log("[share-debug] album download API no downloadable photos", {
        albumSlug,
        eventSlug,
        rows: rows.length,
        format,
      });
      return NextResponse.json({ error: "No downloadable photos found" }, { status: 404 });
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const centralEntries: CentralDirectoryEntry[] = [];
        let offset = 0;

        try {
          for (const entry of entries) {
            const fileName = textEncoder.encode(entry.path);
            const header = localHeader(fileName);
            const localHeaderOffset = offset;
            let crc = 0xffffffff;
            let size = 0;

            controller.enqueue(header);
            offset += header.byteLength;

            for await (const chunk of downloadEntryChunks(entry, format)) {
              crc = updateCrc32(crc, chunk);
              size += chunk.byteLength;
              offset += chunk.byteLength;
              controller.enqueue(chunk);
            }

            const crc32Value = (crc ^ 0xffffffff) >>> 0;
            const descriptor = dataDescriptor(crc32Value, size);
            controller.enqueue(descriptor);
            offset += descriptor.byteLength;

            centralEntries.push({
              fileName,
              crc32: crc32Value,
              compressedSize: size,
              uncompressedSize: size,
              localHeaderOffset,
            });
          }

          const centralOffset = offset;
          let centralSize = 0;

          for (const entry of centralEntries) {
            const header = centralDirectoryHeader(entry);
            centralSize += header.byteLength;
            offset += header.byteLength;
            controller.enqueue(header);
          }

          controller.enqueue(
            endOfCentralDirectory(centralEntries.length, centralSize, centralOffset),
          );
          controller.close();
        } catch (error) {
          console.error("[share-debug] album download API stream failed", {
            albumSlug,
            eventSlug,
            format,
            entries: entries.length,
            error,
          });
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFileName(
          albumSlug,
          eventSlug,
          personIds.length > 0,
          photoIds.length > 0,
          format,
        )}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[share-debug] album download API failed", error);
    return NextResponse.json(
      { error: "Failed to create download" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import {
  attachPersonEventStats,
  toPerson,
  toPhoto,
  type PersonRow,
  type PhotoRow,
} from "@/lib/gallery-data";
import type { Person } from "@/lib/types";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface PersonMatch {
  id: string;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function extractSearchTerms(query: string) {
  const personNames = new Set<string>();
  const keywords: string[] = [];
  const personNumberMatches = query.matchAll(/\bperson\s*(\d+)\b/gi);

  for (const match of personNumberMatches) {
    personNames.add(`person ${match[1]}`);
  }

  const cleaned = query
    .toLowerCase()
    .replace(/\bphotos?\b/g, " ")
    .replace(
      /\b(give|show|find|get|search|look|looking|want|need|please|pls|me|my|of|with|and|being|is|are|in|the|a|an|for|from)\b/g,
      " "
    )
    .replace(/\bperson\s*\d+\b/gi, " ");

  const actionWords = new Set([
    "dancing",
    "eating",
    "smiling",
    "laughing",
    "crying",
    "emotional",
    "happy",
    "sad",
    "side",
    "face",
    "front",
    "back",
    "sitting",
    "standing",
    "walking",
    "talking",
    "looking",
    "playing",
    "ceremony",
    "family",
    "stage",
    "group",
    "portrait",
    "couple",
  ]);

  for (const word of cleaned.split(/\s+/).filter(Boolean)) {
    if (actionWords.has(word)) {
      keywords.push(word);
    } else if (word.length > 2) {
      personNames.add(word);
    }
  }

  return { personNames: Array.from(personNames), keywords };
}

async function resolvePerson(albumSlug: string, nameOrId: string) {
  const value = normalizeQuery(nameOrId);
  if (!value) return null;

  if (isUuid(value)) {
    const person = await queryOne<PersonMatch>(
      `
      SELECT pe.id
      FROM people pe
      JOIN albums a ON a.id = pe.album_id
      WHERE a.slug = $1
        AND pe.id = $2
      LIMIT 1
      `,
      [albumSlug, value]
    );
    return person?.id ?? null;
  }

  const numberMatch = value.match(/^person\s*(\d+)$/i);
  if (numberMatch) {
    const person = await queryOne<PersonMatch>(
      `
      SELECT pe.id
      FROM people pe
      JOIN albums a ON a.id = pe.album_id
      WHERE a.slug = $1
        AND pe.person_number = $2
      LIMIT 1
      `,
      [albumSlug, Number.parseInt(numberMatch[1], 10)]
    );
    if (person) return person.id;
  }

  let person = await queryOne<PersonMatch>(
    `
    SELECT pe.id
    FROM people pe
    JOIN albums a ON a.id = pe.album_id
    WHERE a.slug = $1
      AND (
        LOWER(pe.display_name) = LOWER($2)
        OR LOWER(pe.default_name) = LOWER($2)
      )
    LIMIT 1
    `,
    [albumSlug, value]
  );
  if (person) return person.id;

  try {
    person = await queryOne<PersonMatch>(
      `
      SELECT pe.id
      FROM person_aliases pa
      JOIN people pe ON pe.id = pa.person_id
      JOIN albums a ON a.id = pe.album_id
      WHERE a.slug = $1
        AND LOWER(pa.alias) = LOWER($2)
      LIMIT 1
      `,
      [albumSlug, value]
    );
    if (person) return person.id;
  } catch {
    // Some album deployments may not carry the optional aliases table yet.
  }

  person = await queryOne<PersonMatch>(
    `
    SELECT pe.id
    FROM people pe
    JOIN albums a ON a.id = pe.album_id
    WHERE a.slug = $1
      AND (
        LOWER(pe.display_name) LIKE '%' || LOWER($2) || '%'
        OR LOWER(pe.default_name) LIKE '%' || LOWER($2) || '%'
      )
    ORDER BY pe.photo_count DESC NULLS LAST, pe.person_number ASC
    LIMIT 1
    `,
    [albumSlug, value]
  );

  return person?.id ?? null;
}

async function fetchResolvedPeople(albumSlug: string, personIds: string[]) {
  if (!personIds.length) return [];

  const rows = await query<PersonRow>(
    `
    SELECT
      pe.id,
      pe.album_id,
      pe.person_number,
      pe.default_name,
      pe.display_name,
      pe.cover_face_s3_key,
      pe.face_count,
      pe.photo_count,
      pe.occurrence_count
    FROM people pe
    JOIN albums a ON a.id = pe.album_id
    WHERE a.slug = $1
      AND pe.id = ANY($2::uuid[])
    ORDER BY pe.photo_count DESC NULLS LAST, pe.person_number ASC
    `,
    [albumSlug, personIds]
  );

  return attachPersonEventStats(
    albumSlug,
    (await Promise.all(rows.map(toPerson))) satisfies Person[]
  );
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { albumSlug } = await params;
    const body = (await request.json()) as {
      query?: unknown;
      event?: unknown;
      people?: unknown;
      together?: unknown;
      limit?: unknown;
    };
    const searchQuery =
      typeof body.query === "string" ? normalizeQuery(body.query) : "";
    const eventSlug =
      typeof body.event === "string" && body.event.trim()
        ? body.event.trim()
        : null;
    const requestedPeople = Array.isArray(body.people)
      ? body.people.filter((person): person is string => typeof person === "string")
      : [];
    const limit =
      typeof body.limit === "number" && body.limit > 0
        ? Math.min(Math.floor(body.limit), 100)
        : 100;
    const together = body.together !== false;

    if (!searchQuery && requestedPeople.length === 0) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const { personNames, keywords } = extractSearchTerms(searchQuery);
    const resolvedIds = new Set<string>();
    const unresolvedTerms = new Set<string>();

    for (const value of [...requestedPeople, ...personNames]) {
      const personId = await resolvePerson(albumSlug, value);
      if (personId) {
        resolvedIds.add(personId);
      } else if (!isUuid(value) && !/^person\s*\d+$/i.test(value)) {
        unresolvedTerms.add(value);
      }
    }

    const personIds = Array.from(resolvedIds);
const keywordTerms =
  personIds.length > 0
    ? keywords
    : [...keywords, ...unresolvedTerms];
        const keyword =
      keywordTerms.length > 0
        ? keywordTerms.join(" ")
        : personIds.length > 0
          ? null
          : searchQuery;

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
        e.slug AS event_slug,
        e.name AS event_name,
        MIN(pp_text.search_text) AS person_search_text,
        MIN(pp_text.qwen_description) AS qwen_description,
        COALESCE(photo_people_summary.people, '[]'::jsonb) AS people
      FROM photos p
      JOIN albums a ON a.id = p.album_id
      JOIN album_events e ON e.id = p.album_event_id
      LEFT JOIN photo_people pp_text ON pp_text.photo_id = p.id
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
        FROM photo_people pp
        JOIN people pe ON pe.id = pp.person_id
        WHERE pp.photo_id = p.id
          AND COALESCE(pe.is_hidden, false) = false
      ) photo_people_summary ON true
      WHERE a.slug = $1
        AND ($2::text IS NULL OR e.slug = $2)
        AND COALESCE(p.is_deleted, false) = false
        AND (
          $3::text IS NULL
          OR p.search_text ILIKE '%' || $3 || '%'
          OR p.caption ILIKE '%' || $3 || '%'
          OR pp_text.search_text ILIKE '%' || $3 || '%'
          OR pp_text.qwen_description ILIKE '%' || $3 || '%'
        )
        AND (
          $4::uuid[] IS NULL
          OR CASE
            WHEN $5::boolean THEN (
              SELECT COUNT(DISTINCT pp.person_id)
              FROM photo_people pp
              WHERE pp.photo_id = p.id
                AND pp.person_id = ANY($4::uuid[])
            ) = cardinality($4::uuid[])
            ELSE EXISTS (
              SELECT 1
              FROM photo_people pp
              WHERE pp.photo_id = p.id
                AND pp.person_id = ANY($4::uuid[])
            )
          END
        )
      GROUP BY
        p.id,
        p.album_id,
        a.slug,
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
        e.slug,
        e.name,
        photo_people_summary.people,
        p.created_at
      ORDER BY p.created_at ASC
      LIMIT $6
      `,
      [
        albumSlug,
        eventSlug,
        keyword,
        personIds.length ? personIds : null,
        together,
        limit,
      ]
    );

    const [resolvedPeople, results] = await Promise.all([
      fetchResolvedPeople(albumSlug, personIds),
      Promise.all(rows.map(toPhoto)),
    ]);

    return NextResponse.json({
      query: searchQuery,
      resolvedPeople,
      results,
    });
  } catch (error) {
    console.error("Error searching album photos:", error);
    return NextResponse.json(
      { error: "Failed to search photos" },
      { status: 500 }
    );
  }
}

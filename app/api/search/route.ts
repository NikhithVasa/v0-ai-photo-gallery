import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { signedUrl, signedDownloadUrl } from "@/lib/s3";
import type { SearchResult } from "@/lib/types";

interface PersonMatch {
  id: string;
  display_name: string | null;
  default_name: string;
}

interface PhotoRow {
  id: string;
  caption: string | null;
  search_text: string | null;
  original_s3_key: string | null;
  preview_s3_key: string | null;
  thumbnail_s3_key: string | null;
  person_search_text: string | null;
  qwen_description: string | null;
}

async function resolvePersonName(name: string): Promise<string | null> {
  // Try direct match on people table
  let person = await queryOne<PersonMatch>(
    `
    SELECT id, display_name, default_name
    FROM people
    WHERE LOWER(display_name) = LOWER($1)
       OR LOWER(default_name) = LOWER($1)
    LIMIT 1
  `,
    [name]
  );

  if (person) return person.id;

  // Try aliases
  person = await queryOne<PersonMatch>(
    `
    SELECT p.id, p.display_name, p.default_name
    FROM person_aliases pa
    JOIN people p ON p.id = pa.person_id
    WHERE LOWER(pa.alias) = LOWER($1)
    LIMIT 1
  `,
    [name]
  );

  if (person) return person.id;

  // Try partial match
  person = await queryOne<PersonMatch>(
    `
    SELECT id, display_name, default_name
    FROM people
    WHERE LOWER(display_name) LIKE '%' || LOWER($1) || '%'
       OR LOWER(default_name) LIKE '%' || LOWER($1) || '%'
    LIMIT 1
  `,
    [name]
  );

  return person?.id ?? null;
}

function extractSearchTerms(query: string): {
  personNames: string[];
  keywords: string[];
} {
  // Remove common filler words
  const cleaned = query
    .toLowerCase()
    .replace(/^photos?\s+of\s+/i, "")
    .replace(/\s+with\s+/g, " ")
    .replace(/\s+and\s+/g, " ")
    .replace(/\s+being\s+/g, " ")
    .replace(/\s+is\s+/g, " ");

  const words = cleaned.split(/\s+/).filter(Boolean);

  // Words that are likely actions/adjectives, not names
  const actionWords = [
    "dancing",
    "eating",
    "smiling",
    "laughing",
    "crying",
    "emotional",
    "happy",
    "sad",
    "angry",
    "side",
    "face",
    "front",
    "back",
    "sitting",
    "standing",
    "walking",
    "running",
    "talking",
    "looking",
    "playing",
    "working",
    "reading",
    "writing",
    "cooking",
    "sleeping",
  ];

  const personNames: string[] = [];
  const keywords: string[] = [];

  for (const word of words) {
    if (actionWords.includes(word)) {
      keywords.push(word);
    } else if (word.match(/^person\s*\d+$/i)) {
      personNames.push(word);
    } else if (word.length > 2 && !actionWords.includes(word)) {
      // Could be a name, try to resolve it later
      personNames.push(word);
    }
  }

  return { personNames, keywords };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query: searchQuery } = body;

    if (!searchQuery || typeof searchQuery !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const { personNames, keywords } = extractSearchTerms(searchQuery);

    // Resolve person IDs
    const personIds: string[] = [];
    for (const name of personNames) {
      const personId = await resolvePersonName(name);
      if (personId) {
        personIds.push(personId);
      }
    }

    // Build search query based on resolved persons and keywords
    const keywordPattern = keywords.join("|") || "";
    const primaryPersonId = personIds[0] ?? null;
    const secondaryPersonId = personIds[1] ?? null;

    let rows: PhotoRow[];

    if (primaryPersonId && secondaryPersonId) {
      // Search for photos with both people
      rows = await query<PhotoRow>(
        `
        SELECT DISTINCT
          p.id,
          p.caption,
          p.search_text,
          p.original_s3_key,
          p.preview_s3_key,
          p.thumbnail_s3_key,
          p.created_at,
          pp.search_text AS person_search_text,
          pp.qwen_description
        FROM photo_people pp
        JOIN photos p ON p.id = pp.photo_id
        WHERE (
          pp.person_id = $1
          OR $1 = ANY(pp.co_person_ids)
          OR $1 = ANY(pp.interacting_with_person_ids)
          OR $1 = ANY(pp.nearby_person_ids)
        )
        AND EXISTS (
          SELECT 1 FROM photo_people pp2
          WHERE pp2.photo_id = p.id
          AND (
            pp2.person_id = $2
            OR $2 = ANY(pp2.co_person_ids)
            OR $2 = ANY(pp2.interacting_with_person_ids)
            OR $2 = ANY(pp2.nearby_person_ids)
          )
        )
        ${
          keywordPattern
            ? `AND (
          pp.search_text ~* $3
          OR pp.qwen_description ~* $3
          OR p.search_text ~* $3
          OR p.caption ~* $3
        )`
            : ""
        }
        ORDER BY p.created_at DESC
        LIMIT 100
      `,
        keywordPattern
          ? [primaryPersonId, secondaryPersonId, keywordPattern]
          : [primaryPersonId, secondaryPersonId]
      );
    } else if (primaryPersonId) {
      // Search for photos with one person
      rows = await query<PhotoRow>(
        `
        SELECT DISTINCT
          p.id,
          p.caption,
          p.search_text,
          p.original_s3_key,
          p.preview_s3_key,
          p.thumbnail_s3_key,
          p.created_at,
          pp.search_text AS person_search_text,
          pp.qwen_description
        FROM photo_people pp
        JOIN photos p ON p.id = pp.photo_id
        WHERE pp.person_id = $1
        ${
          keywordPattern
            ? `AND (
          pp.search_text ~* $2
          OR pp.qwen_description ~* $2
          OR p.search_text ~* $2
          OR p.caption ~* $2
        )`
            : ""
        }
        ORDER BY p.created_at DESC
        LIMIT 100
      `,
        keywordPattern ? [primaryPersonId, keywordPattern] : [primaryPersonId]
      );
    } else if (keywordPattern) {
      // Search by keywords only
      rows = await query<PhotoRow>(
        `
        SELECT DISTINCT
          p.id,
          p.caption,
          p.search_text,
          p.original_s3_key,
          p.preview_s3_key,
          p.thumbnail_s3_key,
          p.created_at,
          pp.search_text AS person_search_text,
          pp.qwen_description
        FROM photos p
        LEFT JOIN photo_people pp ON pp.photo_id = p.id
        WHERE (
          pp.search_text ~* $1
          OR pp.qwen_description ~* $1
          OR p.search_text ~* $1
          OR p.caption ~* $1
        )
        ORDER BY p.created_at DESC
        LIMIT 100
      `,
        [keywordPattern]
      );
    } else {
      // Fallback: text search across all fields
      rows = await query<PhotoRow>(
        `
        SELECT DISTINCT
          p.id,
          p.caption,
          p.search_text,
          p.original_s3_key,
          p.preview_s3_key,
          p.thumbnail_s3_key,
          p.created_at,
          pp.search_text AS person_search_text,
          pp.qwen_description
        FROM photos p
        LEFT JOIN photo_people pp ON pp.photo_id = p.id
        WHERE (
          p.search_text ILIKE '%' || $1 || '%'
          OR p.caption ILIKE '%' || $1 || '%'
          OR pp.search_text ILIKE '%' || $1 || '%'
          OR pp.qwen_description ILIKE '%' || $1 || '%'
        )
        ORDER BY p.created_at DESC
        LIMIT 100
      `,
        [searchQuery.toLowerCase()]
      );
    }

    const results: SearchResult[] = await Promise.all(
      rows.map(async (row, index) => ({
        photoId: row.id,
        previewUrl: await signedUrl(row.preview_s3_key ?? row.original_s3_key),
        thumbnailUrl: await signedUrl(
          row.thumbnail_s3_key ?? row.preview_s3_key ?? row.original_s3_key
        ),
        downloadUrl: await signedDownloadUrl(row.original_s3_key),
        reason:
          row.person_search_text || row.qwen_description || row.caption || null,
        score: 1 - index * 0.01,
      }))
    );

    return NextResponse.json({
      query: searchQuery,
      resolvedPersons: personIds,
      keywords,
      results,
    });
  } catch (error) {
    console.error("Error searching photos:", error);
    return NextResponse.json(
      { error: "Failed to search photos" },
      { status: 500 }
    );
  }
}

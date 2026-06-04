import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthAccess, unauthorizedResponse } from "@/lib/auth-access";
import { parseCubeLut } from "@/lib/cube-lut";
import { query, queryOne } from "@/lib/db";
import { serializePreset, type PresetRow } from "@/lib/preset-data";
import { ensurePresetSchema } from "@/lib/preset-schema";
import { uploadS3Object } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PRESET_BYTES = 25 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 15 * 1024 * 1024;
const SUPPORTED_PREVIEW_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function safeImageExtension(file: File) {
  const extension = file.name.toLowerCase().match(/\.(jpe?g|png|webp|avif)$/)?.[1];
  if (extension) return extension === "jpeg" ? "jpg" : extension;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/avif") return "avif";
  return "jpg";
}

function validatePreview(file: File | null, label: string) {
  if (!file) {
    throw new Error(`${label} preview image is required.`);
  }
  if (!SUPPORTED_PREVIEW_TYPES.has(file.type)) {
    throw new Error(`${label} preview must be a JPG, PNG, WebP, or AVIF image.`);
  }
  if (file.size > MAX_PREVIEW_BYTES) {
    throw new Error(`${label} preview image must be under 15 MB.`);
  }
}

export async function GET(request: Request) {
  try {
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();

    await ensurePresetSchema();

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "marketplace";
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const sort = searchParams.get("sort") || "popular";

    const rows = await query<PresetRow>(
      `
      SELECT
        p.*,
        (SELECT COUNT(*)::int FROM preset_saves ps WHERE ps.preset_id = p.id) AS save_count,
        EXISTS(
          SELECT 1
          FROM preset_saves ps
          WHERE ps.preset_id = p.id
            AND lower(ps.user_email) = lower($1)
        ) AS is_saved
      FROM presets p
      WHERE p.status = 'published'
        AND (
          ($2 = 'marketplace' AND p.visibility = 'public')
          OR ($2 = 'mine' AND lower(p.owner_email) = lower($1))
          OR (
            $2 = 'saved'
            AND EXISTS(
              SELECT 1 FROM preset_saves ps
              WHERE ps.preset_id = p.id
                AND lower(ps.user_email) = lower($1)
            )
          )
          OR (
            $2 = 'library'
            AND (
              lower(p.owner_email) = lower($1)
              OR EXISTS(
                SELECT 1 FROM preset_saves ps
                WHERE ps.preset_id = p.id
                  AND lower(ps.user_email) = lower($1)
              )
            )
          )
        )
        AND (
          $3 = ''
          OR p.name ILIKE '%' || $3 || '%'
          OR p.creator_name ILIKE '%' || $3 || '%'
          OR p.category ILIKE '%' || $3 || '%'
          OR array_to_string(p.tags, ' ') ILIKE '%' || $3 || '%'
          OR array_to_string(p.best_for, ' ') ILIKE '%' || $3 || '%'
        )
        AND ($4 = '' OR lower(p.category) = lower($4))
      ORDER BY
        CASE WHEN $5 = 'newest' THEN p.created_at END DESC,
        CASE WHEN $5 <> 'newest' THEN
          (SELECT COUNT(*) FROM preset_saves ps WHERE ps.preset_id = p.id)
        END DESC,
        p.created_at DESC
      `,
      [access.email, scope, search, category, sort],
    );

    return NextResponse.json(
      {
        presets: await Promise.all(
          rows.map((row) => serializePreset(row, access.email)),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error listing presets:", error);
    return NextResponse.json(
      { error: "We couldn't load presets right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();

    const formData = await request.formData();
    const presetFile = formData.get("presetFile");
    const beforeFile = formData.get("beforeImage");
    const afterFile = formData.get("afterImage");
    const name = stringValue(formData.get("name"));
    const description = stringValue(formData.get("description"));
    const creatorName = stringValue(formData.get("creatorName")) || access.email;
    const category = stringValue(formData.get("category"));
    const visibility =
      stringValue(formData.get("visibility")) === "public" ? "public" : "private";
    const tags = stringArray(formData.get("tags"));
    const bestFor = stringArray(formData.get("bestFor"));
    const ownershipConfirmed = stringValue(formData.get("ownershipConfirmed"));

    if (!(presetFile instanceof File) || !presetFile.name.toLowerCase().endsWith(".cube")) {
      return NextResponse.json(
        { error: "Please upload a supported .cube preset file." },
        { status: 400 },
      );
    }
    if (presetFile.size > MAX_PRESET_BYTES) {
      return NextResponse.json(
        { error: "This preset file is too large. Please upload a file under 25 MB." },
        { status: 400 },
      );
    }
    if (!name || !category) {
      return NextResponse.json(
        { error: "Preset name and category are required." },
        { status: 400 },
      );
    }
    if (ownershipConfirmed !== "true") {
      return NextResponse.json(
        { error: "Confirm that you own this preset or have permission to share it." },
        { status: 400 },
      );
    }

    validatePreview(beforeFile instanceof File ? beforeFile : null, "Before");
    validatePreview(afterFile instanceof File ? afterFile : null, "After");

    const cubeText = await presetFile.text();
    const lut = parseCubeLut(cubeText);
    const presetId = randomUUID();
    const lutKey = `presets/${presetId}/preset.cube`;
    const beforeKey = `presets/${presetId}/before.${safeImageExtension(beforeFile as File)}`;
    const afterKey = `presets/${presetId}/after.${safeImageExtension(afterFile as File)}`;

    await Promise.all([
      uploadS3Object({
        key: lutKey,
        body: new Uint8Array(await presetFile.arrayBuffer()),
        contentType: "text/plain",
      }),
      uploadS3Object({
        key: beforeKey,
        body: new Uint8Array(await (beforeFile as File).arrayBuffer()),
        contentType: (beforeFile as File).type || "image/jpeg",
      }),
      uploadS3Object({
        key: afterKey,
        body: new Uint8Array(await (afterFile as File).arrayBuffer()),
        contentType: (afterFile as File).type || "image/jpeg",
      }),
    ]);

    await ensurePresetSchema();
    const row = await queryOne<PresetRow>(
      `
      INSERT INTO presets(
        id, owner_email, name, description, creator_name, category, tags,
        best_for, visibility, status, lut_s3_key, lut_size,
        preview_before_s3_key, preview_after_s3_key, created_at, updated_at
      )
      VALUES(
        $1::uuid, $2, $3, $4, $5, $6, $7::text[], $8::text[], $9,
        'published', $10, $11, $12, $13, now(), now()
      )
      RETURNING *, 0::int AS save_count, false AS is_saved
      `,
      [
        presetId,
        access.email,
        name,
        description || null,
        creatorName,
        category,
        tags,
        bestFor,
        visibility,
        lutKey,
        lut.size,
        beforeKey,
        afterKey,
      ],
    );

    if (!row) throw new Error("Could not create preset");

    return NextResponse.json(
      { preset: await serializePreset(row, access.email) },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error uploading preset:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "We couldn't upload this preset. Please check the file and try again.",
      },
      { status: 500 },
    );
  }
}

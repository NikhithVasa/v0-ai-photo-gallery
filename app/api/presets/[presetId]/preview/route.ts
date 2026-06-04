import { NextResponse } from "next/server";
import { getAuthAccess, unauthorizedResponse } from "@/lib/auth-access";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { applyCubeLutToImage, parseCubeLut } from "@/lib/cube-lut";
import { queryOne } from "@/lib/db";
import { getAccessiblePresetRow, isUuid } from "@/lib/preset-data";
import { ensurePresetSchema } from "@/lib/preset-schema";
import { getS3ObjectBytes } from "@/lib/s3";

export const runtime = "nodejs";

interface Props {
  params: Promise<{ presetId: string }>;
}

function intensityValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 75;
}

export async function POST(request: Request, { params }: Props) {
  try {
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();

    const body = (await request.json()) as {
      albumSlug?: unknown;
      photoId?: unknown;
      intensity?: unknown;
    };
    const albumSlug = typeof body.albumSlug === "string" ? body.albumSlug : "";
    const photoId = typeof body.photoId === "string" ? body.photoId : "";
    const intensity = intensityValue(body.intensity);

    if (!albumSlug || !isUuid(photoId)) {
      return NextResponse.json(
        { error: "Photo and album are required." },
        { status: 400 },
      );
    }

    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;
    await ensurePresetSchema();

    const { presetId } = await params;
    if (!isUuid(presetId)) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    const preset = await getAccessiblePresetRow(presetId, access.email);
    if (!preset) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    const photo = await queryOne<{ original_s3_key: string | null }>(
      `
      SELECT p.original_s3_key
      FROM photos p
      JOIN albums a ON a.id = p.album_id
      WHERE a.slug = $1
        AND p.id = $2::uuid
        AND COALESCE(a.is_deleted, false) = false
        AND COALESCE(p.is_deleted, false) = false
      LIMIT 1
      `,
      [albumSlug, photoId],
    );
    if (!photo?.original_s3_key) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const [sourceImage, lutObject] = await Promise.all([
      getS3ObjectBytes(photo.original_s3_key),
      getS3ObjectBytes(preset.lut_s3_key),
    ]);
    if (!sourceImage || !lutObject) {
      throw new Error("Could not read the photo or preset file.");
    }

    const lut = parseCubeLut(new TextDecoder().decode(lutObject.bytes));
    const preview = await applyCubeLutToImage({
      imageBytes: sourceImage.bytes,
      lut,
      intensity,
      maxDimension: 1400,
    });

    return new Response(preview.bytes, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": preview.contentType,
      },
    });
  } catch (error) {
    console.error("Error generating preset preview:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "We couldn't generate this preview.",
      },
      { status: 500 },
    );
  }
}

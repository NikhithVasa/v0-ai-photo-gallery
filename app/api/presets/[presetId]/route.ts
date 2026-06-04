import { NextResponse } from "next/server";
import {
  getAuthAccess,
  forbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth-access";
import { query } from "@/lib/db";
import {
  getAccessiblePresetRow,
  isUuid,
  serializePreset,
} from "@/lib/preset-data";
import { ensurePresetSchema } from "@/lib/preset-schema";

interface Props {
  params: Promise<{ presetId: string }>;
}

export async function GET(_request: Request, { params }: Props) {
  try {
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();
    await ensurePresetSchema();

    const { presetId } = await params;
    if (!isUuid(presetId)) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    const row = await getAccessiblePresetRow(presetId, access.email);
    if (!row) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    return NextResponse.json({
      preset: await serializePreset(row, access.email),
    });
  } catch (error) {
    console.error("Error loading preset:", error);
    return NextResponse.json(
      { error: "We couldn't load this preset right now." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Props) {
  try {
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();
    await ensurePresetSchema();

    const { presetId } = await params;
    if (!isUuid(presetId)) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    const preset = await getAccessiblePresetRow(presetId, access.email);
    if (!preset) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }
    if (!access.isAdmin && preset.owner_email.toLowerCase() !== access.email.toLowerCase()) {
      return forbiddenResponse();
    }

    await query(`UPDATE presets SET status = 'unpublished', updated_at = now() WHERE id = $1::uuid`, [
      presetId,
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting preset:", error);
    return NextResponse.json({ error: "Could not remove preset" }, { status: 500 });
  }
}

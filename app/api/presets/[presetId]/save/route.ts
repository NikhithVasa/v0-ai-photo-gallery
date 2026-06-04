import { NextResponse } from "next/server";
import { getAuthAccess, unauthorizedResponse } from "@/lib/auth-access";
import { query } from "@/lib/db";
import { getAccessiblePresetRow, isUuid } from "@/lib/preset-data";
import { ensurePresetSchema } from "@/lib/preset-schema";

interface Props {
  params: Promise<{ presetId: string }>;
}

export async function POST(_request: Request, { params }: Props) {
  try {
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();
    await ensurePresetSchema();

    const { presetId } = await params;
    if (!isUuid(presetId)) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    const preset = await getAccessiblePresetRow(presetId, access.email);
    if (!preset || preset.visibility !== "public") {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    await query(
      `
      INSERT INTO preset_saves(preset_id, user_email, created_at)
      VALUES($1::uuid, lower($2), now())
      ON CONFLICT(preset_id, user_email) DO NOTHING
      `,
      [presetId, access.email],
    );
    return NextResponse.json({ ok: true, saved: true });
  } catch (error) {
    console.error("Error saving preset:", error);
    return NextResponse.json({ error: "Could not save preset" }, { status: 500 });
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

    await query(
      `DELETE FROM preset_saves WHERE preset_id = $1::uuid AND lower(user_email) = lower($2)`,
      [presetId, access.email],
    );
    return NextResponse.json({ ok: true, saved: false });
  } catch (error) {
    console.error("Error removing saved preset:", error);
    return NextResponse.json(
      { error: "Could not remove saved preset" },
      { status: 500 },
    );
  }
}

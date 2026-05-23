import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

interface Props {
  params: Promise<{ personId: string }>;
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { personId } = await params;
    const body = await request.json();
    const { displayName } = body;

    if (!displayName || typeof displayName !== "string") {
      return NextResponse.json(
        { error: "displayName is required" },
        { status: 400 }
      );
    }

    // Update display_name
    await query(
      `
      UPDATE people
      SET display_name = $1,
          updated_at = now()
      WHERE id = $2
    `,
      [displayName.trim(), personId]
    );

    // Insert alias
    await query(
      `
      INSERT INTO person_aliases (person_id, alias)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `,
      [personId, displayName.trim().toLowerCase()]
    );

    // Get updated person
    const person = await queryOne<{ id: string; display_name: string }>(
      `SELECT id, display_name FROM people WHERE id = $1`,
      [personId]
    );

    return NextResponse.json({ success: true, person });
  } catch (error) {
    console.error("Error updating person:", error);
    return NextResponse.json(
      { error: "Failed to update person" },
      { status: 500 }
    );
  }
}

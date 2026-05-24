import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

interface Props {
  params: Promise<{ albumSlug: string; personId: string }>;
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { albumSlug, personId } = await params;
    const body = (await request.json()) as { displayName?: unknown };
    const displayName =
      typeof body.displayName === "string" ? body.displayName.trim() : "";

    if (!displayName) {
      return NextResponse.json(
        { error: "displayName is required" },
        { status: 400 }
      );
    }

    const person = await queryOne<{ id: string; display_name: string | null }>(
      `
      UPDATE people pe
      SET display_name = $1
      FROM albums a
      WHERE pe.id = $2
        AND pe.album_id = a.id
        AND a.slug = $3
      RETURNING pe.id, pe.display_name
      `,
      [displayName, personId, albumSlug]
    );

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    try {
      await query(
        `
        INSERT INTO person_aliases (person_id, alias)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [personId, displayName.toLowerCase()]
      );
    } catch (error) {
      console.warn("Could not insert person alias:", error);
    }

    return NextResponse.json({ success: true, person });
  } catch (error) {
    console.error("Error updating album person:", error);
    return NextResponse.json(
      { error: "Failed to update person" },
      { status: 500 }
    );
  }
}

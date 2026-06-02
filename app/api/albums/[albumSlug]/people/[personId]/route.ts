import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";

interface Props {
  params: Promise<{ albumSlug: string; personId: string }>;
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { albumSlug, personId } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

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
      SET display_name = $1,
          updated_at = now()
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
        INSERT INTO person_aliases (album_id, person_id, alias)
        SELECT pe.album_id, pe.id, $2
        FROM people pe
        JOIN albums a ON a.id = pe.album_id
        WHERE pe.id = $1
          AND a.slug = $3
        ON CONFLICT DO NOTHING
        `,
        [personId, displayName.toLowerCase(), albumSlug]
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

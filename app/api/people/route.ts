import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { signedUrl } from "@/lib/s3";

interface PersonRow {
  id: string;
  default_name: string;
  display_name: string | null;
  cover_face_s3_key: string | null;
  face_count: number;
  photo_count: number;
}

export async function GET() {
  try {
    const rows = await query<PersonRow>(`
      SELECT
        id,
        default_name,
        display_name,
        cover_face_s3_key,
        face_count,
        photo_count
      FROM people
      ORDER BY display_name NULLS LAST, default_name
    `);

    const people = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        personNumber: null,
        defaultName: row.default_name,
        displayName: row.display_name,
        photoCount: row.photo_count ?? 0,
        faceCount: row.face_count ?? 0,
        coverFaceUrl: await signedUrl(row.cover_face_s3_key),
      }))
    );

    return NextResponse.json({ people });
  } catch (error) {
    console.error("Error fetching people:", error);
    return NextResponse.json(
      { error: "Failed to fetch people" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { signedUrl } from "@/lib/s3";
import {
  getAuthAccess,
  unauthorizedResponse,
} from "@/lib/auth-access";

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
    const access = await getAuthAccess();
    if (!access) return unauthorizedResponse();

    const rows = await query<PersonRow>(
      `
      SELECT
        p.id,
        p.default_name,
        p.display_name,
        p.cover_face_s3_key,
        p.face_count,
        p.photo_count
      FROM people p
      JOIN albums a
        ON a.id = p.album_id
       AND COALESCE(a.is_deleted, false) = false
      WHERE COALESCE(p.is_hidden, false) = false
        AND (
          $1::boolean = true
          OR a.customer_id = ANY($2::uuid[])
        )
      ORDER BY p.display_name NULLS LAST, p.default_name
      `,
      [access.isAdmin, access.customerIds],
    );

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

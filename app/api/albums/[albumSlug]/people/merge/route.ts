import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { fetchAlbumEvents, toPerson, type PersonRow } from "@/lib/gallery-data";
import { requireAlbumAccess } from "@/lib/album-access";
import { ensurePeopleMergeSchema } from "@/lib/customer-schema";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

function uniqueStrings(values: unknown) {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string"))
  );
}

export async function POST(request: Request, { params }: Props) {
  try {
    await ensurePeopleMergeSchema();
    const { albumSlug } = await params;
    const accessDenied = await requireAlbumAccess(request, albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json()) as {
      targetPersonId?: unknown;
      sourcePersonIds?: unknown;
      coverPersonId?: unknown;
    };
    const targetPersonId =
      typeof body.targetPersonId === "string" ? body.targetPersonId : "";
    const sourcePersonIds = uniqueStrings(body.sourcePersonIds).filter(
      (id) => id !== targetPersonId
    );
    const coverPersonId =
      typeof body.coverPersonId === "string" && body.coverPersonId
        ? body.coverPersonId
        : targetPersonId;

    if (!targetPersonId || !sourcePersonIds.length) {
      return NextResponse.json(
        { error: "targetPersonId and sourcePersonIds are required" },
        { status: 400 }
      );
    }

    const selectedIds = [targetPersonId, ...sourcePersonIds];
    const selectedPeople = await query<{
      id: string;
      album_id: string;
      cover_face_s3_key: string | null;
    }>(
      `
      SELECT pe.id, pe.album_id, pe.cover_face_s3_key
      FROM people pe
      JOIN albums a ON a.id = pe.album_id
      WHERE a.slug = $1
        AND COALESCE(a.is_deleted, false) = false
        AND pe.id = ANY($2::uuid[])
      `,
      [albumSlug, selectedIds]
    );

    if (selectedPeople.length !== selectedIds.length) {
      return NextResponse.json(
        { error: "All selected people must belong to this album" },
        { status: 400 }
      );
    }

    const target = selectedPeople.find((person) => person.id === targetPersonId);
    if (!target) {
      return NextResponse.json({ error: "Target person not found" }, { status: 404 });
    }

    const coverPerson =
      selectedPeople.find((person) => person.id === coverPersonId) ?? target;

    await query(
      `
      DELETE FROM photo_people pp
      WHERE pp.person_id = ANY($3::uuid[])
        AND EXISTS (
          SELECT 1
          FROM photo_people existing
          JOIN photos p ON p.id = existing.photo_id
          JOIN albums a ON a.id = p.album_id
          WHERE existing.photo_id = pp.photo_id
            AND existing.person_id = $2::uuid
            AND a.slug = $1
        )
      `,
      [albumSlug, targetPersonId, sourcePersonIds]
    );

    await query(
      `
      UPDATE photo_people
      SET person_id = $2::uuid
      WHERE person_id = ANY($3::uuid[])
        AND EXISTS (
          SELECT 1
          FROM photos p
          JOIN albums a ON a.id = p.album_id
          WHERE p.id = photo_people.photo_id
            AND a.slug = $1
        )
      `,
      [albumSlug, targetPersonId, sourcePersonIds]
    );

    await query(
      `
      UPDATE people
      SET is_hidden = true,
          merged_into_person_id = $2::uuid,
          merged_at = now(),
          updated_at = now()
      WHERE id = ANY($3::uuid[])
        AND album_id = $1::uuid
      `,
      [target.album_id, targetPersonId, sourcePersonIds]
    );

    await query(
      `
      INSERT INTO person_merge_history(
        album_id,
        target_person_id,
        source_person_id,
        cover_person_id
      )
      SELECT $1::uuid, $2::uuid, source_id, $4::uuid
      FROM unnest($3::uuid[]) AS sources(source_id)
      `,
      [target.album_id, targetPersonId, sourcePersonIds, coverPerson.id]
    );

    const mergedStats = await queryOne<{
      photo_count: number | string | null;
      face_count: number | string | null;
    }>(
      `
      SELECT
        COUNT(DISTINCT photo_id)::int AS photo_count,
        COUNT(*)::int AS face_count
      FROM photo_people
      WHERE person_id = $1::uuid
      `,
      [targetPersonId]
    );

    await queryOne<{ id: string }>(
      `
      UPDATE people
      SET cover_face_s3_key = COALESCE($2, cover_face_s3_key),
          photo_count = $3,
          face_count = $4,
          occurrence_count = $4,
          is_hidden = false,
          merged_into_person_id = NULL,
          merged_at = NULL,
          updated_at = now()
      WHERE id = $1::uuid
      RETURNING id
      `,
      [
        targetPersonId,
        coverPerson.cover_face_s3_key,
        Number(mergedStats?.photo_count ?? 0),
        Number(mergedStats?.face_count ?? 0),
      ]
    );

    try {
      await query(
        `
        DELETE FROM person_event_stats
        WHERE person_id = $1::uuid
        `,
        [targetPersonId]
      );

      await query(
        `
        INSERT INTO person_event_stats(
          person_id,
          album_event_id,
          photo_count,
          face_count,
          created_at,
          updated_at
        )
        SELECT
          $1::uuid,
          pp.album_event_id,
          COUNT(DISTINCT pp.photo_id)::int,
          COUNT(*)::int,
          now(),
          now()
        FROM photo_people pp
        WHERE pp.person_id = $1::uuid
        GROUP BY pp.album_event_id
        `,
        [targetPersonId]
      );
    } catch (statsError) {
      console.warn("Could not rebuild merged person event stats:", statsError);
    }

    const row = await queryOne<PersonRow>(
      `
      SELECT
        pe.id,
        pe.album_id,
        pe.person_number,
        pe.default_name,
        pe.display_name,
        pe.cover_face_s3_key,
        pe.face_count,
        pe.photo_count,
        pe.occurrence_count
      FROM people pe
      WHERE pe.id = $1::uuid
      `,
      [targetPersonId]
    );

    return NextResponse.json({
      person: row ? await toPerson(row) : null,
      events: await fetchAlbumEvents(albumSlug),
    });
  } catch (error) {
    console.error("Error merging people:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to merge people" },
      { status: 500 }
    );
  }
}

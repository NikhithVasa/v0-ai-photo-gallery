import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { fetchAlbumEvents, toPerson, type PersonRow } from "@/lib/gallery-data";
import { requireAlbumAccess } from "@/lib/album-access";
import { ensurePeopleMergeSchema } from "@/lib/customer-schema";
import { requireAdminAccess } from "@/lib/auth-access";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

function uniqueStrings(values: unknown) {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string"))
  );
}

class PeopleMergeError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export async function POST(request: Request, { params }: Props) {
  try {
    await ensurePeopleMergeSchema();
    const admin = await requireAdminAccess();
    if (admin.response) return admin.response;

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
    if (!selectedIds.includes(coverPersonId)) {
      return NextResponse.json(
        { error: "The cover face must be one of the selected people" },
        { status: 400 }
      );
    }

    const mergedRow = await withTransaction(async (client) => {
      const { rows: selectedPeople } = await client.query<{
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
        FOR UPDATE OF pe
        `,
        [albumSlug, selectedIds]
      );

      if (selectedPeople.length !== selectedIds.length) {
        throw new PeopleMergeError(
          "All selected people must belong to this album"
        );
      }

      const target = selectedPeople.find(
        (person) => person.id === targetPersonId
      );
      if (!target) {
        throw new PeopleMergeError("Target person not found", 404);
      }

      const coverPerson =
        selectedPeople.find((person) => person.id === coverPersonId) ?? target;

      await client.query(
        `
        WITH scoped_faces AS (
          SELECT
            pp.ctid AS row_id,
            row_number() OVER (
              PARTITION BY pp.photo_id
              ORDER BY
                CASE WHEN pp.person_id = $2::uuid THEN 0 ELSE 1 END,
                pp.person_id::text
            ) AS keep_rank
          FROM photo_people pp
          JOIN photos p ON p.id = pp.photo_id
          JOIN albums a ON a.id = p.album_id
          WHERE a.slug = $1
            AND COALESCE(a.is_deleted, false) = false
            AND (
              pp.person_id = $2::uuid
              OR pp.person_id = ANY($3::uuid[])
            )
        )
        DELETE FROM photo_people pp
        USING scoped_faces sf
        WHERE pp.ctid = sf.row_id
          AND sf.keep_rank > 1
        `,
        [albumSlug, targetPersonId, sourcePersonIds]
      );

      await client.query(
        `
        UPDATE photo_people pp
        SET person_id = $2::uuid
        FROM photos p
        JOIN albums a ON a.id = p.album_id
        WHERE p.id = pp.photo_id
          AND a.slug = $1
          AND pp.person_id = ANY($3::uuid[])
        `,
        [albumSlug, targetPersonId, sourcePersonIds]
      );

      await client.query(
        `
        UPDATE people
        SET is_hidden = true,
            merged_into_person_id = $2::uuid,
            merged_at = now(),
            photo_count = 0,
            face_count = 0,
            occurrence_count = 0,
            updated_at = now()
        WHERE id = ANY($3::uuid[])
          AND album_id = $1::uuid
        `,
        [target.album_id, targetPersonId, sourcePersonIds]
      );

      await client.query(
        `
        DELETE FROM person_event_stats
        WHERE person_id = $1::uuid
           OR person_id = ANY($2::uuid[])
        `,
        [targetPersonId, sourcePersonIds]
      );

      await client.query(
        `
        INSERT INTO person_event_stats(
          person_id,
          album_event_id,
          photo_count,
          face_count
        )
        SELECT
          $1::uuid,
          pp.album_event_id,
          COUNT(DISTINCT pp.photo_id)::int,
          COUNT(*)::int
        FROM photo_people pp
        WHERE pp.person_id = $1::uuid
        GROUP BY pp.album_event_id
        `,
        [targetPersonId]
      );

      const {
        rows: [mergedStats],
      } = await client.query<{
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

      const photoCount = Number(mergedStats?.photo_count ?? 0);
      const faceCount = Number(mergedStats?.face_count ?? 0);

      await client.query(
        `
        UPDATE people
        SET cover_face_s3_key = COALESCE($2::text, cover_face_s3_key),
            photo_count = $3,
            face_count = $4,
            occurrence_count = $4,
            is_hidden = false,
            merged_into_person_id = NULL,
            merged_at = NULL,
            updated_at = now()
        WHERE id = $1::uuid
        `,
        [targetPersonId, coverPerson.cover_face_s3_key, photoCount, faceCount]
      );

      await client.query(
        `
        INSERT INTO person_merge_history(
          album_id,
          target_person_id,
          source_person_id,
          cover_person_id,
          cover_face_s3_key,
          merged_photo_count,
          merged_face_count
        )
        SELECT
          $1::uuid,
          $2::uuid,
          source_id,
          $4::uuid,
          $5::text,
          $6::int,
          $7::int
        FROM unnest($3::uuid[]) AS sources(source_id)
        `,
        [
          target.album_id,
          targetPersonId,
          sourcePersonIds,
          coverPerson.id,
          coverPerson.cover_face_s3_key,
          photoCount,
          faceCount,
        ]
      );

      const {
        rows: [row],
      } = await client.query<PersonRow>(
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

      return row ?? null;
    });

    return NextResponse.json({
      person: mergedRow ? await toPerson(mergedRow) : null,
      events: await fetchAlbumEvents(albumSlug),
    });
  } catch (error) {
    console.error("Error merging people:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to merge people" },
      { status: error instanceof PeopleMergeError ? error.status : 500 }
    );
  }
}

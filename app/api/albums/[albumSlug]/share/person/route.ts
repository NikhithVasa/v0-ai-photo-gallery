import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { customerPublicUrl } from "@/lib/customer-host";
import { DEFAULT_SHARE_BACKGROUND_COLOR } from "@/lib/share-theme";

interface Props {
  params: Promise<{ albumSlug: string }>;
}

interface AlbumRow {
  id: string;
  name: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_slug: string | null;
}

interface PersonRow {
  id: string;
}

function textField(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim().slice(0, 120);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function shareUrl(request: Request, token: string, customerSlug: string | null) {
  if (customerSlug) {
    return `${customerPublicUrl(customerSlug)}/share/${encodeURIComponent(token)}`;
  }
  return `${new URL(request.url).origin}/share/${encodeURIComponent(token)}`;
}

export async function POST(request: Request, { params }: Props) {
  try {
    await ensureAlbumShareLinkSchema();

    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json().catch(() => ({}))) as {
      personId?: unknown;
      personName?: unknown;
      linkName?: unknown;
      onlyPerson?: unknown;
    };
    const personId = textField(body.personId, "Person");
    const personName = textField(body.personName, "Person name");
    const linkName = textField(body.linkName, "Shared link name");
    if (!isUuid(personId)) {
      return NextResponse.json({ error: "Person is invalid" }, { status: 400 });
    }

    const album = await queryOne<AlbumRow>(
      `
      SELECT
        a.id,
        a.name,
        a.customer_id,
        c.name AS customer_name,
        c.slug AS customer_slug
      FROM albums a
      LEFT JOIN customers c
        ON c.id = a.customer_id
       AND COALESCE(c.is_deleted, false) = false
      WHERE lower(a.slug) = lower($1)
        AND COALESCE(a.is_deleted, false) = false
      LIMIT 1
      `,
      [albumSlug],
    );

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const person = await queryOne<PersonRow>(
      `
      SELECT id
      FROM people
      WHERE id = $1::uuid
        AND album_id = $2::uuid
        AND COALESCE(is_hidden, false) = false
      LIMIT 1
      `,
      [personId, album.id],
    );

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const token = randomUUID().replace(/-/g, "");
    const share = await queryOne<{ token: string }>(
      `
      INSERT INTO album_share_links (
        id,
        token,
        album_id,
        customer_id,
        album_name,
        customer_name,
        allow_downloads,
        watermark_enabled,
        watermark_text,
        watermark_mode,
        watermark_positions,
        background_color,
        person_id,
        person_name,
        link_name,
        only_person,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        false,
        false,
        $6,
        'corners',
        ARRAY['bottom_right']::text[],
        $7,
        $8::uuid,
        $9,
        $10,
        $11,
        now(),
        now()
      )
      RETURNING token
      `,
      [
        randomUUID(),
        token,
        album.id,
        album.customer_id,
        album.name,
        album.customer_name,
        DEFAULT_SHARE_BACKGROUND_COLOR,
        person.id,
        personName,
        linkName,
        Boolean(body.onlyPerson),
      ],
    );

    if (!share) {
      return NextResponse.json(
        { error: "Failed to create person share link" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      share: {
        token: share.token,
        url: shareUrl(request, share.token, album.customer_slug),
        personId: person.id,
        personName,
        linkName,
        onlyPerson: Boolean(body.onlyPerson),
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.endsWith("is required")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Error creating person share link:", error);
    return NextResponse.json(
      { error: "Failed to create person share link" },
      { status: 500 },
    );
  }
}

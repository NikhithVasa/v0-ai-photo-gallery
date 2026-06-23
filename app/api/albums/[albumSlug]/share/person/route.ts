import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";
import { customerPublicUrl } from "@/lib/customer-host";
import {
  DEFAULT_SHARE_BACKGROUND_COLOR,
  isShareBackgroundColor,
  normalizeShareBackgroundColor,
} from "@/lib/share-theme";

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

function expirationDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Expiration date is invalid");
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Expiration date is invalid");
  }

  return value;
}

function passcodeValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Passcode is invalid");

  const passcode = value.trim();
  if (!passcode) return null;
  if (passcode.length < 4) {
    throw new Error("Passcode must be at least 4 characters");
  }
  return passcode.slice(0, 64);
}

export async function POST(request: Request, { params }: Props) {
  try {
    await ensureAlbumShareLinkSchema();

    const { albumSlug } = await params;
    const accessDenied = await requireAlbumCustomerAccess(albumSlug);
    if (accessDenied) return accessDenied;

    const body = (await request.json().catch(() => ({}))) as {
      personId?: unknown;
      personIds?: unknown;
      personName?: unknown;
      linkName?: unknown;
      onlyPerson?: unknown;
      allowDownloads?: unknown;
      watermarkEnabled?: unknown;
      allowEventTabs?: unknown;
      backgroundColor?: unknown;
      passcode?: unknown;
      expiresAt?: unknown;
    };
    const rawPersonIds = Array.isArray(body.personIds)
      ? body.personIds
      : body.personId !== undefined
        ? [body.personId]
        : [];
    const personIds = Array.from(
      new Set(
        rawPersonIds
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    );
    if (!personIds.length) {
      return NextResponse.json({ error: "Person is required" }, { status: 400 });
    }
    if (!personIds.every((id) => isUuid(id))) {
      return NextResponse.json({ error: "Person is invalid" }, { status: 400 });
    }
    const personName = textField(body.personName, "Person name");
    const linkName = textField(body.linkName, "Shared link name");
    if (!isShareBackgroundColor(body.backgroundColor)) {
      return NextResponse.json(
        { error: "Background color is invalid" },
        { status: 400 },
      );
    }
    const backgroundColor = normalizeShareBackgroundColor(body.backgroundColor);
    const passcode = passcodeValue(body.passcode);
    const expiresAt = expirationDate(body.expiresAt);

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

    const matchedPeople = await query<PersonRow>(
      `
      SELECT id
      FROM people
      WHERE id = ANY($1::uuid[])
        AND album_id = $2::uuid
        AND COALESCE(is_hidden, false) = false
      `,
      [personIds, album.id],
    );

    if (matchedPeople.length !== personIds.length) {
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
        expires_at,
        passcode,
        person_id,
        person_ids,
        person_name,
        link_name,
        only_person,
        allow_event_tabs,
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
        $7,
        $8,
        COALESCE($6, $5),
        'corners',
        ARRAY['bottom_right']::text[],
        $9,
        $10::date,
        $11,
        $12::uuid,
        $13::uuid[],
        $14,
        $15,
        $16,
        $17,
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
        Boolean(body.allowDownloads),
        Boolean(body.watermarkEnabled),
        backgroundColor || DEFAULT_SHARE_BACKGROUND_COLOR,
        expiresAt,
        passcode,
        personIds[0],
        personIds,
        personName,
        linkName,
        Boolean(body.onlyPerson),
        Boolean(body.allowEventTabs),
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
        personId: personIds[0],
        personIds,
        personName,
        linkName,
        onlyPerson: Boolean(body.onlyPerson),
        allowDownloads: Boolean(body.allowDownloads),
        watermarkEnabled: Boolean(body.watermarkEnabled),
        allowEventTabs: Boolean(body.allowEventTabs),
        backgroundColor,
        expiresAt,
        passcode,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.endsWith("is required") ||
        error.message.startsWith("Passcode") ||
        error.message.startsWith("Expiration date"))
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

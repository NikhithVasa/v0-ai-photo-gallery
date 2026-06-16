import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAlbumCustomerAccess } from "@/lib/auth-access";

const DEFAULT_AI_WORKER_LAMBDA_URL =
  "https://ytwjenx44g62fzjrrb2wdad6gi0pnbrt.lambda-url.us-east-1.on.aws/";

interface StartAiWorkerBody {
  albumId?: unknown;
  eventId?: unknown;
  mode?: unknown;
}

interface AlbumAccessRow {
  slug: string;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function aiWorkerAdminKey() {
  return (
    process.env.ADMIN_KEY ||
    process.env.AI_WORKER_ADMIN_KEY ||
    process.env.RUNPOD_ADMIN_KEY ||
    ""
  ).trim();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StartAiWorkerBody;
    const albumId = isUuid(body.albumId) ? body.albumId : "";
    const eventId = isUuid(body.eventId) ? body.eventId : "";
    const mode =
      typeof body.mode === "string" && body.mode.trim()
        ? body.mode.trim()
        : "new_photos_only";

    const requiresEventId = mode !== "full_album_reset";

    if (!albumId || (requiresEventId && !eventId)) {
      return NextResponse.json(
        { error: requiresEventId ? "albumId and eventId are required" : "albumId is required" },
        { status: 400 },
      );
    }

    const album = await queryOne<AlbumAccessRow>(
      `
      SELECT a.slug
      FROM albums a
      WHERE a.id = $1::uuid
        AND COALESCE(a.is_deleted, false) = false
      LIMIT 1
      `,
      [albumId],
    );

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    if (requiresEventId) {
      const event = await queryOne<{ exists: boolean }>(
        `
        SELECT EXISTS (
          SELECT 1
          FROM album_events e
          WHERE e.id = $2::uuid
            AND e.album_id = $1::uuid
            AND COALESCE(e.is_deleted, false) = false
        ) AS exists
        `,
        [albumId, eventId],
      );

      if (!event?.exists) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
    }

    const accessDenied = await requireAlbumCustomerAccess(album.slug);
    if (accessDenied) return accessDenied;

    const adminKey = aiWorkerAdminKey();
    if (!adminKey) {
      return NextResponse.json(
        { error: "AI worker admin key is not configured" },
        { status: 500 },
      );
    }

    const lambdaUrl =
      process.env.AI_WORKER_LAMBDA_URL?.trim() || DEFAULT_AI_WORKER_LAMBDA_URL;
    const response = await fetch(lambdaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify({
        albumId,
        eventId: eventId || null,
        mode,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!response.ok || payload.ok === false) {
      return NextResponse.json(
        {
          error:
            typeof payload.error === "string"
              ? payload.error
              : "AI worker failed to start",
        },
        { status: response.ok ? 502 : response.status },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error starting AI worker:", error);
    return NextResponse.json(
      { error: "AI worker failed to start" },
      { status: 500 },
    );
  }
}

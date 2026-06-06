import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { query, queryOne } from "@/lib/db";
import { ensureAlbumShareLinkSchema } from "@/lib/customer-schema";

let authAccessSchemaPromise: Promise<void> | null = null;

export interface AuthAccess {
  email: string;
  isAdmin: boolean;
  customerIds: string[];
}

interface CustomerAccessRow {
  id: string;
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

function configuredAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

export function ensureAuthAccessSchema() {
  authAccessSchemaPromise ??= (async () => {
    await query(
      `
      ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS company_name text,
        ADD COLUMN IF NOT EXISTS created_by_email text
      `,
      [],
    );

    await query(
      `
      UPDATE customers
      SET company_name = COALESCE(company_name, name)
      WHERE company_name IS NULL
      `,
      [],
    );

    await query(
      `
      CREATE TABLE IF NOT EXISTS admin_emails (
        email text PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now()
      )
      `,
      [],
    );

    await query(
      `
      CREATE TABLE IF NOT EXISTS customer_users (
        id uuid PRIMARY KEY,
        customer_id uuid NOT NULL,
        email text NOT NULL,
        role text NOT NULL DEFAULT 'member',
        added_by text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
      `,
      [],
    );

    await query(
      `
      CREATE UNIQUE INDEX IF NOT EXISTS customer_users_customer_email_idx
      ON customer_users (customer_id, lower(email))
      `,
      [],
    );

    await query(
      `
      CREATE INDEX IF NOT EXISTS customer_users_email_idx
      ON customer_users (lower(email))
      `,
      [],
    );

    await query(
      `
      ALTER TABLE album_events
        ADD COLUMN IF NOT EXISTS customer_id uuid
      `,
      [],
    );

    await query(
      `
      UPDATE album_events e
      SET customer_id = a.customer_id
      FROM albums a
      WHERE a.id = e.album_id
        AND e.customer_id IS NULL
        AND a.customer_id IS NOT NULL
      `,
      [],
    );

    await query(
      `
      CREATE INDEX IF NOT EXISTS album_events_customer_id_idx
      ON album_events (customer_id)
      `,
      [],
    );

    await query(
      `
      INSERT INTO customer_users(id, customer_id, email, role, added_by, created_at)
      SELECT
        (
          substr(md5(c.id::text || ':' || lower(c.email)), 1, 8) || '-' ||
          substr(md5(c.id::text || ':' || lower(c.email)), 9, 4) || '-' ||
          substr(md5(c.id::text || ':' || lower(c.email)), 13, 4) || '-' ||
          substr(md5(c.id::text || ':' || lower(c.email)), 17, 4) || '-' ||
          substr(md5(c.id::text || ':' || lower(c.email)), 21, 12)
        )::uuid,
        c.id,
        lower(c.email),
        'owner',
        c.created_by_email,
        now()
      FROM customers c
      WHERE c.email IS NOT NULL
        AND btrim(c.email) <> ''
      ON CONFLICT DO NOTHING
      `,
      [],
    );
  })();

  return authAccessSchemaPromise;
}

async function getSupabaseEmail() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return "";
  }

  const cookieStore = await cookies();
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server components cannot always persist refreshed cookies.
          }
        },
      },
    },
  );

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user?.email) {
      return normalizeEmail(user.email);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return normalizeEmail(user?.email);
}

async function isAdminEmail(email: string) {
  if (!email) return false;
  if (configuredAdminEmails().has(email)) return true;

  const row = await queryOne<{ email: string }>(
    `
    SELECT email
    FROM admin_emails
    WHERE lower(email) = lower($1)
    LIMIT 1
    `,
    [email],
  );

  return Boolean(row);
}

export async function getAuthAccess(): Promise<AuthAccess | null> {
  const email = await getSupabaseEmail();
  if (!email) return null;

  await ensureAuthAccessSchema();

  const isAdmin = await isAdminEmail(email);
  if (isAdmin) {
    return { email, isAdmin: true, customerIds: [] };
  }

  const rows = await query<CustomerAccessRow>(
    `
    SELECT DISTINCT c.id
    FROM customer_users cu
    JOIN customers c
      ON c.id = cu.customer_id
     AND COALESCE(c.is_deleted, false) = false
    WHERE lower(cu.email) = lower($1)
    `,
    [email],
  );

  return {
    email,
    isAdmin: false,
    customerIds: rows.map((row) => row.id),
  };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

export function forbiddenResponse() {
  return NextResponse.json({ error: "Access denied" }, { status: 403 });
}

export async function requireAdminAccess() {
  const access = await getAuthAccess();
  if (!access) return { access: null, response: unauthorizedResponse() };
  if (!access.isAdmin) return { access, response: forbiddenResponse() };
  return { access, response: null };
}

export function customerScopeSql(access: AuthAccess, alias = "a") {
  if (access.isAdmin) return "TRUE";
  return `${alias}.customer_id = ANY($1::uuid[])`;
}

export function customerScopeParams(access: AuthAccess) {
  return access.isAdmin ? [] : [access.customerIds];
}

function shortToken(value: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}

export function shareTokenFromRequest(request: Request) {
  const url = new URL(request.url);
  const directToken = url.searchParams.get("share");
  if (directToken) {
    console.info("[share-debug] token from query", {
      path: url.pathname,
      token: shortToken(directToken),
    });
    return directToken;
  }

  const referrer = request.headers.get("referer");
  if (!referrer) {
    console.info("[share-debug] no share token", {
      path: url.pathname,
    });
    return "";
  }

  try {
    const referrerToken = new URL(referrer).searchParams.get("share") || "";
    console.info("[share-debug] token from referrer", {
      path: url.pathname,
      token: shortToken(referrerToken),
      hasToken: Boolean(referrerToken),
    });
    return referrerToken;
  } catch {
    console.warn("[share-debug] invalid referrer while reading share token", {
      path: url.pathname,
      referrer,
    });
    return "";
  }
}

export async function canAccessAlbumByShareToken(
  request: Request,
  albumSlug: string,
) {
  const token = shareTokenFromRequest(request);
  if (!token) return false;

  console.info("[share-debug] checking album share access", {
    albumSlug,
    token: shortToken(token),
  });

  await ensureAlbumShareLinkSchema().catch((error) => {
    console.error("[share-debug] share token schema check failed", {
      albumSlug,
      token: shortToken(token),
      error,
    });
  });

  const row = await queryOne<{ id: string }>(
    `
    SELECT a.id
    FROM album_share_links s
    JOIN albums a
      ON a.id = s.album_id
     AND COALESCE(a.is_deleted, false) = false
    WHERE s.token = $1
      AND lower(a.slug) = lower($2)
      AND (s.expires_at IS NULL OR s.expires_at >= CURRENT_DATE)
    LIMIT 1
    `,
    [token, albumSlug],
  ).catch((error) => {
    console.error("[share-debug] share token access query failed", {
      albumSlug,
      token: shortToken(token),
      error,
    });
    return null;
  });

  console.info("[share-debug] album share access result", {
    albumSlug,
    token: shortToken(token),
    allowed: Boolean(row),
  });

  return Boolean(row);
}

export async function requireCustomerAccessBySlug(
  _request: Request,
  customerSlug: string,
) {
  const access = await getAuthAccess();
  if (!access) return unauthorizedResponse();
  if (access.isAdmin) return null;

  const row = await queryOne<{ id: string }>(
    `
    SELECT id
    FROM customers
    WHERE slug = $1
      AND id = ANY($2::uuid[])
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
    `,
    [customerSlug, access.customerIds],
  );

  return row ? null : NextResponse.json({ error: "Customer not found" }, { status: 404 });
}

export async function requireAlbumCustomerAccess(albumSlug: string) {
  const access = await getAuthAccess();
  if (!access) return unauthorizedResponse();
  if (access.isAdmin) return null;

  const row = await queryOne<{ id: string }>(
    `
    SELECT a.id
    FROM albums a
    JOIN customers c
      ON c.id = a.customer_id
     AND COALESCE(c.is_deleted, false) = false
    WHERE lower(a.slug) = lower($1)
      AND a.customer_id = ANY($2::uuid[])
      AND COALESCE(a.is_deleted, false) = false
    LIMIT 1
    `,
    [albumSlug, access.customerIds],
  );

  return row ? null : NextResponse.json({ error: "Access denied" }, { status: 403 });
}

export async function requirePhotoIdsAccess(photoIds: string[]) {
  const access = await getAuthAccess();
  if (!access) return unauthorizedResponse();
  if (access.isAdmin) return null;

  const row = await queryOne<{ allowed_count: number | string | null }>(
    `
    SELECT COUNT(DISTINCT p.id)::int AS allowed_count
    FROM photos p
    JOIN albums a
      ON a.id = p.album_id
     AND COALESCE(a.is_deleted, false) = false
    WHERE p.id = ANY($1::uuid[])
      AND a.customer_id = ANY($2::uuid[])
      AND COALESCE(p.is_deleted, false) = false
    `,
    [photoIds, access.customerIds],
  );

  const allowedCount =
    typeof row?.allowed_count === "number"
      ? row.allowed_count
      : Number.parseInt(String(row?.allowed_count ?? "0"), 10) || 0;

  return allowedCount === photoIds.length
    ? null
    : NextResponse.json({ error: "Access denied" }, { status: 403 });
}

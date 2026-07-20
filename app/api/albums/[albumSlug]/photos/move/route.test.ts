import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthAccess: vi.fn(),
  forbiddenResponse: vi.fn(() => Response.json({ error: "Forbidden" }, { status: 403 })),
  unauthorizedResponse: vi.fn(() => Response.json({ error: "Unauthorized" }, { status: 401 })),
  query: vi.fn(),
  queryOne: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("@/lib/auth-access", () => ({
  getAuthAccess: mocks.getAuthAccess,
  forbiddenResponse: mocks.forbiddenResponse,
  unauthorizedResponse: mocks.unauthorizedResponse,
}));
vi.mock("@/lib/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  withTransaction: mocks.withTransaction,
}));

import { GET, POST } from "./route";

const PHOTO_ONE = "11111111-1111-4111-8111-111111111111";
const PHOTO_TWO = "22222222-2222-4222-8222-222222222222";
const SOURCE = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  slug: "source",
  name: "Source",
  customer_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
};
const TARGET = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  slug: "target",
  name: "Target",
  customer_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
};
const SOURCE_EVENT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const TARGET_EVENT = {
  id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  slug: "reception",
  name: "Reception",
};

const member = {
  email: "member@example.com",
  isAdmin: false,
  customerIds: [SOURCE.customer_id],
};
const owner = {
  email: "owner@example.com",
  isAdmin: false,
  customerIds: [SOURCE.customer_id, TARGET.customer_id],
};
const admin = { email: "admin@example.com", isAdmin: true, customerIds: [] };

function context(albumSlug = SOURCE.slug) {
  return { params: Promise.resolve({ albumSlug }) };
}

function moveRequest(body: unknown) {
  return new Request("http://localhost/api/albums/source/photos/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function existingBody(photoIds = [PHOTO_ONE]) {
  return {
    photoIds,
    destination: { kind: "existing", albumSlug: TARGET.slug, eventSlug: TARGET_EVENT.slug },
  };
}

type QueryResult = { rows: unknown[] };
type QueryCall = { sql: string; params: unknown[] };

function transactionClient(
  resolve: (sql: string, params: unknown[]) => QueryResult | Promise<QueryResult>,
) {
  const calls: QueryCall[] = [];
  const client = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      return resolve(sql, params);
    }),
  };
  mocks.withTransaction.mockImplementation(async (callback: (value: typeof client) => unknown) => callback(client));
  return { client, calls };
}

function standardTransaction(options: {
  selected?: Array<Record<string, unknown>>;
  destinationAlbum?: typeof SOURCE | typeof TARGET;
  destinationEvent?: typeof TARGET_EVENT;
  ownedCustomerIds?: string[];
  columns?: Record<string, string[]>;
} = {}) {
  const selected = options.selected ?? [
    {
      id: PHOTO_ONE,
      album_event_id: SOURCE_EVENT,
      original_s3_key: "original/key.jpg",
      source_s3_key: "source/key.jpg",
      ai_input_s3_key: null,
      clean_preview_s3_key: "preview/key.jpg",
      watermarked_preview_s3_key: null,
      thumbnail_s3_key: "thumb/key.jpg",
      annotated_s3_key: null,
    },
  ];
  const destinationAlbum = options.destinationAlbum ?? TARGET;
  const destinationEvent = options.destinationEvent ?? TARGET_EVENT;
  const columns = options.columns ?? {};

  return transactionClient((sql, params) => {
    if (sql.includes("FROM albums WHERE id = $1::uuid")) return { rows: [SOURCE] };
    if (sql.includes("FROM customer_users cu")) {
      return { rows: (options.ownedCustomerIds ?? [SOURCE.customer_id, TARGET.customer_id]).map((customer_id) => ({ customer_id })) };
    }
    if (sql.includes("FROM photos") && sql.includes("FOR UPDATE")) return { rows: selected };
    if (sql.includes("FROM albums") && sql.includes("lower(slug) = lower($1)") && sql.includes("FOR UPDATE")) {
      return { rows: [destinationAlbum] };
    }
    if (sql.includes("FROM album_events") && sql.includes("FOR UPDATE")) return { rows: [destinationEvent] };
    if (sql.includes("information_schema.columns")) {
      const table = String(params[0]);
      return { rows: (columns[table] ?? []).map((column_name) => ({ column_name })) };
    }
    if (sql.includes("SELECT DISTINCT person_id FROM photo_people")) return { rows: [] };
    if (sql.includes("DELETE FROM photo_similarity_cluster_items")) return { rows: [] };
    return { rows: [] };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthAccess.mockResolvedValue(member);
  mocks.queryOne.mockResolvedValue(SOURCE);
  mocks.query.mockResolvedValue([]);
});

describe("photo move request validation", () => {
  it.each([
    { name: "empty photo set", body: existingBody([]) },
    {
      name: "more than 500 photos",
      body: existingBody(
        Array.from(
          { length: 501 },
          (_, index) => `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
        ),
      ),
    },
    { name: "non-UUID photo", body: existingBody(["photo-1"]) },
    { name: "case-insensitive duplicate UUID", body: existingBody([PHOTO_ONE, PHOTO_ONE.toUpperCase()]) },
    { name: "unexpected top-level field", body: { ...existingBody(), extra: true } },
    { name: "missing destination", body: { photoIds: [PHOTO_ONE] } },
    {
      name: "mixed existing/new destination fields",
      body: {
        photoIds: [PHOTO_ONE],
        destination: { kind: "existing", albumSlug: "target", eventSlug: "reception", albumName: "Nope" },
      },
    },
    {
      name: "blank new destination name",
      body: { photoIds: [PHOTO_ONE], destination: { kind: "new", albumName: " ", eventName: "Reception" } },
    },
  ])("rejects $name before opening a transaction", async ({ body }) => {
    const response = await POST(moveRequest(body), context());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid move request" });
    expect(mocks.withTransaction).not.toHaveBeenCalled();
  });
});

describe("photo move destination visibility", () => {
  it("returns 401 before reading an album for an unauthenticated request", async () => {
    mocks.getAuthAccess.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), context());

    expect(response.status).toBe(401);
    expect(mocks.queryOne).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "member",
      access: member,
      ownerRows: [],
      expectedParams: [SOURCE.id, false, false, []],
      canCreate: false,
    },
    {
      name: "owner",
      access: owner,
      ownerRows: [{ customer_id: SOURCE.customer_id }, { customer_id: TARGET.customer_id }],
      expectedParams: [SOURCE.id, false, true, [SOURCE.customer_id, TARGET.customer_id]],
      canCreate: true,
    },
    {
      name: "admin",
      access: admin,
      ownerRows: [],
      expectedParams: [SOURCE.id, true, true, []],
      canCreate: true,
    },
  ])("scopes $name destinations at the database boundary", async ({ access, ownerRows, expectedParams, canCreate }) => {
    mocks.getAuthAccess.mockResolvedValue(access);
    mocks.query
      .mockResolvedValueOnce(ownerRows)
      .mockResolvedValueOnce([{ id: SOURCE.id, slug: SOURCE.slug, name: SOURCE.name, events: [] }]);
    if (access.isAdmin) {
      mocks.query.mockReset();
      mocks.query.mockResolvedValueOnce([{ id: SOURCE.id, slug: SOURCE.slug, name: SOURCE.name, events: [] }]);
    }

    const response = await GET(new Request("http://localhost"), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      destinations: [{ id: SOURCE.id, slug: SOURCE.slug, name: SOURCE.name, events: [] }],
      canCreate,
    });
    const destinationCall = mocks.query.mock.calls.find(([sql]) => String(sql).includes("FROM albums a"));
    expect(destinationCall?.[1]).toEqual(expectedParams);
  });
});

describe("photo move transaction behavior", () => {
  it("rejects a cross-album destination when the member is not owner of both customers", async () => {
    mocks.getAuthAccess.mockResolvedValue(owner);
    standardTransaction({ ownedCustomerIds: [SOURCE.customer_id] });

    const response = await POST(moveRequest(existingBody()), context());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Owner access is required for cross-album moves" });
  });

  it("returns 409 for a partial selected set before resolving or mutating the destination", async () => {
    const { calls } = standardTransaction({ selected: [] });

    const response = await POST(moveRequest(existingBody([PHOTO_ONE, PHOTO_TWO])), context());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "One or more photos are unavailable in the source album" });
    expect(calls.some(({ sql }) => sql.startsWith("UPDATE ") || sql.startsWith("DELETE ") || sql.startsWith("INSERT "))).toBe(false);
    expect(calls.some(({ sql }) => sql.includes("lower(slug) = lower($1)"))).toBe(false);
  });

  it("treats moving a photo to its current event as an idempotent success", async () => {
    const { calls } = standardTransaction({
      destinationAlbum: SOURCE,
      selected: [{ id: PHOTO_ONE, album_event_id: TARGET_EVENT.id }],
    });

    const response = await POST(moveRequest(existingBody()), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      destination: { album: { id: SOURCE.id, slug: SOURCE.slug, name: SOURCE.name }, event: TARGET_EVENT, created: false },
      movedPhotoIds: [],
      movedCount: 0,
    });
    expect(calls.some(({ sql }) => sql.startsWith("UPDATE ") || sql.startsWith("DELETE ") || sql.startsWith("INSERT "))).toBe(false);
  });

  it("keeps same-album moves compatible by updating event membership without changing album identity", async () => {
    const { calls } = standardTransaction({ destinationAlbum: SOURCE });

    const response = await POST(moveRequest(existingBody()), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ movedPhotoIds: [PHOTO_ONE], movedCount: 1 });
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ params: [[PHOTO_ONE], TARGET_EVENT.id] }),
      expect.objectContaining({ params: [[PHOTO_ONE], TARGET_EVENT.id] }),
    ]));
    const photoUpdate = calls.find(({ sql }) => sql.startsWith("UPDATE photos SET album_event_id"));
    expect(photoUpdate?.params).toEqual([[PHOTO_ONE], TARGET_EVENT.id]);
    expect(calls.some(({ sql }) => sql.startsWith("UPDATE photos SET album_id"))).toBe(false);
  });

  it("moves across albums while preserving media keys and taking dependency cleanup paths", async () => {
    mocks.getAuthAccess.mockResolvedValue(owner);
    const { calls } = standardTransaction({
      columns: {
        photo_sort_positions: ["photo_id"],
        photo_similarity_cluster_items: ["photo_id"],
        photo_relationships: ["source_photo_id", "target_photo_id"],
        preset_applications: ["source_photo_id", "edited_photo_id"],
        faces: ["photo_id"],
        photo_edits: ["photo_id", "updated_at"],
        processing_jobs: ["photo_id"],
        photos: ["custom_sort_order", "face_index_status", "updated_at"],
      },
    });

    const response = await POST(moveRequest(existingBody()), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ movedPhotoIds: [PHOTO_ONE], movedCount: 1 });
    const photoUpdate = calls.find(({ sql }) => sql.startsWith("UPDATE photos SET album_id"));
    expect(photoUpdate?.params).toEqual([[PHOTO_ONE], TARGET.id, TARGET_EVENT.id]);
    expect(photoUpdate?.sql).not.toMatch(/(?:original|source|preview|thumbnail|annotated)_s3_key\s*=/);
    expect(calls.some(({ sql }) => sql.startsWith("DELETE FROM photo_sort_positions"))).toBe(true);
    expect(calls.some(({ sql }) => sql.startsWith("DELETE FROM photo_relationships"))).toBe(true);
    expect(calls.some(({ sql }) => sql.startsWith("DELETE FROM photo_people"))).toBe(true);
    expect(calls.some(({ sql }) => sql.startsWith("UPDATE processing_jobs"))).toBe(true);
    expect(calls.some(({ sql }) => sql.startsWith("INSERT INTO processing_jobs"))).toBe(true);
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ params: [SOURCE.id, ["original/key.jpg", "source/key.jpg", "preview/key.jpg", "thumb/key.jpg"]] }),
    ]));
  });

  it("creates a trimmed destination and returns the slug allocated after a collision", async () => {
    mocks.getAuthAccess.mockResolvedValue(owner);
    let albumInsertAttempts = 0;
    const allocated = { ...TARGET, slug: "new-album-collision" };
    const { calls } = transactionClient((sql, params) => {
      if (sql.includes("FROM albums WHERE id = $1::uuid")) return { rows: [SOURCE] };
      if (sql.includes("FROM customer_users cu")) return { rows: [{ customer_id: SOURCE.customer_id }] };
      if (sql.includes("FROM photos") && sql.includes("FOR UPDATE")) {
        return { rows: [{ id: PHOTO_ONE, album_event_id: SOURCE_EVENT }] };
      }
      if (sql.includes("INSERT INTO albums")) {
        albumInsertAttempts += 1;
        return { rows: albumInsertAttempts === 1 ? [] : [allocated] };
      }
      if (sql.includes("INSERT INTO album_events")) return { rows: [TARGET_EVENT] };
      if (sql.includes("information_schema.columns")) return { rows: [] };
      if (sql.includes("SELECT DISTINCT person_id FROM photo_people")) return { rows: [] };
      return { rows: [] };
    });

    const response = await POST(moveRequest({
      photoIds: [PHOTO_ONE],
      destination: { kind: "new", albumName: "  New   Album  ", eventName: "  Reception  " },
    }), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      destination: {
        album: { id: allocated.id, slug: allocated.slug, name: allocated.name },
        event: TARGET_EVENT,
        created: true,
      },
      movedPhotoIds: [PHOTO_ONE],
    });
    expect(albumInsertAttempts).toBe(2);
    const albumInserts = calls.filter(({ sql }) => sql.startsWith("INSERT INTO albums"));
    expect(albumInserts[0]?.params.slice(0, 2)).toEqual([SOURCE.id, "New Album"]);
    const eventInsert = calls.find(({ sql }) => sql.startsWith("INSERT INTO album_events"));
    expect(eventInsert?.params.slice(0, 3)).toEqual([allocated.id, allocated.customer_id, "Reception"]);
  });
});

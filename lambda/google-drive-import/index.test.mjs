import { describe, expect, it } from "vitest";

import { normalizeDatabaseUrl, parseFolderLink, validateEvent } from "./index.mjs";

const existingEvent = {
  requestId: "request-123",
  folderLink: "https://drive.google.com/drive/folders/folder_123",
  mode: "existing",
  albumSlug: "album-one",
  eventSlug: "event-one",
};

describe("Lambda Google Drive invocation validation", () => {
  it.each([
    {
      url: "https://drive.google.com/drive/folders/folder_123",
      expected: { id: "folder_123", resourceKey: undefined },
    },
    {
      url: "https://drive.google.com/drive/u/2/folders/folder-123?resourcekey=secret-key",
      expected: { id: "folder-123", resourceKey: "secret-key" },
    },
    {
      url: "https://drive.google.com/folders/folder_123",
      expected: { id: "folder_123", resourceKey: undefined },
    },
    {
      url: "https://drive.google.com/open?id=folder_123&resourcekey=key",
      expected: { id: "folder_123", resourceKey: "key" },
    },
  ])("parses the supported folder URL $url", ({ url, expected }) => {
    expect(parseFolderLink(url)).toEqual(expected);
  });

  it.each([
    ["not a URL", "valid Google Drive folder URL"],
    ["http://drive.google.com/drive/folders/folder_123", "public Google Drive folder URL"],
    ["https://drive.google.com.evil.example/drive/folders/folder_123", "public Google Drive folder URL"],
    ["https://drive.google.com/drive/folders/", "identify a Google Drive folder"],
    ["https://drive.google.com/file/d/file_123/view", "identify a Google Drive folder"],
    ["https://drive.google.com/open?resourcekey=key", "identify a Google Drive folder"],
    ["https://drive.google.com/not-drive/folders/folder_123", "identify a Google Drive folder"],
  ])("rejects malformed or non-folder URL %s", (url, message) => {
    expect(() => parseFolderLink(url)).toThrow(message);
  });

  it.each([null, [], "payload"])('rejects non-object payload %#', (payload) => {
    expect(() => validateEvent(payload)).toThrow("Invocation payload must be an object");
  });

  it("rejects unexpected invocation fields before processing", () => {
    expect(() =>
      validateEvent({ ...existingEvent, unexpected: "not allowed" }),
    ).toThrow("Unexpected invocation field: unexpected");
  });

  it.each([
    {
      name: "missing requestId",
      event: { ...existingEvent, requestId: " " },
      message: "requestId is required",
    },
    {
      name: "invalid mode",
      event: { ...existingEvent, mode: "replace" },
      message: "mode must be new or existing",
    },
    {
      name: "non-boolean runAi",
      event: { ...existingEvent, runAi: "false" },
      message: "runAi must be a boolean",
    },
    {
      name: "blank optional text",
      event: { ...existingEvent, googleDriveApiKey: " " },
      message: "googleDriveApiKey must be a non-empty string",
    },
    {
      name: "new target missing albumName",
      event: {
        requestId: existingEvent.requestId,
        folderLink: existingEvent.folderLink,
        mode: "new",
        eventName: "Reception",
      },
      message: "new mode requires albumName and eventName only",
    },
    {
      name: "new target containing an existing slug",
      event: {
        requestId: existingEvent.requestId,
        folderLink: existingEvent.folderLink,
        mode: "new",
        albumName: "Wedding",
        eventName: "Reception",
        eventSlug: "existing-event",
      },
      message: "new mode requires albumName and eventName only",
    },
    {
      name: "existing target missing albumSlug",
      event: {
        requestId: existingEvent.requestId,
        folderLink: existingEvent.folderLink,
        mode: "existing",
        eventSlug: "event-one",
      },
      message: "existing mode requires albumSlug and eventSlug or eventName",
    },
    {
      name: "existing target missing event identifier",
      event: {
        requestId: existingEvent.requestId,
        folderLink: existingEvent.folderLink,
        mode: "existing",
        albumSlug: "album-one",
      },
      message: "existing mode requires albumSlug and eventSlug or eventName",
    },
  ])("rejects $name", ({ event, message }) => {
    expect(() => validateEvent(event)).toThrow(message);
  });

  it.each([
    {
      name: "new album and event names",
      event: {
        requestId: " request-123 ",
        folderLink: existingEvent.folderLink,
        mode: "new",
        albumName: " Wedding ",
        eventName: " Reception ",
        runAi: false,
      },
      expected: {
        requestId: "request-123",
        albumName: "Wedding",
        eventName: "Reception",
        runAi: false,
      },
    },
    {
      name: "existing event slug",
      event: existingEvent,
      expected: {
        requestId: "request-123",
        albumSlug: "album-one",
        eventSlug: "event-one",
      },
    },
    {
      name: "new event name in an existing album",
      event: {
        requestId: existingEvent.requestId,
        folderLink: existingEvent.folderLink,
        mode: "existing",
        albumSlug: "album-one",
        eventName: "After Party",
      },
      expected: {
        albumSlug: "album-one",
        eventName: "After Party",
      },
    },
  ])("accepts and normalizes a valid $name target", ({ event, expected }) => {
    expect(validateEvent(event)).toMatchObject(expected);
  });
});

describe("PostgreSQL connection URL normalization", () => {
  it("removes sslmode=require without changing unrelated URL semantics", () => {
    const normalized = new URL(
      normalizeDatabaseUrl(
        "postgresql://importer:secret@db.example.com:5432/gallery?sslmode=require&application_name=drive%20importer",
      ),
    );

    expect(normalized.protocol).toBe("postgresql:");
    expect(normalized.hostname).toBe("db.example.com");
    expect(normalized.port).toBe("5432");
    expect(normalized.pathname).toBe("/gallery");
    expect(normalized.searchParams.has("sslmode")).toBe(false);
    expect(normalized.searchParams.get("application_name")).toBe("drive importer");
  });

  it.each(["sslcert", "sslkey", "sslrootcert"])(
    "removes the %s TLS file parameter",
    (parameter) => {
      const normalized = new URL(
        normalizeDatabaseUrl(
          `postgresql://importer:secret@db.example.com/gallery?${parameter}=%2Fvar%2Frun%2Fpostgresql%2Fclient.pem&connect_timeout=10`,
        ),
      );

      expect(normalized.searchParams.has(parameter)).toBe(false);
      expect(normalized.searchParams.get("connect_timeout")).toBe("10");
    },
  );

  it("preserves percent-encoded credentials while removing TLS parameters", () => {
    const normalized = new URL(
      normalizeDatabaseUrl(
        "postgresql://drive_user:p%40ss%3Aword%2F2026@database.internal:6432/photo_gallery?sslmode=require&options=-c%20statement_timeout%3D5000",
      ),
    );

    expect(normalized.username).toBe("drive_user");
    expect(decodeURIComponent(normalized.password)).toBe("p@ss:word/2026");
    expect(normalized.hostname).toBe("database.internal");
    expect(normalized.port).toBe("6432");
    expect(normalized.pathname).toBe("/photo_gallery");
    expect(normalized.searchParams.has("sslmode")).toBe(false);
    expect(normalized.searchParams.get("options")).toBe("-c statement_timeout=5000");
  });

  it("preserves a connection URL with no query parameters", () => {
    const normalized = new URL(
      normalizeDatabaseUrl("postgresql://importer:secret@db.example.com:5432/gallery"),
    );

    expect({
      protocol: normalized.protocol,
      username: normalized.username,
      password: normalized.password,
      hostname: normalized.hostname,
      port: normalized.port,
      pathname: normalized.pathname,
      query: [...normalized.searchParams],
    }).toEqual({
      protocol: "postgresql:",
      username: "importer",
      password: "secret",
      hostname: "db.example.com",
      port: "5432",
      pathname: "/gallery",
      query: [],
    });
  });
});

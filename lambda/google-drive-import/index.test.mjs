import { describe, expect, it } from "vitest";

import { parseFolderLink, validateEvent } from "./index.mjs";

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

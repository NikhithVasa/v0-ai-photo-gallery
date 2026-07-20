import { describe, expect, it } from "vitest";

import { driveFolderLinkSchema, requestSchema } from "./route";

const existingRequest = {
  folderLink: "https://drive.google.com/drive/folders/folder_123",
  mode: "existing" as const,
  albumSlug: "album-one",
  eventSlug: "event-one",
};

describe("Google Drive import request validation", () => {
  it.each([
    "https://drive.google.com/drive/folders/folder_123",
    "https://drive.google.com/drive/u/0/folders/folder-123?resourcekey=key",
    "https://drive.google.com/folders/folder_123",
    "https://drive.google.com/open?id=folder_123",
  ])("accepts the supported public folder URL variant %s", (folderLink) => {
    expect(driveFolderLinkSchema.safeParse(folderLink).success).toBe(true);
  });

  it.each([
    ["not a URL", "not a URL"],
    ["HTTP", "http://drive.google.com/drive/folders/folder_123"],
    ["lookalike host", "https://drive.google.com.evil.example/drive/folders/folder_123"],
    ["missing folder id", "https://drive.google.com/drive/folders/"],
    ["file URL", "https://drive.google.com/file/d/file_123/view"],
    ["open URL without id", "https://drive.google.com/open?resourcekey=key"],
  ])("rejects a %s", (_name, folderLink) => {
    const result = driveFolderLinkSchema.safeParse(folderLink);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Paste a recognizable public Google Drive folder URL.",
      );
    }
  });

  it("rejects unexpected request fields", () => {
    const result = requestSchema.safeParse({
      ...existingRequest,
      unexpected: "not forwarded",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({
          code: "unrecognized_keys",
          keys: ["unexpected"],
        }),
      ]);
    }
  });

  it.each([
    {
      name: "new target without albumName",
      request: {
        folderLink: existingRequest.folderLink,
        mode: "new",
        eventName: "Reception",
      },
      message: "albumName is required when creating an album.",
    },
    {
      name: "new target without eventName",
      request: {
        folderLink: existingRequest.folderLink,
        mode: "new",
        albumName: "Wedding",
      },
      message: "eventName is required when creating an album.",
    },
    {
      name: "new target with an existing slug",
      request: {
        folderLink: existingRequest.folderLink,
        mode: "new",
        albumName: "Wedding",
        eventName: "Reception",
        albumSlug: "existing-album",
      },
      message: "albumSlug and eventSlug are not accepted in new mode.",
    },
    {
      name: "existing target without albumSlug",
      request: {
        folderLink: existingRequest.folderLink,
        mode: "existing",
        eventSlug: "event-one",
      },
      message: "albumSlug is required for an existing album.",
    },
    {
      name: "existing target without an event identifier",
      request: {
        folderLink: existingRequest.folderLink,
        mode: "existing",
        albumSlug: "album-one",
      },
      message: "eventSlug or eventName is required.",
    },
  ])("rejects $name", ({ request, message }) => {
    const result = requestSchema.safeParse(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(message);
    }
  });

  it.each([
    {
      name: "new album and event names",
      request: {
        folderLink: existingRequest.folderLink,
        mode: "new",
        albumName: "Wedding",
        eventName: "Reception",
      },
    },
    {
      name: "existing event slug",
      request: existingRequest,
    },
    {
      name: "new event name in an existing album",
      request: {
        folderLink: existingRequest.folderLink,
        mode: "existing",
        albumSlug: "album-one",
        eventName: "After Party",
      },
    },
  ])("accepts a valid $name target", ({ request }) => {
    expect(requestSchema.safeParse(request).success).toBe(true);
  });

  it("rejects a non-boolean runAi value", () => {
    const result = requestSchema.safeParse({
      ...existingRequest,
      runAi: "false",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({ path: ["runAi"], code: "invalid_type" }),
      ]);
    }
  });
});

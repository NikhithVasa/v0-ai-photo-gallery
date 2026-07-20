import { describe, expect, it } from "vitest";

import {
  driveImportPollDecision,
  eventPhotosPageKey,
  reconcileDriveImportTarget,
  selectDriveImportTarget,
  slugifyImportEvent,
} from "./add-event-page";

describe("Google Drive event photo polling", () => {
  it.each([
    { title: "  Sarah & Alex — Reception  ", slug: "sarah-alex-reception" },
    { title: "DAY 2: After-Party!", slug: "day-2-after-party" },
  ])("derives the event slug for $title", ({ title, slug }) => {
    expect(slugifyImportEvent(title)).toBe(slug);
  });

  it.each([
    {
      name: "the imported event is still selected before the deadline",
      selectedEventSlug: "reception",
      now: 299_999,
      expected: "refresh",
    },
    {
      name: "the user selected a different event",
      selectedEventSlug: "ceremony",
      now: 100_000,
      expected: "stop",
    },
    {
      name: "the five-minute deadline has been reached",
      selectedEventSlug: "reception",
      now: 300_000,
      expected: "stop",
    },
  ] as const)("returns $expected when $name", ({ selectedEventSlug, now, expected }) => {
    expect(
      driveImportPollDecision(
        { eventSlug: "reception", until: 300_000 },
        selectedEventSlug,
        now,
      ),
    ).toBe(expected);
  });
});

describe("Google Drive import target reconciliation", () => {
  it("switches a stale existing-event selection to a new event when the album has no events", () => {
    expect(
      reconcileDriveImportTarget({
        uploadTarget: "existing",
        selectedEventSlug: "test",
        eventSlugs: [],
      }),
    ).toEqual({
      uploadTarget: "new",
      selectedEventSlug: "test",
      suggestedEventName: "test",
    });
  });

  it("sends the event name while the queued event is missing from album data", () => {
    expect(
      selectDriveImportTarget({
        uploadTarget: "existing",
        eventName: "Test",
        selectedEventSlug: "test",
        eventSlugs: [],
        queuedEventSlug: "test",
      }),
    ).toEqual({ eventName: "Test" });
  });

  it("sends the event slug once the queued event is present in album data", () => {
    expect(
      selectDriveImportTarget({
        uploadTarget: "existing",
        eventName: "Test",
        selectedEventSlug: "test",
        eventSlugs: ["test"],
        queuedEventSlug: "test",
      }),
    ).toEqual({ eventSlug: "test" });
  });

  it("returns to the created event when polling adds it to album data", () => {
    expect(
      reconcileDriveImportTarget({
        uploadTarget: "new",
        selectedEventSlug: "other-event",
        eventSlugs: ["other-event", "test"],
        queuedEventSlug: "test",
      }),
    ).toEqual({ uploadTarget: "existing", selectedEventSlug: "test" });
  });
});

describe("event photo pagination", () => {
  it.each([
    { name: "the first page", pageIndex: 0, expectedOffset: 0 },
    { name: "the second page", pageIndex: 1, expectedOffset: 10 },
    { name: "a later page", pageIndex: 4, expectedOffset: 40 },
  ])("requests 10 photos at the correct offset for $name", ({ pageIndex, expectedOffset }) => {
    expect(
      eventPhotosPageKey({
        albumSlug: "summer album",
        uploadTarget: "existing",
        selectedEventSlug: "dinner & dancing",
        pageIndex,
        previousPageData:
          pageIndex === 0 ? null : { photos: [], hasMore: true },
      }),
    ).toBe(
      `/api/albums/summer%20album/photos?event=dinner%20%26%20dancing&limit=10&offset=${expectedOffset}`,
    );
  });

  it.each<{
    name: string;
    uploadTarget: "new" | "existing";
    selectedEventSlug: string;
    previousPageData: { photos: never[]; hasMore: boolean } | null;
  }>([
    { name: "new-event mode is active", uploadTarget: "new", selectedEventSlug: "ceremony", previousPageData: null },
    { name: "no event is selected", uploadTarget: "existing", selectedEventSlug: "", previousPageData: null },
    { name: "the preceding page is exhausted", uploadTarget: "existing", selectedEventSlug: "ceremony", previousPageData: { photos: [], hasMore: false } },
  ])("suppresses a request when $name", ({ uploadTarget, selectedEventSlug, previousPageData }) => {
    expect(
      eventPhotosPageKey({
        albumSlug: "album",
        uploadTarget,
        selectedEventSlug,
        pageIndex: 1,
        previousPageData,
      }),
    ).toBeNull();
  });

  it("starts a switched event with its first request", () => {
    const previousEventLaterPage = eventPhotosPageKey({
      albumSlug: "album",
      uploadTarget: "existing",
      selectedEventSlug: "ceremony",
      pageIndex: 3,
      previousPageData: { photos: [], hasMore: true },
    });
    expect(previousEventLaterPage).toContain("event=ceremony&limit=10&offset=30");

    expect(
      eventPhotosPageKey({
        albumSlug: "album",
        uploadTarget: "existing",
        selectedEventSlug: "reception",
        pageIndex: 0,
        previousPageData: null,
      }),
    ).toBe("/api/albums/album/photos?event=reception&limit=10&offset=0");
  });
});

import { describe, expect, it } from "vitest";

import {
  driveImportPollDecision,
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

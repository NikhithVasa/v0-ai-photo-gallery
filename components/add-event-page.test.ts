import { describe, expect, it } from "vitest";

import {
  driveImportPollDecision,
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

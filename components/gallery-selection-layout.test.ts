import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  AlbumDownloadMenu,
  MoveSelectionTrigger,
  buildMovePhotosPayload,
  canSubmitMovePhotos,
  galleryFooterClassName,
  shouldShowMoveAction,
  type MovePhotosFormState,
} from "./album-gallery-page";
import { ApsaraFloatingTrigger } from "./apsara-moments";
import { PhotoCard } from "./photo-card";
import type { Photo } from "@/lib/types";

const photo: Photo = {
  id: "photo-1",
  albumId: "album-1",
  albumSlug: "summer",
  eventId: "event-1",
  eventSlug: "ceremony",
  eventName: "Ceremony",
  fileName: "portrait.jpg",
  caption: "A portrait",
  searchText: null,
  previewUrl: null,
  thumbnailUrl: null,
  downloadUrl: null,
  width: 1200,
  height: 800,
};

function renderPhotoCard(isSelected: boolean) {
  return renderToStaticMarkup(
    createElement(PhotoCard, {
      albumSlug: "summer",
      photo,
      index: 0,
      isSelected,
      onOpen: vi.fn(),
      onToggleSelect: vi.fn(),
    }),
  );
}

function buttonClassTokens(markup: string) {
  const className = markup.match(/<button[^>]*class="([^"]*)"/)?.[1];
  if (!className) throw new Error("Rendered button has no class attribute");
  return className.split(/\s+/);
}

describe("public gallery photo selection", () => {
  it.each([
    {
      name: "unselected",
      isSelected: false,
      label: "Select photo",
      text: "Select",
      pressed: "false",
    },
    {
      name: "selected",
      isSelected: true,
      label: "Deselect photo",
      text: "Selected",
      pressed: "true",
    },
  ])("renders the explicit $name selection control", ({ isSelected, label, text, pressed }) => {
    const markup = renderPhotoCard(isSelected);

    expect(markup).toContain(`aria-label="${label}"`);
    expect(markup).toContain(`aria-pressed="${pressed}"`);
    expect(markup).toContain(`<span>${text}</span>`);
  });

  it("shows the selected-photo count in the top download trigger", () => {
    const markup = renderToStaticMarkup(
      createElement(AlbumDownloadMenu, {
        albumSlug: "summer",
        events: [],
        selectedEventSlug: null,
        selectedPeopleIds: [],
        selectedPeople: [],
        peopleMatchMode: "all",
        selectedDownloadPhotoIds: ["photo-1", "photo-2"],
      }),
    );

    expect(markup).toContain('aria-label="Download photos"');
    expect(markup).toContain("Download (2)");
  });
});

describe("selected-photo move action", () => {
  const validState: MovePhotosFormState = {
    photoIds: ["photo-1"],
    flow: "existing",
    albumSlug: "destination",
    eventSlug: "reception",
    albumName: "",
    eventName: "",
    isMoving: false,
    isLoadingDestinations: false,
  };

  it.each([
    { name: "authenticated selection", isSelectionMode: true, isAuthenticated: true, isShareView: false, visible: true },
    { name: "normal browsing", isSelectionMode: false, isAuthenticated: true, isShareView: false, visible: false },
    { name: "unauthenticated passcode view", isSelectionMode: true, isAuthenticated: false, isShareView: false, visible: false },
    { name: "share view", isSelectionMode: true, isAuthenticated: true, isShareView: true, visible: false },
  ])("reports Move visibility for $name", ({ visible, ...state }) => {
    expect(shouldShowMoveAction(state)).toBe(visible);
  });

  it.each([
    { name: "no selected photos", selectedCount: 0, disabled: true },
    { name: "selected photos", selectedCount: 2, disabled: false },
  ])("renders the Move trigger $name state", ({ selectedCount, disabled }) => {
    const markup = renderToStaticMarkup(createElement(MoveSelectionTrigger, { selectedCount }));

    expect(markup).toContain('aria-label="Move selected photos"');
    expect(markup.includes(' disabled=""')).toBe(disabled);
  });

  it.each([
    { name: "empty selection", override: { photoIds: [] }, allowed: false },
    { name: "move in progress", override: { isMoving: true }, allowed: false },
    { name: "destinations loading", override: { isLoadingDestinations: true }, allowed: false },
    { name: "existing album without event", override: { eventSlug: "" }, allowed: false },
    { name: "complete existing destination", override: {}, allowed: true },
    {
      name: "new destination with a blank event",
      override: { flow: "new" as const, albumName: "Album", eventName: "   " },
      allowed: false,
    },
    {
      name: "complete new destination",
      override: { flow: "new" as const, albumName: " Album ", eventName: " Event " },
      allowed: true,
    },
  ])("enforces submit eligibility for $name", ({ override, allowed }) => {
    expect(canSubmitMovePhotos({ ...validState, ...override })).toBe(allowed);
  });

  it.each([
    {
      name: "existing destination",
      state: validState,
      expected: {
        photoIds: ["photo-1"],
        destination: { kind: "existing", albumSlug: "destination", eventSlug: "reception" },
      },
    },
    {
      name: "new destination with surrounding whitespace",
      state: {
        ...validState,
        flow: "new" as const,
        albumName: "  New Album  ",
        eventName: "  Dinner  ",
      },
      expected: {
        photoIds: ["photo-1"],
        destination: { kind: "new", albumName: "New Album", eventName: "Dinner" },
      },
    },
  ])("builds the exact $name request body", ({ state, expected }) => {
    expect(buildMovePhotosPayload(state)).toEqual(expected);
  });
});

describe("responsive gallery ending", () => {
  it("keeps the Apsara trigger in mobile flow and fixes it from md upward", () => {
    const markup = renderToStaticMarkup(
      createElement(ApsaraFloatingTrigger, {
        onClick: vi.fn(),
        galleryFooterVisible: true,
      }),
    );
    const classes = buttonClassTokens(markup);

    expect(classes).toContain("relative");
    expect(classes).not.toContain("fixed");
    expect(classes).toContain("md:fixed");
    expect(classes).toContain("md:bottom-24");
  });

  it.each([
    {
      name: "visible",
      hidden: false,
      desktopState: ["md:translate-y-0", "md:opacity-100"],
    },
    {
      name: "hidden",
      hidden: true,
      desktopState: [
        "md:pointer-events-none",
        "md:translate-y-[calc(100%+5rem)]",
        "md:opacity-0",
      ],
    },
  ])("keeps the $name footer in mobile flow while applying its state at md", ({ hidden, desktopState }) => {
    const classes = galleryFooterClassName(hidden).split(/\s+/);

    expect(classes).toContain("relative");
    expect(classes).not.toContain("fixed");
    expect(classes).toContain("md:fixed");
    expect(classes).not.toContain("pointer-events-none");
    expect(classes).not.toContain("opacity-0");
    expect(classes).toEqual(expect.arrayContaining(desktopState));
  });
});

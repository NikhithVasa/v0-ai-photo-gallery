import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  AlbumDownloadMenu,
  galleryFooterClassName,
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

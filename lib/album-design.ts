import { query } from "@/lib/db";
import { normalizePhotoSortMode } from "@/lib/photo-sort";
import { normalizeShareBackgroundColor } from "@/lib/share-theme";
import type { AlbumDesignSettings, AlbumDesignTitleFont } from "@/lib/types";

export const ALBUM_DESIGN_LAYOUTS = ["horizontal", "vertical"] as const;
export const ALBUM_DESIGN_TITLE_FONTS = [
  "inter",
  "playfair",
  "cormorant",
  "geist",
] as const;

export const DEFAULT_ALBUM_DESIGN_SETTINGS: AlbumDesignSettings = {
  gridSpace: 12,
  imageRadius: 22,
  sidePadding: 16,
  rowHeight: 260,
  layout: "horizontal",
  imageSortMode: "added_oldest",
  backgroundColor: null,
  titleFont: "playfair",
  titleFontSize: 1,
};

const layoutSet = new Set<string>(ALBUM_DESIGN_LAYOUTS);
const titleFontSet = new Set<string>(ALBUM_DESIGN_TITLE_FONTS);

let albumDesignSchemaPromise: Promise<void> | null = null;

function numberInRange(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

export function normalizeAlbumDesignSettings(value: unknown): AlbumDesignSettings {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const titleFont = titleFontSet.has(String(source.titleFont))
    ? (source.titleFont as AlbumDesignTitleFont)
    : DEFAULT_ALBUM_DESIGN_SETTINGS.titleFont;

  return {
    gridSpace: numberInRange(
      source.gridSpace,
      DEFAULT_ALBUM_DESIGN_SETTINGS.gridSpace,
      0,
      50,
    ),
    imageRadius: numberInRange(
      source.imageRadius,
      DEFAULT_ALBUM_DESIGN_SETTINGS.imageRadius,
      0,
      32,
    ),
    sidePadding: numberInRange(
      source.sidePadding,
      DEFAULT_ALBUM_DESIGN_SETTINGS.sidePadding,
      0,
      40,
    ),
    rowHeight: numberInRange(
      source.rowHeight,
      DEFAULT_ALBUM_DESIGN_SETTINGS.rowHeight,
      160,
      620,
    ),
    layout: layoutSet.has(String(source.layout))
      ? (source.layout as AlbumDesignSettings["layout"])
      : DEFAULT_ALBUM_DESIGN_SETTINGS.layout,
    imageSortMode: normalizePhotoSortMode(source.imageSortMode),
    backgroundColor:
      typeof source.backgroundColor === "string"
        ? normalizeShareBackgroundColor(source.backgroundColor)
        : DEFAULT_ALBUM_DESIGN_SETTINGS.backgroundColor,
    titleFont,
    titleFontSize: numberInRange(
      source.titleFontSize,
      DEFAULT_ALBUM_DESIGN_SETTINGS.titleFontSize,
      0.7,
      1.8,
    ),
  };
}

export function ensureAlbumDesignSchema() {
  albumDesignSchemaPromise ??= query(
    `
    ALTER TABLE albums
      ADD COLUMN IF NOT EXISTS design_settings jsonb NOT NULL DEFAULT '{}'::jsonb
    `,
    [],
  )
    .then(() => undefined)
    .catch((error) => {
      albumDesignSchemaPromise = null;
      throw error;
    });

  return albumDesignSchemaPromise;
}
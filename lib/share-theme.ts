export const DEFAULT_SHARE_BACKGROUND_COLOR = "#f5f5f7";

export const SHARE_BACKGROUND_COLORS = [
  { value: "#f5f5f7", label: "Mist" },
  { value: "#eef3f8", label: "Cloud" },
  { value: "#eaf4f1", label: "Teal" },
  { value: "#edf5ec", label: "Sage" },
  { value: "#edf5fb", label: "Sky" },
  { value: "#f2effa", label: "Lavender" },
  { value: "#faeff3", label: "Blush" },
  { value: "#f7f1e8", label: "Linen" },
  { value: "#eef0f3", label: "Silver" },
] as const;

export type ShareBackgroundColor =
  (typeof SHARE_BACKGROUND_COLORS)[number]["value"];

export function normalizeShareBackgroundColor(
  value: unknown,
): ShareBackgroundColor {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const match = SHARE_BACKGROUND_COLORS.find(
      (color) => color.value === normalized,
    );
    if (match) return match.value;
  }

  return DEFAULT_SHARE_BACKGROUND_COLOR;
}

export function isShareBackgroundColor(value: unknown) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return SHARE_BACKGROUND_COLORS.some((color) => color.value === normalized);
}

export function shareBackgroundRgba(value: unknown, alpha: number) {
  const color = normalizeShareBackgroundColor(value);
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

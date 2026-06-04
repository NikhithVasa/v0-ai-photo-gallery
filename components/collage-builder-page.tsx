"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CloudDownload,
  Download,
  ImagePlus,
  Images,
  LayoutTemplate,
  Loader2,
  Move,
  RefreshCcw,
  Shuffle,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthAvatarMenu } from "@/components/auth-avatar-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGoogleImageImport } from "@/hooks/use-google-image-import";
import type { AlbumDetail, AlbumSummary, Photo } from "@/lib/types";

type CollageTemplate =
  | "single_hero"
  | "horizontal_2"
  | "vertical_2"
  | "grid_2x2"
  | "hero_top_4"
  | "hero_left_3"
  | "strip_3"
  | "stack_3"
  | "grid_3x3"
  | "grid_3x2"
  | "grid_2x3"
  | "grid_3x9"
  | "grid_9x3"
  | "masonry_hollander"
  | "magazine_cover"
  | "center_hero"
  | "diagonal_2"
  | "diagonal_4"
  | "film_strip"
  | "freeform_resizable";

type FitMode = "cover" | "contain" | "fill";
type ImagePosition = "center" | "top" | "bottom" | "left" | "right";
type BackgroundMode = "solid" | "transparent" | "gradient" | "blur";

interface TemplateOption {
  id: CollageTemplate;
  name: string;
  photos: number;
}

interface OutputSize {
  id: string;
  name: string;
  width: number;
  height: number;
}

interface CellFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  photoIndex?: number;
  clipPath?: string;
}

interface CellAdjustment {
  zoom: number;
  rotate: number;
  offsetX: number;
  offsetY: number;
}

interface CollageBuilderPageProps {
  initialAlbumSlug?: string;
}

type CollagePhoto = Photo & {
  isLocalUpload?: boolean;
};

type MoveDragState = {
  fromIndex: number;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  targetIndex: number | null;
};

const defaultAdjustment: CellAdjustment = {
  zoom: 1,
  rotate: 0,
  offsetX: 0,
  offsetY: 0,
};

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

const swrOptions = {
  dedupingInterval: 5 * 60 * 1000,
  revalidateOnFocus: false,
};

const templates: TemplateOption[] = [
  { id: "single_hero", name: "Single Hero", photos: 1 },
  { id: "horizontal_2", name: "2x1 Horizontal", photos: 2 },
  { id: "vertical_2", name: "1x2 Vertical", photos: 2 },
  { id: "grid_2x2", name: "2x2 Grid", photos: 4 },
  { id: "hero_top_4", name: "Hero Top", photos: 4 },
  { id: "hero_left_3", name: "Hero Left", photos: 3 },
  { id: "strip_3", name: "3 Photo Strip", photos: 3 },
  { id: "stack_3", name: "3 Photo Stack", photos: 3 },
  { id: "grid_3x3", name: "3x3 Grid", photos: 9 },
  { id: "grid_3x2", name: "3x2 Grid", photos: 6 },
  { id: "grid_2x3", name: "2x3 Grid", photos: 6 },
  { id: "grid_3x9", name: "3x9 Contact", photos: 27 },
  { id: "grid_9x3", name: "9x3 Banner", photos: 27 },
  { id: "masonry_hollander", name: "Hollander", photos: 7 },
  { id: "magazine_cover", name: "Magazine", photos: 5 },
  { id: "center_hero", name: "Center Hero", photos: 9 },
  { id: "diagonal_2", name: "Diagonal Slice", photos: 2 },
  { id: "diagonal_4", name: "Four Slices", photos: 4 },
  { id: "film_strip", name: "Film Strip", photos: 5 },
  { id: "freeform_resizable", name: "Freeform", photos: 6 },
];

const outputSizes: OutputSize[] = [
  { id: "square", name: "Instagram Square", width: 1080, height: 1080 },
  { id: "portrait", name: "Instagram Portrait", width: 1080, height: 1350 },
  { id: "story", name: "Instagram Story", width: 1080, height: 1920 },
  { id: "landscape", name: "Landscape", width: 1920, height: 1080 },
  { id: "4k", name: "4K Landscape", width: 3840, height: 2160 },
  { id: "print-4x6", name: "Print 4x6", width: 1800, height: 1200 },
  { id: "print-5x7", name: "Print 5x7", width: 2100, height: 1500 },
  { id: "print-8x10", name: "Print 8x10", width: 3000, height: 2400 },
  { id: "custom", name: "Custom", width: 1600, height: 1600 },
];

const colors = ["#ffffff", "#111111", "#d8b35a", "#f6f1e8", "#e8eef7", "#f0d7ce"];

function chunkGrid(columns: number, rows: number, count = columns * rows): CellFrame[] {
  return Array.from({ length: count }, (_, index) => ({
    x: (index % columns) / columns,
    y: Math.floor(index / columns) / rows,
    w: 1 / columns,
    h: 1 / rows,
  }));
}

function framesForTemplate(template: CollageTemplate): CellFrame[] {
  switch (template) {
    case "single_hero":
      return [{ x: 0, y: 0, w: 1, h: 1 }];
    case "horizontal_2":
      return chunkGrid(2, 1);
    case "vertical_2":
      return chunkGrid(1, 2);
    case "grid_2x2":
      return chunkGrid(2, 2);
    case "hero_top_4":
      return [
        { x: 0, y: 0, w: 1, h: 0.62 },
        { x: 0, y: 0.62, w: 1 / 3, h: 0.38 },
        { x: 1 / 3, y: 0.62, w: 1 / 3, h: 0.38 },
        { x: 2 / 3, y: 0.62, w: 1 / 3, h: 0.38 },
      ];
    case "hero_left_3":
      return [
        { x: 0, y: 0, w: 0.58, h: 1 },
        { x: 0.58, y: 0, w: 0.42, h: 0.5 },
        { x: 0.58, y: 0.5, w: 0.42, h: 0.5 },
      ];
    case "strip_3":
      return chunkGrid(3, 1);
    case "stack_3":
      return chunkGrid(1, 3);
    case "grid_3x3":
      return chunkGrid(3, 3);
    case "grid_3x2":
      return chunkGrid(3, 2);
    case "grid_2x3":
      return chunkGrid(2, 3);
    case "grid_3x9":
      return chunkGrid(3, 9);
    case "grid_9x3":
      return chunkGrid(9, 3);
    case "masonry_hollander":
      return [
        { x: 0, y: 0, w: 0.34, h: 0.66 },
        { x: 0.34, y: 0, w: 0.33, h: 0.33 },
        { x: 0.67, y: 0, w: 0.33, h: 0.33 },
        { x: 0.34, y: 0.33, w: 0.66, h: 0.33 },
        { x: 0, y: 0.66, w: 0.34, h: 0.34 },
        { x: 0.34, y: 0.66, w: 0.33, h: 0.34 },
        { x: 0.67, y: 0.66, w: 0.33, h: 0.34 },
      ];
    case "magazine_cover":
      return [
        { x: 0, y: 0, w: 1, h: 0.72 },
        { x: 0, y: 0.72, w: 0.25, h: 0.28 },
        { x: 0.25, y: 0.72, w: 0.25, h: 0.28 },
        { x: 0.5, y: 0.72, w: 0.25, h: 0.28 },
        { x: 0.75, y: 0.72, w: 0.25, h: 0.28 },
      ];
    case "center_hero":
      return [
        { x: 1 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3, photoIndex: 0 },
        { x: 0, y: 0, w: 1 / 3, h: 1 / 3, photoIndex: 1 },
        { x: 1 / 3, y: 0, w: 1 / 3, h: 1 / 3, photoIndex: 2 },
        { x: 2 / 3, y: 0, w: 1 / 3, h: 1 / 3, photoIndex: 3 },
        { x: 0, y: 1 / 3, w: 1 / 3, h: 1 / 3, photoIndex: 4 },
        { x: 2 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3, photoIndex: 5 },
        { x: 0, y: 2 / 3, w: 1 / 3, h: 1 / 3, photoIndex: 6 },
        { x: 1 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3, photoIndex: 7 },
        { x: 2 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3, photoIndex: 8 },
      ];
    case "diagonal_2":
      return [
        { x: 0, y: 0, w: 1, h: 1, photoIndex: 0, clipPath: "polygon(0 0, 100% 0, 0 100%)" },
        { x: 0, y: 0, w: 1, h: 1, photoIndex: 1, clipPath: "polygon(100% 0, 100% 100%, 0 100%)" },
      ];
    case "diagonal_4":
      return [
        { x: 0, y: 0, w: 1, h: 1, photoIndex: 0, clipPath: "polygon(0 0, 50% 50%, 0 100%)" },
        { x: 0, y: 0, w: 1, h: 1, photoIndex: 1, clipPath: "polygon(0 0, 100% 0, 50% 50%)" },
        { x: 0, y: 0, w: 1, h: 1, photoIndex: 2, clipPath: "polygon(100% 0, 100% 100%, 50% 50%)" },
        { x: 0, y: 0, w: 1, h: 1, photoIndex: 3, clipPath: "polygon(100% 100%, 0 100%, 50% 50%)" },
      ];
    case "film_strip":
      return chunkGrid(5, 1);
    case "freeform_resizable":
      return [
        { x: 0, y: 0, w: 0.5, h: 0.56 },
        { x: 0.5, y: 0, w: 0.5, h: 0.34 },
        { x: 0.5, y: 0.34, w: 0.25, h: 0.22 },
        { x: 0.75, y: 0.34, w: 0.25, h: 0.22 },
        { x: 0, y: 0.56, w: 0.34, h: 0.44 },
        { x: 0.34, y: 0.56, w: 0.66, h: 0.44 },
      ];
  }
}

function templatePhotoCount(template: CollageTemplate) {
  return templates.find((item) => item.id === template)?.photos ?? 1;
}

function photoSearchText(photo: Photo) {
  return [
    photo.fileName,
    photo.caption,
    photo.eventName,
    photo.searchText,
    ...(photo.people ?? []).map((person) => person.displayName || person.defaultName),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function resolvePhotoUrl(photo: Photo, originalUrls: Record<string, string>) {
  return originalUrls[photo.id] || photo.previewUrl || photo.thumbnailUrl || "";
}

function isLocalImageUrl(src: string) {
  return src.startsWith("blob:") || src.startsWith("data:");
}

function trimTrailingEmptyIds(photoIds: string[]) {
  const next = [...photoIds];
  while (next.length && !next[next.length - 1]) next.pop();
  return next;
}

function normalizeAdjustment(adjustment?: Partial<CellAdjustment>): CellAdjustment {
  return {
    zoom: adjustment?.zoom ?? 1,
    rotate: adjustment?.rotate ?? 0,
    offsetX: adjustment?.offsetX ?? 0,
    offsetY: adjustment?.offsetY ?? 0,
  };
}

function objectPositionForAdjustment(position: ImagePosition) {
  if (position === "top") return "50% 0%";
  if (position === "bottom") return "50% 100%";
  if (position === "left") return "0% 50%";
  if (position === "right") return "100% 50%";
  return "50% 50%";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    if (!isLocalImageUrl(src)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded for export"));
    image.src = src;
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawImageInRect(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  fit: FitMode,
  position: ImagePosition,
  adjustment: CellAdjustment,
) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const rectRatio = w / h;
  let drawW = w;
  let drawH = h;

  if (fit === "cover") {
    if (imageRatio > rectRatio) {
      drawH = h;
      drawW = h * imageRatio;
    } else {
      drawW = w;
      drawH = w / imageRatio;
    }
  } else if (fit === "contain") {
    if (imageRatio > rectRatio) {
      drawW = w;
      drawH = w / imageRatio;
    } else {
      drawH = h;
      drawW = h * imageRatio;
    }
  }

  drawW *= adjustment.zoom;
  drawH *= adjustment.zoom;

  let dx = x + (w - drawW) / 2;
  let dy = y + (h - drawH) / 2;

  if (position === "top") dy = y;
  if (position === "bottom") dy = y + h - drawH;
  if (position === "left") dx = x;
  if (position === "right") dx = x + w - drawW;

  dx += adjustment.offsetX;
  dy += adjustment.offsetY;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((adjustment.rotate * Math.PI) / 180);
  ctx.translate(-(x + w / 2), -(y + h / 2));
  ctx.drawImage(image, dx, dy, drawW, drawH);
  ctx.restore();
}

function TemplateGlyph({ template }: { template: CollageTemplate }) {
  const frames = framesForTemplate(template).slice(0, 9);
  const isDiagonal = template === "diagonal_2" || template === "diagonal_4";

  return (
    <span className="relative block aspect-square w-full overflow-hidden rounded-[4px] bg-zinc-100">
      {isDiagonal ? (
        <>
          <span className="absolute inset-0 [clip-path:polygon(0_0,100%_0,0_100%)] bg-zinc-900" />
          <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)] bg-zinc-400" />
          {template === "diagonal_4" && (
            <>
              <span className="absolute left-1/2 top-0 h-full w-px bg-white" />
              <span className="absolute left-0 top-1/2 h-px w-full bg-white" />
            </>
          )}
        </>
      ) : (
        frames.map((frame, index) => (
          <span
            key={index}
            className="absolute rounded-[2px] bg-zinc-800"
            style={{
              left: `${frame.x * 100}%`,
              top: `${frame.y * 100}%`,
              width: `${frame.w * 100}%`,
              height: `${frame.h * 100}%`,
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,.9)",
              opacity: index === 0 ? 1 : 0.55,
            }}
          />
        ))
      )}
    </span>
  );
}

function PhotoTile({
  photo,
  selected,
  active,
  onToggle,
  onDragStart,
}: {
  photo: CollagePhoto;
  selected: boolean;
  active?: boolean;
  onToggle: () => void;
  onDragStart?: () => void;
}) {
  const src = photo.thumbnailUrl || photo.previewUrl || "";

  return (
    <button
      type="button"
      draggable
      onClick={onToggle}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", photo.id);
        onDragStart?.();
      }}
      className={`group relative aspect-square overflow-hidden rounded-md bg-zinc-100 text-left ring-offset-2 transition focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
        active
          ? "ring-2 ring-sky-500"
          : selected
            ? "ring-2 ring-zinc-950"
            : "ring-1 ring-zinc-200 hover:ring-zinc-400"
      }`}
      aria-pressed={selected}
    >
      {src &&
        (isLocalImageUrl(src) ? (
          <img
            src={src}
            alt={photo.fileName || "Photo"}
            className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.03]"
          />
        ) : (
          <Image
            src={src}
            alt={photo.fileName || "Photo"}
            fill
            sizes="132px"
            className="object-cover transition group-hover:scale-[1.03]"
            unoptimized
          />
        ))}
      <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-sm">
        {selected && <Check className="h-4 w-4 text-zinc-950" />}
      </span>
      <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 to-transparent px-2 pb-2 pt-8 text-[11px] font-medium text-white">
        {photo.isLocalUpload ? "Uploaded" : photo.eventName}
      </span>
    </button>
  );
}

function CollageCell({
  photo,
  src,
  frame,
  index,
  selected,
  fitMode,
  imagePosition,
  adjustment,
  cornerRadius,
  borderWidth,
  borderColor,
  gap,
  moveDragState,
  dropTargetIndex,
  onSelect,
  onDesktopDragStart,
  onDrop,
  onRemove,
  onAdjustChange,
  onMovePointerDown,
}: {
  photo?: CollagePhoto;
  src: string;
  frame: CellFrame;
  index: number;
  selected: boolean;
  fitMode: FitMode;
  imagePosition: ImagePosition;
  adjustment: CellAdjustment;
  cornerRadius: number;
  borderWidth: number;
  borderColor: string;
  gap: number;
  moveDragState: MoveDragState | null;
  dropTargetIndex: number | null;
  onSelect: () => void;
  onDesktopDragStart: () => void;
  onDrop: () => void;
  onRemove: () => void;
  onAdjustChange: (partial: Partial<CellAdjustment>) => void;
  onMovePointerDown: (event: ReactPointerEvent<HTMLButtonElement>, photoIndex: number) => void;
}) {
  const panStateRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    moved: false,
  });
  const pinchStateRef = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    initialDistance: 0,
    initialZoom: 1,
  });

  const distanceBetweenPointers = () => {
    const values = Array.from(pinchStateRef.current.pointers.values());
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  };

  const beginPan = (event: ReactPointerEvent<HTMLElement>) => {
    if (!photo) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    event.currentTarget.setPointerCapture(event.pointerId);

    pinchStateRef.current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pinchStateRef.current.pointers.size >= 2) {
      pinchStateRef.current.initialDistance = distanceBetweenPointers();
      pinchStateRef.current.initialZoom = adjustment.zoom;
      panStateRef.current.active = false;
      return;
    }

    panStateRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: adjustment.offsetX,
      startOffsetY: adjustment.offsetY,
      moved: false,
    };
  };

  const updatePan = (event: ReactPointerEvent<HTMLElement>) => {
    if (!photo) return;
    event.preventDefault();
    event.stopPropagation();

    if (pinchStateRef.current.pointers.has(event.pointerId)) {
      pinchStateRef.current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (pinchStateRef.current.pointers.size >= 2) {
      const nextDistance = distanceBetweenPointers();
      const startDistance = pinchStateRef.current.initialDistance || nextDistance;
      if (startDistance > 0) {
        const nextZoom = Math.max(0.6, Math.min(2.4, pinchStateRef.current.initialZoom * (nextDistance / startDistance)));
        onAdjustChange({ zoom: Number(nextZoom.toFixed(3)) });
      }
      return;
    }

    if (!panStateRef.current.active) return;
    const dx = event.clientX - panStateRef.current.startX;
    const dy = event.clientY - panStateRef.current.startY;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      panStateRef.current.moved = true;
    }

    onAdjustChange({
      offsetX: panStateRef.current.startOffsetX + dx,
      offsetY: panStateRef.current.startOffsetY + dy,
    });
  };

  const endPan = (event: ReactPointerEvent<HTMLElement>) => {
    if (!photo) return;
    event.stopPropagation();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    pinchStateRef.current.pointers.delete(event.pointerId);
    panStateRef.current.active = false;

    if (pinchStateRef.current.pointers.size < 2) {
      pinchStateRef.current.initialDistance = 0;
      pinchStateRef.current.initialZoom = adjustment.zoom;
    }
  };

  const handleWheelZoom = (event: ReactWheelEvent<HTMLElement>) => {
    if (!photo) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    const direction = event.deltaY > 0 ? -1 : 1;
    const nextZoom = Math.max(0.6, Math.min(2.4, adjustment.zoom + direction * 0.06));
    onAdjustChange({ zoom: Number(nextZoom.toFixed(2)) });
  };

  const preventPagePinchZoom = (event: ReactTouchEvent<HTMLElement>) => {
    if (event.touches.length < 2) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const isBeingMoved = moveDragState?.fromIndex === index;
  const isDraggingForSwap = Boolean(moveDragState?.active);
  const isDropCandidate = isDraggingForSwap && moveDragState?.fromIndex !== index;
  const isDropTarget = dropTargetIndex === index && moveDragState?.fromIndex !== index;
  const imageStyle = {
    objectFit: fitMode,
    objectPosition: objectPositionForAdjustment(imagePosition),
    transform: `translate3d(${adjustment.offsetX}px, ${adjustment.offsetY}px, 0) scale(${adjustment.zoom}) rotate(${adjustment.rotate}deg)`,
    transformOrigin: "center center",
    touchAction: "none",
    overscrollBehavior: "contain",
    cursor: photo ? "grab" : "default",
    userSelect: "none",
    willChange: "transform",
  } as const;

  return (
    <div
      role="button"
      tabIndex={0}
      data-collage-cell-index={index}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={`absolute overflow-hidden bg-zinc-200 transition-all duration-150 focus:outline-none ${
        selected ? "ring-2 ring-sky-500 ring-offset-2" : ""
      } ${isDropCandidate ? "ring-2 ring-emerald-200 ring-offset-1 ring-offset-white" : ""} ${
        isDropTarget ? "z-30 scale-[0.985] ring-4 ring-emerald-500 ring-offset-2 ring-offset-white shadow-[0_0_0_8px_rgba(16,185,129,0.28)]" : ""
      } ${isBeingMoved ? "opacity-45" : ""}`}
      style={{
        left: `${frame.x * 100}%`,
        top: `${frame.y * 100}%`,
        width: `${frame.w * 100}%`,
        height: `${frame.h * 100}%`,
        padding: `${gap / 2}px`,
        clipPath: frame.clipPath,
        touchAction: "none",
        overscrollBehavior: "contain",
      }}
      aria-label={`Collage cell ${index + 1}`}
    >
      <div
        className="relative block h-full w-full overflow-hidden bg-zinc-100"
        onTouchStart={preventPagePinchZoom}
        onTouchMove={preventPagePinchZoom}
        style={{
          borderRadius: frame.clipPath ? 0 : cornerRadius,
          border: borderWidth ? `${borderWidth}px solid ${borderColor}` : undefined,
          touchAction: "none",
          overscrollBehavior: "contain",
        }}
      >
        {isDropTarget && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-emerald-400/15 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-950">
            Drop here
          </div>
        )}
        {photo && src ? (
          <>
            {isLocalImageUrl(src) ? (
              <img
                src={src}
                alt={photo.fileName || `Photo ${index + 1}`}
                className="absolute inset-0 h-full w-full"
                style={imageStyle}
                draggable={false}
                onWheel={handleWheelZoom}
                onPointerDown={beginPan}
                onPointerMove={updatePan}
                onPointerUp={endPan}
                onPointerCancel={endPan}
              />
            ) : (
              <Image
                src={src}
                alt={photo.fileName || `Photo ${index + 1}`}
                fill
                sizes="(min-width: 1024px) 640px, 96vw"
                className="h-full w-full"
                style={imageStyle}
                draggable={false}
                onWheel={handleWheelZoom}
                onPointerDown={beginPan}
                onPointerMove={updatePan}
                onPointerUp={endPan}
                onPointerCancel={endPan}
                unoptimized
              />
            )}
            <button
              type="button"
              draggable
              onPointerDown={(event) => onMovePointerDown(event, index)}
              onDragStart={(event) => {
                event.stopPropagation();
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/x-collage-cell", String(index));
                onDesktopDragStart();
              }}
              onClick={(event) => event.stopPropagation()}
              className="absolute left-2 top-2 z-20 flex h-9 w-9 cursor-grab touch-none items-center justify-center rounded-full bg-black/75 text-white shadow-sm transition hover:bg-black active:cursor-grabbing sm:h-8 sm:w-8"
              aria-label={`Move photo ${index + 1}`}
              title="Move photo"
            >
              <Move className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              className="absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/75 text-white shadow-sm transition hover:bg-black sm:h-8 sm:w-8"
              aria-label={`Remove photo ${index + 1}`}
              title="Remove photo"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
            className="flex h-full w-full items-center justify-center text-zinc-400"
          >
            <ImagePlus className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}

export function CollageBuilderPage({ initialAlbumSlug }: CollageBuilderPageProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadedPhotosRef = useRef<CollagePhoto[]>([]);
  const draggedCellRef = useRef<number | null>(null);
  const draggedPhotoIdRef = useRef<string | null>(null);

  const [albumSlug, setAlbumSlug] = useState(initialAlbumSlug ?? "");
  const [eventSlug, setEventSlug] = useState("all");
  const [template, setTemplate] = useState<CollageTemplate>("grid_2x2");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [activeSourcePhotoId, setActiveSourcePhotoId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [personFilter, setPersonFilter] = useState("all");
  const [sortMode, setSortMode] = useState("gallery");
  const [borderWidth, setBorderWidth] = useState(4);
  const [borderColor, setBorderColor] = useState("#ffffff");
  const [backgroundColor, setBackgroundColor] = useState("#f6f1e8");
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("solid");
  const [cornerRadius, setCornerRadius] = useState(0);
  const [gap, setGap] = useState(8);
  const [fitMode, setFitMode] = useState<FitMode>("cover");
  const [imagePosition, setImagePosition] = useState<ImagePosition>("center");
  const [outputId, setOutputId] = useState("square");
  const [customWidth, setCustomWidth] = useState(1600);
  const [customHeight, setCustomHeight] = useState(1600);
  const [selectedCellIndex, setSelectedCellIndex] = useState(0);
  const [cellAdjustments, setCellAdjustments] = useState<Record<string, CellAdjustment>>({});
  const [originalUrls, setOriginalUrls] = useState<Record<string, string>>({});
  const [uploadedPhotos, setUploadedPhotos] = useState<CollagePhoto[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [moveDragState, setMoveDragState] = useState<MoveDragState | null>(null);
  const {
    googlePhotosButtonLabel,
    importFromGoogleDrive,
    importFromGooglePhotos,
    isImporting: isGoogleImporting,
    isImportingDrive,
    isImportingPhotos,
    message: googleImportMessage,
  } = useGoogleImageImport({
    onImages: (images) =>
      handleUploadedFiles(
        images.map((image) => image.file),
        images[0]?.source,
      ),
  });

  const { data: albumsData } = useSWR<{ albums: AlbumSummary[] }>("/api/albums", fetcher, swrOptions);

  useEffect(() => {
    if (albumSlug || !albumsData?.albums?.length) return;
    setAlbumSlug(albumsData.albums[0].slug);
  }, [albumSlug, albumsData?.albums]);

  useEffect(() => {
    if (!albumSlug) return;
    setIsPasswordVerified(sessionStorage.getItem(`album:${albumSlug}:verified`) === "true");
    setPassword("");
    setPasswordError("");
  }, [albumSlug]);

  const { data: albumData, error: albumError, isLoading: albumLoading } = useSWR<{ album: AlbumDetail }>(
    albumSlug ? `/api/albums/${encodeURIComponent(albumSlug)}` : null,
    fetcher,
    swrOptions,
  );

  const photosUrl = useMemo(() => {
    if (!albumSlug || !albumData?.album) return null;
    if (albumData.album.passwordRequired && !isPasswordVerified) return null;
    const params = new URLSearchParams();
    if (eventSlug !== "all") params.set("event", eventSlug);
    const queryString = params.toString();
    return `/api/albums/${encodeURIComponent(albumSlug)}/photos${queryString ? `?${queryString}` : ""}`;
  }, [albumData?.album, albumSlug, eventSlug, isPasswordVerified]);

  const { data: photosData, error: photosError, isLoading: photosLoading } = useSWR<{ photos: Photo[] }>(
    photosUrl,
    fetcher,
    {
      dedupingInterval: 60 * 1000,
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    setSelectedPhotoIds([]);
    setSelectedCellIndex(0);
    setOriginalUrls({});
  }, [albumSlug, eventSlug]);

  useEffect(() => {
    uploadedPhotosRef.current = uploadedPhotos;
  }, [uploadedPhotos]);

  useEffect(() => {
    return () => {
      for (const photo of uploadedPhotosRef.current) {
        if (photo.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
      }
    };
  }, []);

  const peopleOptions = useMemo(() => {
    const people = new Map<string, string>();
    for (const photo of photosData?.photos ?? []) {
      for (const person of photo.people ?? []) {
        people.set(person.id, person.displayName || person.defaultName);
      }
    }
    return Array.from(people, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [photosData?.photos]);

  const filteredPhotos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const photos = (photosData?.photos ?? []).filter((photo) => {
      if (personFilter !== "all" && !photo.people?.some((person) => person.id === personFilter)) return false;
      if (!normalized) return true;
      return photoSearchText(photo).includes(normalized);
    });

    if (sortMode === "file") return [...photos].sort((a, b) => (a.fileName || "").localeCompare(b.fileName || ""));
    return photos;
  }, [photosData?.photos, personFilter, query, sortMode]);

  const photoById = useMemo(() => {
    return new Map([...(photosData?.photos ?? []), ...uploadedPhotos].map((photo) => [photo.id, photo]));
  }, [photosData?.photos, uploadedPhotos]);

  const selectedPhotos = useMemo(() => selectedPhotoIds.map((id) => (id ? photoById.get(id) : undefined)), [photoById, selectedPhotoIds]);
  const selectedPhotoCount = selectedPhotoIds.filter(Boolean).length;

  const output = useMemo(() => {
    const selected = outputSizes.find((item) => item.id === outputId) ?? outputSizes[0];
    if (selected.id !== "custom") return selected;
    return { ...selected, width: Math.max(200, customWidth), height: Math.max(200, customHeight) };
  }, [customHeight, customWidth, outputId]);

  const frames = useMemo(() => framesForTemplate(template), [template]);
  const templateCount = templatePhotoCount(template);
  const assignedPhotos = selectedPhotos.slice(0, templateCount);
  const hasAssignedPhotos = assignedPhotos.some(Boolean);
  const selectedCellPhoto = assignedPhotos[selectedCellIndex];
  const selectedAdjustment = selectedCellPhoto ? normalizeAdjustment(cellAdjustments[selectedCellPhoto.id]) : defaultAdjustment;
  const selectedAlbum = albumData?.album;
  const isDiagonal = template === "diagonal_2" || template === "diagonal_4";

  useEffect(() => {
    if (!albumSlug || !selectedPhotoIds.some(Boolean)) return;
    let isCancelled = false;

    async function signOriginals() {
      const remotePhotoIds = selectedPhotoIds.filter((id) => id && !id.startsWith("local:"));
      if (!remotePhotoIds.length) {
        setOriginalUrls({});
        return;
      }

      const response = await fetch(`/api/albums/${encodeURIComponent(albumSlug)}/photos/signed-urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: remotePhotoIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to sign originals");
      if (isCancelled) return;

      const urls: Record<string, string> = {};
      for (const photo of data.photos ?? []) {
        urls[photo.id] = photo.originalUrl || photo.downloadUrl || photo.previewUrl || photo.thumbnailUrl || "";
      }
      setOriginalUrls(urls);
    }

    signOriginals().catch((error) => console.error("Error signing collage originals:", error));
    return () => {
      isCancelled = true;
    };
  }, [albumSlug, selectedPhotoIds]);

  const togglePhoto = (photoId: string) => {
    setActiveSourcePhotoId(photoId);
    setSelectedPhotoIds((current) => (current.includes(photoId) ? current : [...current, photoId]));
  };

  const placePhotoAtIndex = useCallback((photoId: string, photoIndex: number) => {
    setSelectedPhotoIds((current) => {
      const next = [...current];
      const existingIndex = next.indexOf(photoId);
      while (next.length <= photoIndex) next.push("");
      if (existingIndex >= 0) {
        [next[existingIndex], next[photoIndex]] = [next[photoIndex], next[existingIndex]];
        return trimTrailingEmptyIds(next);
      }
      next[photoIndex] = photoId;
      return trimTrailingEmptyIds(next);
    });
    setSelectedCellIndex(photoIndex);
    setActiveSourcePhotoId(null);
  }, []);

  const autoFill = () => {
    setSelectedPhotoIds(filteredPhotos.slice(0, templateCount).map((photo) => photo.id));
    setSelectedCellIndex(0);
  };

  const removePhotoAtIndex = useCallback((photoIndex: number) => {
    setSelectedPhotoIds((current) => {
      if (!current[photoIndex]) return current;
      const next = [...current];
      next[photoIndex] = "";
      return trimTrailingEmptyIds(next);
    });
    setSelectedCellIndex((current) => Math.max(0, Math.min(current, templateCount - 1)));
  }, [templateCount]);

  const handleUploadedFiles = (
    files: FileList | File[] | null,
    source?: "google-drive" | "google-photos",
  ) => {
    const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;

    const createdPhotos: CollagePhoto[] = imageFiles.map((file) => {
      const url = URL.createObjectURL(file);
      const sourceLabel =
        source === "google-drive"
          ? "Google Drive"
          : source === "google-photos"
            ? "Google Photos"
            : "Uploaded";
      return {
        id: `local:${crypto.randomUUID()}`,
        albumId: "local",
        albumSlug: albumSlug || "local",
        eventId: "local",
        eventSlug: source || "uploaded",
        eventName: sourceLabel,
        fileName: file.name,
        caption: null,
        searchText: file.name,
        previewUrl: url,
        thumbnailUrl: url,
        downloadUrl: url,
        width: null,
        height: null,
        originalS3Key: null,
        cleanPreviewS3Key: null,
        watermarkedPreviewS3Key: null,
        thumbnailS3Key: null,
        annotatedS3Key: null,
        people: [],
        isLocalUpload: true,
      };
    });

    setUploadedPhotos((current) => [...createdPhotos, ...current]);
    setActiveSourcePhotoId(createdPhotos[0]?.id ?? null);
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  };

  const shufflePhotos = () => {
    setSelectedPhotoIds((current) => {
      const next = [...current];
      for (let index = next.length - 1; index > 0; index -= 1) {
        const target = Math.floor(Math.random() * (index + 1));
        [next[index], next[target]] = [next[target], next[index]];
      }
      return next;
    });
  };

  const swapCells = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setSelectedPhotoIds((current) => {
      const next = [...current];
      if (!next[fromIndex]) return current;
      while (next.length <= toIndex) next.push("");
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return trimTrailingEmptyIds(next);
    });
    setSelectedCellIndex(toIndex);
  }, []);

  const handleSourceDragStart = (photoId: string) => {
    draggedPhotoIdRef.current = photoId;
    draggedCellRef.current = null;
    setActiveSourcePhotoId(photoId);
  };

  const handleCellSelect = (photoIndex: number) => {
    if (activeSourcePhotoId) {
      placePhotoAtIndex(activeSourcePhotoId, photoIndex);
      return;
    }
    setSelectedCellIndex(photoIndex);
  };

  const handleCellDrop = (photoIndex: number) => {
    if (draggedPhotoIdRef.current) {
      placePhotoAtIndex(draggedPhotoIdRef.current, photoIndex);
    } else if (draggedCellRef.current !== null) {
      swapCells(draggedCellRef.current, photoIndex);
    }
    draggedPhotoIdRef.current = null;
    draggedCellRef.current = null;
  };

  const updateCellAdjustment = useCallback((photoId: string, partial: Partial<CellAdjustment>) => {
    setCellAdjustments((current) => ({
      ...current,
      [photoId]: {
        ...normalizeAdjustment(current[photoId]),
        ...partial,
      },
    }));
  }, []);

  const updateSelectedAdjustment = (partial: Partial<CellAdjustment>) => {
    if (!selectedCellPhoto) return;
    updateCellAdjustment(selectedCellPhoto.id, partial);
  };

  const handleMovePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, fromIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedCellIndex(fromIndex);
    event.currentTarget.setPointerCapture(event.pointerId);
    setMoveDragState({
      fromIndex,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
      targetIndex: null,
    });
  };

  useEffect(() => {
    if (!moveDragState) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== moveDragState.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - moveDragState.startX;
      const dy = event.clientY - moveDragState.startY;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-collage-cell-index]");
      const targetIndexValue = target?.getAttribute("data-collage-cell-index");
      const nextTargetIndex = targetIndexValue !== null && targetIndexValue !== undefined ? Number(targetIndexValue) : null;

      setMoveDragState((current) =>
        current
          ? {
              ...current,
              x: event.clientX,
              y: event.clientY,
              active: current.active || Math.abs(dx) > 4 || Math.abs(dy) > 4,
              targetIndex: Number.isFinite(nextTargetIndex) ? nextTargetIndex : null,
            }
          : current,
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== moveDragState.pointerId) return;
      event.preventDefault();
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-collage-cell-index]");
      const targetIndex = target?.getAttribute("data-collage-cell-index");
      const toIndex = moveDragState.targetIndex ?? (targetIndex !== null && targetIndex !== undefined ? Number(targetIndex) : null);
      if (Number.isFinite(toIndex)) swapCells(moveDragState.fromIndex, Number(toIndex));
      setMoveDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp, { passive: false });
    window.addEventListener("pointercancel", handlePointerUp, { passive: false });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [moveDragState, swapCells]);

  const verifyAlbumPassword = async () => {
    if (!albumSlug || !password || isVerifyingPassword) return;
    setIsVerifyingPassword(true);
    setPasswordError("");

    try {
      const response = await fetch(`/api/albums/${encodeURIComponent(albumSlug)}/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { ok?: boolean };
      if (!response.ok || !data.ok) {
        setPasswordError("Wrong code.");
        return;
      }
      sessionStorage.setItem(`album:${albumSlug}:verified`, "true");
      setIsPasswordVerified(true);
      setPassword("");
    } catch {
      setPasswordError("Wrong code.");
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const drawBackground = async (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (backgroundMode === "transparent") {
      ctx.clearRect(0, 0, width, height);
      return;
    }

    if (backgroundMode === "gradient") {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, backgroundColor);
      gradient.addColorStop(1, borderColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      return;
    }

    if (backgroundMode === "blur" && assignedPhotos[0]) {
      const firstUrl = resolvePhotoUrl(assignedPhotos[0], originalUrls);
      if (firstUrl) {
        try {
          const image = await loadCanvasImage(firstUrl);
          ctx.save();
          ctx.filter = "blur(28px)";
          drawImageInRect(ctx, image, -40, -40, width + 80, height + 80, "cover", "center", defaultAdjustment);
          ctx.restore();
          ctx.fillStyle = "rgba(255,255,255,.22)";
          ctx.fillRect(0, 0, width, height);
          return;
        } catch {}
      }
    }

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  };

  const exportImage = async (format: "png" | "jpeg") => {
    if (!hasAssignedPhotos) return;
    setIsExporting(true);
    setExportError("");

    try {
      const canvas = document.createElement("canvas");
      canvas.width = output.width;
      canvas.height = output.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas export is unavailable");

      await drawBackground(ctx, output.width, output.height);

      const imageCache = new Map<string, HTMLImageElement>();
      for (const photo of assignedPhotos) {
        if (!photo) continue;
        const src = resolvePhotoUrl(photo, originalUrls);
        if (!src) continue;
        imageCache.set(photo.id, await loadCanvasImage(src));
      }

      const scale = Math.min(output.width, output.height) / 1080;
      const scaledGap = gap * scale;
      const scaledBorder = borderWidth * scale;
      const scaledRadius = cornerRadius * scale;

      if (template === "diagonal_2") {
        const polygons = [
          [
            [0, 0],
            [output.width, 0],
            [0, output.height],
          ],
          [
            [output.width, 0],
            [output.width, output.height],
            [0, output.height],
          ],
        ];
        polygons.forEach((polygon, index) => {
          const photo = assignedPhotos[index];
          const image = photo ? imageCache.get(photo.id) : null;
          if (!photo || !image) return;
          ctx.save();
          ctx.beginPath();
          polygon.forEach(([x, y], pointIndex) => {
            if (pointIndex === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.clip();
          drawImageInRect(ctx, image, 0, 0, output.width, output.height, fitMode, imagePosition, normalizeAdjustment(cellAdjustments[photo.id]));
          ctx.restore();
        });
        if (scaledBorder) {
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = scaledBorder;
          ctx.beginPath();
          ctx.moveTo(0, output.height);
          ctx.lineTo(output.width, 0);
          ctx.stroke();
        }
      } else if (template === "diagonal_4") {
        const polygons = [
          [
            [0, 0],
            [output.width / 2, output.height / 2],
            [0, output.height],
          ],
          [
            [0, 0],
            [output.width, 0],
            [output.width / 2, output.height / 2],
          ],
          [
            [output.width, 0],
            [output.width, output.height],
            [output.width / 2, output.height / 2],
          ],
          [
            [output.width, output.height],
            [0, output.height],
            [output.width / 2, output.height / 2],
          ],
        ];
        polygons.forEach((polygon, index) => {
          const photo = assignedPhotos[index];
          const image = photo ? imageCache.get(photo.id) : null;
          if (!photo || !image) return;
          ctx.save();
          ctx.beginPath();
          polygon.forEach(([x, y], pointIndex) => {
            if (pointIndex === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.clip();
          drawImageInRect(ctx, image, 0, 0, output.width, output.height, fitMode, imagePosition, normalizeAdjustment(cellAdjustments[photo.id]));
          ctx.restore();
        });
        if (scaledBorder) {
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = scaledBorder;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(output.width, output.height);
          ctx.moveTo(output.width, 0);
          ctx.lineTo(0, output.height);
          ctx.stroke();
        }
      } else {
        for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
          const frame = frames[frameIndex];
          const photo = assignedPhotos[frame.photoIndex ?? frameIndex];
          const image = photo ? imageCache.get(photo.id) : null;
          if (!photo || !image) continue;

          const x = frame.x * output.width + scaledGap / 2;
          const y = frame.y * output.height + scaledGap / 2;
          const w = frame.w * output.width - scaledGap;
          const h = frame.h * output.height - scaledGap;
          const adjustment = normalizeAdjustment(cellAdjustments[photo.id]);

          ctx.save();
          roundedRect(ctx, x, y, w, h, scaledRadius);
          ctx.clip();
          drawImageInRect(ctx, image, x, y, w, h, fitMode, imagePosition, adjustment);
          ctx.restore();

          if (scaledBorder) {
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = scaledBorder;
            roundedRect(ctx, x + scaledBorder / 2, y + scaledBorder / 2, w - scaledBorder, h - scaledBorder, scaledRadius);
            ctx.stroke();
          }
        }
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setExportError("Export failed. Try PNG or a smaller output size.");
            return;
          }
          downloadBlob(blob, `${albumSlug || "collage"}-${template}.${format === "png" ? "png" : "jpg"}`);
        },
        format === "png" ? "image/png" : "image/jpeg",
        0.92,
      );
    } catch (error) {
      console.error("Collage export failed:", error);
      setExportError("Export failed. The browser may be blocked from reading one of the signed S3 images.");
    } finally {
      setIsExporting(false);
    }
  };

  const previewBackgroundStyle = useMemo(() => {
    if (backgroundMode === "transparent") {
      return {
        backgroundColor: "transparent",
        backgroundImage:
          "linear-gradient(45deg, #e4e4e7 25%, transparent 25%), linear-gradient(-45deg, #e4e4e7 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e4e4e7 75%), linear-gradient(-45deg, transparent 75%, #e4e4e7 75%)",
        backgroundSize: "22px 22px",
        backgroundPosition: "0 0, 0 11px, 11px -11px, -11px 0px",
      };
    }
    if (backgroundMode === "gradient") return { backgroundImage: `linear-gradient(135deg, ${backgroundColor}, ${borderColor})` };
    return { backgroundColor };
  }, [backgroundColor, backgroundMode, borderColor]);

  const draggingPhoto = moveDragState ? assignedPhotos[moveDragState.fromIndex] : undefined;
  const draggingPhotoSrc = draggingPhoto ? resolvePhotoUrl(draggingPhoto, originalUrls) : "";

  if (selectedAlbum?.passwordRequired && !isPasswordVerified) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f4] px-4 text-zinc-950">
        <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <Button asChild variant="ghost" className="mb-5 px-0">
            <Link href={`/albums/${encodeURIComponent(albumSlug)}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to album
            </Link>
          </Button>

          <p className="text-sm font-medium uppercase tracking-[0.08em] text-zinc-500">Collage Builder</p>
          <h1 className="mt-1 text-2xl font-semibold">{selectedAlbum.customer?.name || selectedAlbum.name}</h1>
          <div className="mt-6 space-y-3">
            <Input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (passwordError) setPasswordError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") verifyAlbumPassword();
              }}
              placeholder="Access code"
              aria-label="Access code"
            />
            {passwordError && <p className="text-sm font-medium text-rose-600">{passwordError}</p>}
            <Button className="w-full" onClick={verifyAlbumPassword} disabled={!password || isVerifyingPassword}>
              Continue
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-[#f7f7f4]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3 px-3 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" size="icon" className="rounded-full">
              <Link href={albumSlug ? `/albums/${encodeURIComponent(albumSlug)}` : "/albums"} aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500 sm:text-xs">Collage Builder</p>
              <h1 className="truncate text-base font-semibold sm:text-2xl">
                {selectedAlbum?.customer?.name || selectedAlbum?.name || "Select an album"}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="outline" onClick={autoFill} disabled={!filteredPhotos.length}>
                <ImagePlus className="h-4 w-4" />
                Auto Fill
              </Button>
              <Button variant="outline" onClick={shufflePhotos} disabled={selectedPhotoCount < 2}>
                <Shuffle className="h-4 w-4" />
                Shuffle
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={!hasAssignedPhotos || isExporting}>
                    <Download className="h-4 w-4" />
                    Download
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onSelect={() => exportImage("png")}>PNG</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => exportImage("jpeg")}>JPG</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <AuthAvatarMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1800px] gap-4 px-3 py-3 sm:px-6 sm:py-4 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
        <aside className="order-2 space-y-4 lg:order-1 lg:sticky lg:top-[76px] lg:max-h-[calc(100svh-96px)] lg:overflow-y-auto lg:pr-1">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Album</Label>
                <Select
                  value={albumSlug}
                  onValueChange={(value) => {
                    setAlbumSlug(value);
                    setEventSlug("all");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select album" />
                  </SelectTrigger>
                  <SelectContent>
                    {(albumsData?.albums ?? []).map((album) => (
                      <SelectItem key={album.id} value={album.slug}>
                        {album.customer?.name || album.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Event</Label>
                <Select value={eventSlug} onValueChange={setEventSlug} disabled={!selectedAlbum}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All events" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    {(selectedAlbum?.events ?? []).map((event) => (
                      <SelectItem key={event.id} value={event.slug}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={autoFill} disabled={!filteredPhotos.length}>
                  <ImagePlus className="h-4 w-4" />
                  Auto Fill
                </Button>
                <Button variant="outline" onClick={() => setSelectedPhotoIds([])} disabled={!selectedPhotoCount}>
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              </div>
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => handleUploadedFiles(event.target.files)}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => uploadInputRef.current?.click()}
                disabled={isGoogleImporting}
              >
                <Upload className="h-4 w-4" />
                Upload from Device
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => void importFromGoogleDrive()}
                disabled={isGoogleImporting}
              >
                {isImportingDrive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudDownload className="h-4 w-4" />
                )}
                Upload from Google Drive
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => void importFromGooglePhotos()}
                disabled={isGoogleImporting}
              >
                {isImportingPhotos ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Images className="h-4 w-4" />
                )}
                {googlePhotosButtonLabel}
              </Button>
              {googleImportMessage && (
                <p className="rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-600">
                  {googleImportMessage}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Photos</h2>
                <p className="text-sm text-zinc-500">
                  {selectedPhotoCount} selected / {templateCount} needed
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={shufflePhotos} disabled={selectedPhotoCount < 2} aria-label="Shuffle photos">
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>

            {uploadedPhotos.length > 0 && (
              <div className="mb-4 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">Uploaded images</p>
                  <span className="text-xs text-zinc-500">{uploadedPhotos.length}</span>
                </div>
                <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto pr-1">
                  {uploadedPhotos.map((photo) => (
                    <PhotoTile
                      key={photo.id}
                      photo={photo}
                      selected={selectedPhotoIds.includes(photo.id)}
                      active={activeSourcePhotoId === photo.id}
                      onToggle={() => togglePhoto(photo.id)}
                      onDragStart={() => handleSourceDragStart(photo.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search photos or people" />
              <div className="grid grid-cols-2 gap-2">
                <Select value={personFilter} onValueChange={setPersonFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="People" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All People</SelectItem>
                    {peopleOptions.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortMode} onValueChange={setSortMode}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gallery">Uploaded Date</SelectItem>
                    <SelectItem value="file">File Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 grid max-h-[360px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:max-h-[520px]">
              {(albumLoading || photosLoading) && Array.from({ length: 18 }).map((_, index) => <Skeleton key={index} className="aspect-square rounded-md" />)}
              {!albumLoading &&
                !photosLoading &&
                filteredPhotos.map((photo) => (
                  <PhotoTile
                    key={photo.id}
                    photo={photo}
                    selected={selectedPhotoIds.includes(photo.id)}
                    active={activeSourcePhotoId === photo.id}
                    onToggle={() => togglePhoto(photo.id)}
                    onDragStart={() => handleSourceDragStart(photo.id)}
                  />
                ))}
            </div>

            {(albumError || photosError) && <p className="mt-3 text-sm font-medium text-rose-600">Failed to load album photos.</p>}
            {!photosLoading && selectedAlbum && filteredPhotos.length === 0 && (
              <p className="mt-4 rounded-md bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">No photos match these filters.</p>
            )}
          </section>
        </aside>

        <section className="order-1 min-w-0 lg:order-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-sm font-medium text-zinc-500">Live preview</p>
              <h2 className="text-lg font-semibold sm:text-xl">
                {output.name} / {output.width} x {output.height}
              </h2>
              <p className="mt-1 text-xs text-zinc-500 sm:hidden">Tap a photo, drag inside to reposition, use top-left handle to move.</p>
            </div>
            <div className="flex gap-2 sm:hidden">
              <Button variant="outline" onClick={autoFill} disabled={!filteredPhotos.length} size="sm">
                Fill
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={!hasAssignedPhotos || isExporting} size="sm">Download</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onSelect={() => exportImage("png")}>PNG</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => exportImage("jpeg")}>JPG</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-950/5 p-2 shadow-inner sm:p-6">
            <div
              ref={previewRef}
              className="relative mx-auto max-h-[68svh] w-full max-w-[960px] overflow-hidden shadow-2xl ring-1 ring-black/10 sm:max-h-[calc(100svh-170px)]"
              style={{ aspectRatio: `${output.width} / ${output.height}`, ...previewBackgroundStyle }}
            >
              {backgroundMode === "blur" && assignedPhotos[0] && resolvePhotoUrl(assignedPhotos[0], originalUrls) &&
                (isLocalImageUrl(resolvePhotoUrl(assignedPhotos[0], originalUrls)) ? (
                  <img src={resolvePhotoUrl(assignedPhotos[0], originalUrls)} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl" />
                ) : (
                  <Image
                    src={resolvePhotoUrl(assignedPhotos[0], originalUrls)}
                    alt=""
                    fill
                    sizes="960px"
                    className="scale-110 object-cover blur-2xl"
                    unoptimized
                  />
                ))}
              <div className="absolute inset-0">
                {frames.map((frame, frameIndex) => {
                  const photoIndex = frame.photoIndex ?? frameIndex;
                  const photo = assignedPhotos[photoIndex];
                  const adjustment = photo ? normalizeAdjustment(cellAdjustments[photo.id]) : defaultAdjustment;
                  return (
                    <CollageCell
                      key={`${template}-${frameIndex}`}
                      photo={photo}
                      src={photo ? resolvePhotoUrl(photo, originalUrls) : ""}
                      frame={frame}
                      index={photoIndex}
                      selected={selectedCellIndex === photoIndex}
                      fitMode={fitMode}
                      imagePosition={imagePosition}
                      adjustment={adjustment}
                      cornerRadius={cornerRadius}
                      borderWidth={borderWidth}
                      borderColor={borderColor}
                      gap={gap}
                      moveDragState={moveDragState}
                      dropTargetIndex={moveDragState?.targetIndex ?? null}
                      onSelect={() => handleCellSelect(photoIndex)}
                      onDesktopDragStart={() => {
                        draggedCellRef.current = photoIndex;
                        draggedPhotoIdRef.current = null;
                      }}
                      onDrop={() => handleCellDrop(photoIndex)}
                      onRemove={() => removePhotoAtIndex(photoIndex)}
                      onAdjustChange={(partial) => {
                        if (!photo) return;
                        updateCellAdjustment(photo.id, partial);
                      }}
                      onMovePointerDown={handleMovePointerDown}
                    />
                  );
                })}

                {isDiagonal && borderWidth > 0 && (
                  <div className="pointer-events-none absolute inset-0">
                    {template === "diagonal_2" ? (
                      <div
                        className="absolute left-1/2 top-1/2 h-[150%] origin-center -translate-x-1/2 -translate-y-1/2 rotate-45"
                        style={{ width: borderWidth, backgroundColor: borderColor }}
                      />
                    ) : (
                      <>
                        <div
                          className="absolute left-1/2 top-1/2 h-[150%] origin-center -translate-x-1/2 -translate-y-1/2 rotate-45"
                          style={{ width: borderWidth, backgroundColor: borderColor }}
                        />
                        <div
                          className="absolute left-1/2 top-1/2 h-[150%] origin-center -translate-x-1/2 -translate-y-1/2 -rotate-45"
                          style={{ width: borderWidth, backgroundColor: borderColor }}
                        />
                      </>
                    )}
                  </div>
                )}

                {!hasAssignedPhotos && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-sm font-medium text-zinc-500">
                    Select photos or use Auto Fill
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="order-3 space-y-4 lg:sticky lg:top-[76px] lg:max-h-[calc(100svh-96px)] lg:overflow-y-auto lg:pl-1">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-zinc-500" />
              <h2 className="font-semibold">Layout Templates</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTemplate(item.id);
                    setSelectedCellIndex(0);
                    setMoveDragState(null);
                  }}
                  className={`rounded-md border p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                    template === item.id ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white hover:border-zinc-400"
                  }`}
                >
                  <TemplateGlyph template={item.id} />
                  <span className="mt-2 block truncate text-xs font-semibold">{item.name}</span>
                  <span className={`block text-[11px] ${template === item.id ? "text-white/65" : "text-zinc-500"}`}>{item.photos} photos</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Borders & Color</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line thickness</Label>
                  <span className="text-sm text-zinc-500">{borderWidth}px</span>
                </div>
                <Slider value={[borderWidth]} min={0} max={40} step={1} onValueChange={([value]) => setBorderWidth(value)} />
              </div>
              <div className="space-y-2">
                <Label>Line color</Label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setBorderColor(color)}
                      className={`h-8 w-8 rounded-full border shadow-sm ${borderColor === color ? "ring-2 ring-zinc-950 ring-offset-2" : "ring-1 ring-zinc-200"}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Use ${color} border`}
                    />
                  ))}
                  <Input type="color" value={borderColor} onChange={(event) => setBorderColor(event.target.value)} className="h-8 w-12 p-1" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Gap</Label>
                  <span className="text-sm text-zinc-500">{gap}px</span>
                </div>
                <Slider value={[gap]} min={0} max={60} step={1} onValueChange={([value]) => setGap(value)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Corner radius</Label>
                  <span className="text-sm text-zinc-500">{cornerRadius}px</span>
                </div>
                <Slider value={[cornerRadius]} min={0} max={48} step={1} onValueChange={([value]) => setCornerRadius(value)} />
              </div>
              <div className="space-y-2">
                <Label>Background</Label>
                <Select value={backgroundMode} onValueChange={(value) => setBackgroundMode(value as BackgroundMode)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid Color</SelectItem>
                    <SelectItem value="transparent">Transparent</SelectItem>
                    <SelectItem value="gradient">Gradient</SelectItem>
                    <SelectItem value="blur">Blur From First Photo</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} className="h-9 w-full p-1" />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Image Fit</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-1 rounded-md bg-zinc-100 p-1">
                {(["cover", "contain", "fill"] as FitMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFitMode(mode)}
                    className={`h-8 rounded text-sm font-medium capitalize ${fitMode === mode ? "bg-white shadow-sm" : "text-zinc-600"}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <Select value={imagePosition} onValueChange={(value) => setImagePosition(value as ImagePosition)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Cell zoom</Label>
                  <span className="text-sm text-zinc-500">{selectedAdjustment.zoom.toFixed(2)}x</span>
                </div>
                <Slider
                  value={[selectedAdjustment.zoom]}
                  min={0.6}
                  max={2.4}
                  step={0.05}
                  onValueChange={([value]) => updateSelectedAdjustment({ zoom: value })}
                  disabled={!selectedCellPhoto}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Cell rotate</Label>
                  <span className="text-sm text-zinc-500">{selectedAdjustment.rotate}deg</span>
                </div>
                <Slider
                  value={[selectedAdjustment.rotate]}
                  min={-30}
                  max={30}
                  step={1}
                  onValueChange={([value]) => updateSelectedAdjustment({ rotate: value })}
                  disabled={!selectedCellPhoto}
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => updateSelectedAdjustment({ zoom: 1, rotate: 0, offsetX: 0, offsetY: 0 })}
                disabled={!selectedCellPhoto}
              >
                <RefreshCcw className="h-4 w-4" />
                Reset Cell
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Export Settings</h2>
            <div className="space-y-3">
              <Select value={outputId} onValueChange={setOutputId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {outputSizes.map((size) => (
                    <SelectItem key={size.id} value={size.id}>{size.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {outputId === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" value={customWidth} min={200} onChange={(event) => setCustomWidth(Number(event.target.value) || 1600)} aria-label="Custom width" />
                  <Input type="number" value={customHeight} min={200} onChange={(event) => setCustomHeight(Number(event.target.value) || 1600)} aria-label="Custom height" />
                </div>
              )}
              <div className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2">
                <Checkbox checked={backgroundMode === "transparent"} onCheckedChange={(checked) => setBackgroundMode(checked ? "transparent" : "solid")} id="transparent-background" />
                <Label htmlFor="transparent-background" className="text-sm">Transparent background</Label>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={!hasAssignedPhotos || isExporting} className="w-full">
                    <Download className="h-4 w-4" />
                    Download
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onSelect={() => exportImage("png")}>PNG</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => exportImage("jpeg")}>JPG</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" disabled className="w-full" title="Saving collages requires the optional collages table and upload endpoint.">
                Save to Album
              </Button>
              {exportError && <p className="text-sm font-medium text-rose-600">{exportError}</p>}
            </div>
          </section>
        </aside>
      </div>

      {moveDragState?.active && draggingPhoto && draggingPhotoSrc && (
        <div
          className="pointer-events-none fixed z-[100] h-24 w-24 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border-2 border-white bg-zinc-100 shadow-2xl ring-4 ring-emerald-500"
          style={{ left: moveDragState.x, top: moveDragState.y }}
        >
          {isLocalImageUrl(draggingPhotoSrc) ? (
            <img src={draggingPhotoSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <Image src={draggingPhotoSrc} alt="" fill sizes="96px" className="object-cover" unoptimized />
          )}
        </div>
      )}
    </main>
  );
}

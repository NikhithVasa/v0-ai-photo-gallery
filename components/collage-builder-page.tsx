"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowLeft,
  Check,
  Download,
  ImagePlus,
  LayoutTemplate,
  RefreshCcw,
  Shuffle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
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
}

interface CellAdjustment {
  zoom: number;
  rotate: number;
}

interface CollageBuilderPageProps {
  initialAlbumSlug?: string;
}

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

function chunkGrid(columns: number, rows: number, count = columns * rows) {
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
    case "diagonal_2":
    case "diagonal_4":
      return [];
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
    image.crossOrigin = "anonymous";
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
    if (imageRatio > rectRatio) drawH = h;
    else drawW = w;

    if (imageRatio > rectRatio) drawW = h * imageRatio;
    else drawH = w / imageRatio;
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
  onToggle,
}: {
  photo: Photo;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group relative aspect-square overflow-hidden rounded-md bg-zinc-100 text-left ring-offset-2 transition focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
        selected ? "ring-2 ring-zinc-950" : "ring-1 ring-zinc-200 hover:ring-zinc-400"
      }`}
      aria-pressed={selected}
    >
      {(photo.thumbnailUrl || photo.previewUrl) && (
        <Image
          src={photo.thumbnailUrl || photo.previewUrl || ""}
          alt={photo.fileName || "Photo"}
          fill
          sizes="132px"
          className="object-cover transition group-hover:scale-[1.03]"
          unoptimized
        />
      )}
      <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-sm">
        {selected && <Check className="h-4 w-4 text-zinc-950" />}
      </span>
      <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 to-transparent px-2 pb-2 pt-8 text-[11px] font-medium text-white">
        {photo.eventName}
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
  onSelect,
  onDragStart,
  onDrop,
}: {
  photo?: Photo;
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
  onSelect: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  return (
    <button
      type="button"
      draggable={Boolean(photo)}
      onClick={onSelect}
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={`absolute overflow-hidden bg-zinc-200 transition focus:outline-none ${
        selected ? "ring-2 ring-sky-500 ring-offset-2" : ""
      }`}
      style={{
        left: `${frame.x * 100}%`,
        top: `${frame.y * 100}%`,
        width: `${frame.w * 100}%`,
        height: `${frame.h * 100}%`,
        padding: `${gap / 2}px`,
      }}
      aria-label={`Collage cell ${index + 1}`}
    >
      <span
        className="relative block h-full w-full overflow-hidden bg-zinc-100"
        style={{
          borderRadius: cornerRadius,
          border: borderWidth ? `${borderWidth}px solid ${borderColor}` : undefined,
        }}
      >
        {photo && src ? (
          <Image
            src={src}
            alt={photo.fileName || `Photo ${index + 1}`}
            fill
            sizes="(min-width: 1024px) 640px, 90vw"
            className="h-full w-full"
            style={{
              objectFit: fitMode,
              objectPosition: imagePosition,
              transform: `scale(${adjustment.zoom}) rotate(${adjustment.rotate}deg)`,
            }}
            unoptimized
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-zinc-400">
            <ImagePlus className="h-6 w-6" />
          </span>
        )}
      </span>
    </button>
  );
}

export function CollageBuilderPage({ initialAlbumSlug }: CollageBuilderPageProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const draggedCellRef = useRef<number | null>(null);

  const [albumSlug, setAlbumSlug] = useState(initialAlbumSlug ?? "");
  const [eventSlug, setEventSlug] = useState("all");
  const [template, setTemplate] = useState<CollageTemplate>("grid_2x2");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
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
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  const { data: albumsData } = useSWR<{ albums: AlbumSummary[] }>(
    "/api/albums",
    fetcher,
    swrOptions,
  );

  useEffect(() => {
    if (albumSlug || !albumsData?.albums?.length) return;
    setAlbumSlug(albumsData.albums[0].slug);
  }, [albumSlug, albumsData?.albums]);

  useEffect(() => {
    if (!albumSlug) return;
    setIsPasswordVerified(
      sessionStorage.getItem(`album:${albumSlug}:verified`) === "true",
    );
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

  const peopleOptions = useMemo(() => {
    const people = new Map<string, string>();
    for (const photo of photosData?.photos ?? []) {
      for (const person of photo.people ?? []) {
        people.set(person.id, person.displayName || person.defaultName);
      }
    }
    return Array.from(people, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [photosData?.photos]);

  const filteredPhotos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const photos = (photosData?.photos ?? []).filter((photo) => {
      if (personFilter !== "all" && !photo.people?.some((person) => person.id === personFilter)) {
        return false;
      }
      if (!normalized) return true;
      return photoSearchText(photo).includes(normalized);
    });

    if (sortMode === "file") {
      return [...photos].sort((a, b) => (a.fileName || "").localeCompare(b.fileName || ""));
    }

    return photos;
  }, [photosData?.photos, personFilter, query, sortMode]);

  const photoById = useMemo(() => {
    return new Map((photosData?.photos ?? []).map((photo) => [photo.id, photo]));
  }, [photosData?.photos]);

  const selectedPhotos = useMemo(() => {
    return selectedPhotoIds
      .map((id) => photoById.get(id))
      .filter((photo): photo is Photo => Boolean(photo));
  }, [photoById, selectedPhotoIds]);

  const output = useMemo(() => {
    const selected = outputSizes.find((item) => item.id === outputId) ?? outputSizes[0];
    if (selected.id !== "custom") return selected;
    return {
      ...selected,
      width: Math.max(200, customWidth),
      height: Math.max(200, customHeight),
    };
  }, [customHeight, customWidth, outputId]);

  const frames = useMemo(() => framesForTemplate(template), [template]);
  const templateCount = templatePhotoCount(template);
  const assignedPhotos = selectedPhotos.slice(0, templateCount);
  const selectedCellPhoto = assignedPhotos[selectedCellIndex];
  const selectedAdjustment = selectedCellPhoto
    ? cellAdjustments[selectedCellPhoto.id] ?? { zoom: 1, rotate: 0 }
    : { zoom: 1, rotate: 0 };

  useEffect(() => {
    if (!albumSlug || !selectedPhotoIds.length) return;

    let isCancelled = false;

    async function signOriginals() {
      const response = await fetch(`/api/albums/${encodeURIComponent(albumSlug)}/photos/signed-urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedPhotoIds }),
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

    signOriginals().catch((error) => {
      console.error("Error signing collage originals:", error);
    });

    return () => {
      isCancelled = true;
    };
  }, [albumSlug, selectedPhotoIds]);

  const togglePhoto = (photoId: string) => {
    setSelectedPhotoIds((current) =>
      current.includes(photoId)
        ? current.filter((id) => id !== photoId)
        : [...current, photoId],
    );
  };

  const autoFill = () => {
    setSelectedPhotoIds(filteredPhotos.slice(0, templateCount).map((photo) => photo.id));
    setSelectedCellIndex(0);
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

  const swapCells = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setSelectedPhotoIds((current) => {
      const next = [...current];
      if (!next[fromIndex] || !next[toIndex]) return current;
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
  };

  const updateSelectedAdjustment = (partial: Partial<CellAdjustment>) => {
    if (!selectedCellPhoto) return;
    setCellAdjustments((current) => ({
      ...current,
      [selectedCellPhoto.id]: {
        ...current[selectedCellPhoto.id],
        zoom: current[selectedCellPhoto.id]?.zoom ?? 1,
        rotate: current[selectedCellPhoto.id]?.rotate ?? 0,
        ...partial,
      },
    }));
  };

  const verifyAlbumPassword = async () => {
    if (!albumSlug || !password || isVerifyingPassword) return;

    setIsVerifyingPassword(true);
    setPasswordError("");

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/verify-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );
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
          drawImageInRect(ctx, image, -40, -40, width + 80, height + 80, "cover", "center", {
            zoom: 1,
            rotate: 0,
          });
          ctx.restore();
          ctx.fillStyle = "rgba(255,255,255,.22)";
          ctx.fillRect(0, 0, width, height);
          return;
        } catch {
          // Fall back to solid fill when the source cannot be exported by the browser.
        }
      }
    }

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  };

  const exportImage = async (format: "png" | "jpeg") => {
    if (!assignedPhotos.length) return;

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
          if (!image) return;
          ctx.save();
          ctx.beginPath();
          polygon.forEach(([x, y], pointIndex) => {
            if (pointIndex === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.clip();
          drawImageInRect(ctx, image, 0, 0, output.width, output.height, fitMode, imagePosition, {
            zoom: cellAdjustments[photo.id]?.zoom ?? 1,
            rotate: cellAdjustments[photo.id]?.rotate ?? 0,
          });
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
          if (!image) return;
          ctx.save();
          ctx.beginPath();
          polygon.forEach(([x, y], pointIndex) => {
            if (pointIndex === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.clip();
          drawImageInRect(ctx, image, 0, 0, output.width, output.height, fitMode, imagePosition, {
            zoom: cellAdjustments[photo.id]?.zoom ?? 1,
            rotate: cellAdjustments[photo.id]?.rotate ?? 0,
          });
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
          const adjustment = cellAdjustments[photo.id] ?? { zoom: 1, rotate: 0 };

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
      setExportError(
        "Export failed. The browser may be blocked from reading one of the signed S3 images.",
      );
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
    if (backgroundMode === "gradient") {
      return { backgroundImage: `linear-gradient(135deg, ${backgroundColor}, ${borderColor})` };
    }
    return { backgroundColor };
  }, [backgroundColor, backgroundMode, borderColor]);

  const selectedAlbum = albumData?.album;
  const isDiagonal = template === "diagonal_2" || template === "diagonal_4";

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

          <p className="text-sm font-medium uppercase tracking-[0.08em] text-zinc-500">
            Collage Builder
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {selectedAlbum.customer?.name || selectedAlbum.name}
          </h1>
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
            {passwordError && (
              <p className="text-sm font-medium text-rose-600">
                {passwordError}
              </p>
            )}
            <Button
              className="w-full"
              onClick={verifyAlbumPassword}
              disabled={!password || isVerifyingPassword}
            >
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
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="rounded-full">
              <Link href={albumSlug ? `/albums/${encodeURIComponent(albumSlug)}` : "/albums"} aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">Collage Builder</p>
              <h1 className="truncate text-lg font-semibold sm:text-2xl">
                {selectedAlbum?.customer?.name || selectedAlbum?.name || "Select an album"}
              </h1>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <Button variant="outline" onClick={autoFill} disabled={!filteredPhotos.length}>
              <ImagePlus className="h-4 w-4" />
              Auto Fill
            </Button>
            <Button variant="outline" onClick={shufflePhotos} disabled={selectedPhotoIds.length < 2}>
              <Shuffle className="h-4 w-4" />
              Shuffle
            </Button>
            <Button onClick={() => exportImage("png")} disabled={!assignedPhotos.length || isExporting}>
              <Download className="h-4 w-4" />
              PNG
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1800px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
        <aside className="space-y-4 lg:sticky lg:top-[76px] lg:max-h-[calc(100svh-96px)] lg:overflow-y-auto lg:pr-1">
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
                <Button variant="outline" onClick={() => setSelectedPhotoIds([])} disabled={!selectedPhotoIds.length}>
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Photos</h2>
                <p className="text-sm text-zinc-500">
                  {selectedPhotoIds.length} selected / {templateCount} needed
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={shufflePhotos} disabled={selectedPhotoIds.length < 2} aria-label="Shuffle photos">
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>

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

            <div className="mt-4 grid max-h-[520px] grid-cols-3 gap-2 overflow-y-auto pr-1">
              {(albumLoading || photosLoading) &&
                Array.from({ length: 18 }).map((_, index) => (
                  <Skeleton key={index} className="aspect-square rounded-md" />
                ))}
              {!albumLoading &&
                !photosLoading &&
                filteredPhotos.map((photo) => (
                  <PhotoTile
                    key={photo.id}
                    photo={photo}
                    selected={selectedPhotoIds.includes(photo.id)}
                    onToggle={() => togglePhoto(photo.id)}
                  />
                ))}
            </div>

            {(albumError || photosError) && (
              <p className="mt-3 text-sm font-medium text-rose-600">Failed to load album photos.</p>
            )}
            {!photosLoading && selectedAlbum && filteredPhotos.length === 0 && (
              <p className="mt-4 rounded-md bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                No photos match these filters.
              </p>
            )}
          </section>
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-sm font-medium text-zinc-500">Live preview</p>
              <h2 className="text-xl font-semibold">
                {output.name} / {output.width} x {output.height}
              </h2>
            </div>
            <div className="flex gap-2 sm:hidden">
              <Button variant="outline" onClick={autoFill} disabled={!filteredPhotos.length} size="sm">
                Fill
              </Button>
              <Button onClick={() => exportImage("png")} disabled={!assignedPhotos.length || isExporting} size="sm">
                PNG
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-950/5 p-3 shadow-inner sm:p-6">
            <div
              ref={previewRef}
              className="relative mx-auto max-h-[calc(100svh-170px)] w-full max-w-[960px] overflow-hidden shadow-2xl ring-1 ring-black/10"
              style={{
                aspectRatio: `${output.width} / ${output.height}`,
                ...previewBackgroundStyle,
              }}
            >
              {backgroundMode === "blur" && assignedPhotos[0] && resolvePhotoUrl(assignedPhotos[0], originalUrls) && (
                <Image
                  src={resolvePhotoUrl(assignedPhotos[0], originalUrls)}
                  alt=""
                  fill
                  sizes="960px"
                  className="scale-110 object-cover blur-2xl"
                  unoptimized
                />
              )}
              <div className="absolute inset-0">
                {isDiagonal ? (
                  <>
                    {assignedPhotos.slice(0, template === "diagonal_2" ? 2 : 4).map((photo, index) => {
                      const clipPaths =
                        template === "diagonal_2"
                          ? [
                              "polygon(0 0, 100% 0, 0 100%)",
                              "polygon(100% 0, 100% 100%, 0 100%)",
                            ]
                          : [
                              "polygon(0 0, 50% 50%, 0 100%)",
                              "polygon(0 0, 100% 0, 50% 50%)",
                              "polygon(100% 0, 100% 100%, 50% 50%)",
                              "polygon(100% 100%, 0 100%, 50% 50%)",
                            ];
                      return (
                        <button
                          type="button"
                          key={photo.id}
                          onClick={() => setSelectedCellIndex(index)}
                          draggable
                          onDragStart={() => {
                            draggedCellRef.current = index;
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            if (draggedCellRef.current !== null) swapCells(draggedCellRef.current, index);
                            draggedCellRef.current = null;
                          }}
                          className={`absolute inset-0 overflow-hidden focus:outline-none ${
                            selectedCellIndex === index ? "ring-2 ring-sky-500 ring-inset" : ""
                          }`}
                          style={{
                            clipPath: clipPaths[index],
                            padding: gap / 2,
                            border: borderWidth ? `${borderWidth}px solid ${borderColor}` : undefined,
                          }}
                          aria-label={`Diagonal collage cell ${index + 1}`}
                        >
                          <Image
                            src={resolvePhotoUrl(photo, originalUrls)}
                            alt={photo.fileName || `Photo ${index + 1}`}
                            fill
                            sizes="960px"
                            className="h-full w-full"
                            style={{
                              objectFit: fitMode,
                              objectPosition: imagePosition,
                              transform: `scale(${cellAdjustments[photo.id]?.zoom ?? 1}) rotate(${cellAdjustments[photo.id]?.rotate ?? 0}deg)`,
                            }}
                            unoptimized
                          />
                        </button>
                      );
                    })}
                    {!assignedPhotos.length && (
                      <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                        Select photos or use Auto Fill
                      </div>
                    )}
                  </>
                ) : (
                  frames.map((frame, index) => {
                    const photoIndex = frame.photoIndex ?? index;
                    const photo = assignedPhotos[photoIndex];
                    return (
                      <CollageCell
                        key={`${template}-${index}`}
                        photo={photo}
                        src={photo ? resolvePhotoUrl(photo, originalUrls) : ""}
                        frame={frame}
                        index={photoIndex}
                        selected={selectedCellIndex === photoIndex}
                        fitMode={fitMode}
                        imagePosition={imagePosition}
                        adjustment={photo ? cellAdjustments[photo.id] ?? { zoom: 1, rotate: 0 } : { zoom: 1, rotate: 0 }}
                        cornerRadius={cornerRadius}
                        borderWidth={borderWidth}
                        borderColor={borderColor}
                        gap={gap}
                        onSelect={() => setSelectedCellIndex(photoIndex)}
                        onDragStart={() => {
                          draggedCellRef.current = photoIndex;
                        }}
                        onDrop={() => {
                          if (draggedCellRef.current !== null) swapCells(draggedCellRef.current, photoIndex);
                          draggedCellRef.current = null;
                        }}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-[76px] lg:max-h-[calc(100svh-96px)] lg:overflow-y-auto lg:pl-1">
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
                  }}
                  className={`rounded-md border p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                    template === item.id
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white hover:border-zinc-400"
                  }`}
                >
                  <TemplateGlyph template={item.id} />
                  <span className="mt-2 block truncate text-xs font-semibold">{item.name}</span>
                  <span className={`block text-[11px] ${template === item.id ? "text-white/65" : "text-zinc-500"}`}>
                    {item.photos} photos
                  </span>
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
                <Slider value={[selectedAdjustment.zoom]} min={0.6} max={2.4} step={0.05} onValueChange={([value]) => updateSelectedAdjustment({ zoom: value })} disabled={!selectedCellPhoto} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Cell rotate</Label>
                  <span className="text-sm text-zinc-500">{selectedAdjustment.rotate}deg</span>
                </div>
                <Slider value={[selectedAdjustment.rotate]} min={-30} max={30} step={1} onValueChange={([value]) => updateSelectedAdjustment({ rotate: value })} disabled={!selectedCellPhoto} />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => updateSelectedAdjustment({ zoom: 1, rotate: 0 })}
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
                    <SelectItem key={size.id} value={size.id}>
                      {size.name}
                    </SelectItem>
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
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => exportImage("png")} disabled={!assignedPhotos.length || isExporting}>
                  <Download className="h-4 w-4" />
                  PNG
                </Button>
                <Button variant="outline" onClick={() => exportImage("jpeg")} disabled={!assignedPhotos.length || isExporting}>
                  <Download className="h-4 w-4" />
                  JPG
                </Button>
              </div>
              <Button variant="outline" disabled className="w-full" title="Saving collages requires the optional collages table and upload endpoint.">
                Save to Album
              </Button>
              {exportError && <p className="text-sm font-medium text-rose-600">{exportError}</p>}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

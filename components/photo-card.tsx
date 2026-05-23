"use client";

import { useState } from "react";
import Image from "next/image";
import { Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Photo } from "@/lib/types";

interface PhotoCardProps {
  photo: Photo;
  onClick: () => void;
}

export function PhotoCard({ photo, onClick }: PhotoCardProps) {
  const imageUrl = photo.thumbnailUrl || photo.previewUrl;

  return (
    <button
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-lg bg-muted border border-border hover:border-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={photo.caption || "Photo"}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          unoptimized
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-secondary">
          <span className="text-muted-foreground text-sm">No preview</span>
        </div>
      )}
      {photo.caption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-white text-xs line-clamp-2">{photo.caption}</p>
        </div>
      )}
    </button>
  );
}

interface PhotoLightboxProps {
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function PhotoLightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate,
}: PhotoLightboxProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const photo = photos[currentIndex];

  const handleDownload = async () => {
    if (!photo.downloadUrl) return;
    setIsDownloading(true);
    try {
      const a = document.createElement("a");
      a.href = photo.downloadUrl;
      a.download = `photo-${photo.id}.jpg`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrev = () => {
    onNavigate(currentIndex > 0 ? currentIndex - 1 : photos.length - 1);
  };

  const handleNext = () => {
    onNavigate(currentIndex < photos.length - 1 ? currentIndex + 1 : 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") handlePrev();
    if (e.key === "ArrowRight") handleNext();
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {photo.downloadUrl && (
          <Button
            variant="secondary"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            disabled={isDownloading}
          >
            <Download className="w-4 h-4" />
          </Button>
        )}
        <Button variant="secondary" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          handlePrev();
        }}
      >
        <ChevronLeft className="w-6 h-6 text-white" />
      </button>

      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          handleNext();
        }}
      >
        <ChevronRight className="w-6 h-6 text-white" />
      </button>

      <div
        className="relative max-w-[90vw] max-h-[85vh] w-full h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {photo.previewUrl ? (
          <Image
            src={photo.previewUrl}
            alt={photo.caption || "Photo"}
            fill
            className="object-contain"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/60">No preview available</span>
          </div>
        )}
      </div>

      {photo.caption && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-2xl px-4">
          <p className="text-white/90 text-center text-sm bg-black/50 rounded-lg px-4 py-2">
            {photo.caption}
          </p>
        </div>
      )}

      <div className="absolute bottom-4 right-4 text-white/60 text-sm">
        {currentIndex + 1} / {photos.length}
      </div>
    </div>
  );
}

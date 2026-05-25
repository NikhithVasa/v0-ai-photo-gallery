"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Search, Download, Loader2, Sparkles, 
  Share2, ChevronLeft, ChevronRight, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { Photo } from "@/lib/types";

// ==========================================
// Custom Icon Components
// ==========================================

export function LotusIcon({ className = "w-6 h-6", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.2"
      className={className}
      {...props}
    >
      {/* Central Petal */}
      <path d="M12 3C12 3 15.5 8 15.5 12C15.5 16 12 21 12 21C12 21 8.5 16 8.5 12C8.5 8 12 3 12 3Z" fill="url(#lotusGradient)" />
      {/* Left Side Petal 1 */}
      <path d="M12 21C12 21 7 19.5 5.5 15C4 10.5 7.5 8.5 9 10C9 10 11 12.5 11 15C11 15.5 11.5 21 12 21Z" fill="url(#lotusGradientSide)" />
      {/* Right Side Petal 1 */}
      <path d="M12 21C12 21 17 19.5 18.5 15C20 10.5 16.5 8.5 15 10C15 10 13 12.5 13 15C13 15.5 12.5 21 12 21Z" fill="url(#lotusGradientSide)" />
      {/* Left Side Petal 2 */}
      <path d="M12 21C12 21 6.5 21.5 4 18C1.5 14.5 5 13 7.5 14.5C7.5 14.5 9.5 16 10.5 17.5C11 18.2 11.5 21 12 21Z" fill="url(#lotusGradientSide2)" />
      {/* Right Side Petal 2 */}
      <path d="M12 21C12 21 17.5 21.5 20 18C22.5 14.5 19 13 16.5 14.5C16.5 14.5 14.5 16 13.5 17.5C13 18.2 12.5 21 12 21Z" fill="url(#lotusGradientSide2)" />
      <defs>
        <linearGradient id="lotusGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="40%" stopColor="#EAB308" />
          <stop offset="100%" stopColor="#9F1239" />
        </linearGradient>
        <linearGradient id="lotusGradientSide" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#9F1239" />
        </linearGradient>
        <linearGradient id="lotusGradientSide2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#9F1239" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function DiyaSpinner({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full animate-slow-rotate">
        {/* Diya Base */}
        <path 
          d="M3 13C3 17.5 7 19.5 12 19.5C17 19.5 21 17.5 21 13C21 11.5 12 11.5 12 11.5C12 11.5 3 11.5 3 13Z" 
          fill="#9F1239" 
          stroke="#EAB308" 
          strokeWidth="1.5" 
        />
        {/* Tiny golden dots */}
        <circle cx="12" cy="15.5" r="1.5" fill="#EAB308" />
        <circle cx="7" cy="14.5" r="0.8" fill="#FDE68A" />
        <circle cx="17" cy="14.5" r="0.8" fill="#FDE68A" />
      </svg>
      {/* Flame flickering */}
      <div 
        className="absolute -top-1 w-3 h-5 bg-gradient-to-t from-red-600 via-orange-400 to-yellow-200 rounded-full blur-[0.5px] animate-pulse origin-bottom" 
        style={{ animationDuration: '0.6s' }} 
      />
    </div>
  );
}

// ==========================================
// Particle Background Effect
// ==========================================

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  type: "sparkle" | "petal";
  rotation: number;
  rotationSpeed: number;
}

export function ApsaraParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) return;

    const isMobile = window.innerWidth < 768;
    const count = isMobile ? 6 : 22; // 70% reduction on mobile
    
    // Spawn initial particles with a partial burst effect from the bottom-right corner
    const initialParticles = Array.from({ length: count }).map((_, i) => {
      const isBurst = i < (isMobile ? 3 : 9); // some particles act as starting burst
      return {
        id: i,
        x: isBurst ? Math.random() * 15 + 80 : Math.random() * 100,
        y: isBurst ? Math.random() * 15 + 80 : Math.random() * 100,
        size: Math.random() * (isMobile ? 5 : 8) + 4,
        speedY: isBurst ? Math.random() * 0.35 + 0.15 : Math.random() * 0.15 + 0.05,
        speedX: isBurst ? -(Math.random() * 0.25 + 0.1) : (Math.random() - 0.5) * 0.08,
        opacity: Math.random() * 0.5 + 0.25,
        type: Math.random() > 0.4 ? ("sparkle" as const) : ("petal" as const),
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 1.5,
      };
    });
    setParticles(initialParticles);

    let animFrameId: number;
    const updateParticles = () => {
      setParticles((prev) =>
        prev.map((p) => {
          let newY = p.y - p.speedY;
          let newX = p.x + p.speedX;
          if (newY < -5) {
            newY = 105;
            newX = Math.random() * 100;
          }
          if (newX < -5 || newX > 105) {
            newX = Math.random() * 100;
          }
          return {
            ...p,
            y: newY,
            x: newX,
            rotation: (p.rotation + p.rotationSpeed) % 360,
          };
        })
      );
      animFrameId = requestAnimationFrame(updateParticles);
    };

    animFrameId = requestAnimationFrame(updateParticles);
    return () => cancelAnimationFrame(animFrameId);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute pointer-events-none transition-transform duration-100 ease-linear"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size * (p.type === "petal" ? 1.5 : 1)}px`,
            opacity: p.opacity,
            transform: `rotate(${p.rotation}deg)`,
            background: p.type === "sparkle" 
              ? "radial-gradient(circle, #FDE68A 0%, #EAB308 100%)" 
              : "linear-gradient(135deg, #F59E0B 0%, #9F1239 100%)",
            borderRadius: p.type === "petal" ? "100% 0% 100% 0%" : "50%",
            boxShadow: p.type === "sparkle" ? "0 0 10px rgba(234, 179, 8, 0.45)" : "none",
          }}
        />
      ))}
    </div>
  );
}

// ==========================================
// Floating Trigger Button
// ==========================================

interface ApsaraFloatingTriggerProps {
  onClick: () => void;
}

export function ApsaraFloatingTrigger({ onClick }: ApsaraFloatingTriggerProps) {
  const [sparkles, setSparkles] = useState<{ id: number; top: string; left: string; size: string; delay: string }[]>([]);

  useEffect(() => {
    // Generate sparkles on client side
    const list = Array.from({ length: 4 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 60 + 10}%`,
      left: `${Math.random() * 60 + 10}%`,
      size: `${Math.random() * 4 + 2}px`,
      delay: `${Math.random() * 1.5}s`,
    }));
    setSparkles(list);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-40 flex items-center gap-3 pointer-events-none">
      {/* Floating text badge displaying "Apsara" next to the orb (desktop only) */}
      <motion.div
        className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#050807]/80 backdrop-blur-md border border-[#EAB308]/32 text-[#FDE68A] text-xs font-serif tracking-widest shadow-[0_4px_12px_rgba(0,0,0,0.5)] pointer-events-auto cursor-pointer hover:border-[#EAB308]/60 hover:text-white transition-all select-none"
        onClick={onClick}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <Sparkles className="w-3 h-3 text-[#EAB308] animate-pulse" />
        <span>Apsara</span>
      </motion.div>

      <motion.button
        onClick={onClick}
        className="w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center cursor-pointer border border-[#FFD780]/65 text-amber-100 group animate-orb-breath focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:ring-offset-2 focus:ring-offset-[#050807] pointer-events-auto shadow-[0_0_24px_rgba(234,179,8,0.45),0_0_48px_rgba(16,185,129,0.18)]"
        style={{
          background: "radial-gradient(circle at 35% 30%, #FDE68A 0%, #EAB308 35%, #9F1239 100%)",
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open Apsara Moments photo search"
      >
        {/* Glow Rings */}
        <span className="absolute inset-0 rounded-full bg-emerald-500/10 scale-110 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <span className="absolute inset-0 rounded-full bg-amber-400/20 scale-105 blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Lotus Icon inside */}
        <motion.div
          className="w-9 h-9 sm:w-11 sm:h-11 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] flex items-center justify-center"
          whileHover={{ rotate: 15 }}
          transition={{ type: "spring", stiffness: 200, damping: 10 }}
        >
          <LotusIcon className="w-full h-full text-amber-100" />
        </motion.div>

        {/* Flame glow back overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#EAB308]/20 to-transparent rounded-full pointer-events-none mix-blend-overlay" />

        {/* Mini Sparkles on hover */}
        {sparkles.map((sp) => (
          <span
            key={sp.id}
            className="absolute rounded-full bg-yellow-200 opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-opacity duration-500 pointer-events-none"
            style={{
              top: sp.top,
              left: sp.left,
              width: sp.size,
              height: sp.size,
              animationDelay: sp.delay,
              boxShadow: "0 0 6px #FDE68A",
            }}
          />
        ))}
      </motion.button>
    </div>
  );
}

// ==========================================
// Top Bar Component
// ==========================================

interface ApsaraTopBarProps {
  onClose: () => void;
}

export function ApsaraTopBar({ onClose }: ApsaraTopBarProps) {
  return (
    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 border-b border-[#EAB308]/15 z-10 bg-[#050807]/30 shrink-0 gap-2 sm:gap-0">
      <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9F1239] to-[#EAB308] p-[1.5px] shadow-[0_0_12px_rgba(234,179,8,0.25)] flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-[#050807] rounded-full flex items-center justify-center">
              <LotusIcon className="w-5 h-5 text-[#EAB308]" />
            </div>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold tracking-wide bg-gradient-to-r from-amber-100 via-amber-200 to-[#FDE68A] bg-clip-text text-transparent">
              Apsara Moments
            </h2>
            {/* Subtitle visible here on desktop only */}
            <p className="hidden sm:block text-[11px] sm:text-xs text-[#F8F1E9]/60 font-sans tracking-wide">
              Describe a memory. We&rsquo;ll find the photos.
            </p>
          </div>
        </div>

        {/* Close button shown here on mobile (same row as title) */}
        <button
          onClick={onClose}
          className="sm:hidden w-11 h-11 rounded-full flex items-center justify-center bg-white/6 hover:bg-amber-950/20 border border-[#EAB308]/32 text-[#FDE68A] hover:shadow-[0_0_16px_rgba(234,179,8,0.3)] hover:scale-105 transition-all duration-300 cursor-pointer shrink-0"
          aria-label="Close Apsara Moments"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Subtitle shown below on mobile */}
      <p className="sm:hidden text-[11px] text-[#F8F1E9]/60 font-sans tracking-wide px-1">
        Describe a memory. We&rsquo;ll find the photos.
      </p>

      {/* Close button shown here on desktop */}
      <button
        onClick={onClose}
        className="hidden sm:flex w-11 h-11 rounded-full items-center justify-center bg-white/6 hover:bg-amber-950/20 border border-[#EAB308]/32 text-[#FDE68A] hover:shadow-[0_0_16px_rgba(234,179,8,0.3)] hover:scale-105 transition-all duration-300 cursor-pointer shrink-0"
        aria-label="Close Apsara Moments"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// ==========================================
// Search Box Component
// ==========================================

interface ApsaraSearchBoxProps {
  value: string;
  onChange: (val: string) => void;
  onSearch: () => void;
  isLoading: boolean;
}

export function ApsaraSearchBox({ value, onChange, onSearch, isLoading }: ApsaraSearchBoxProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  const hasText = value.trim().length > 0;

  return (
    <div className="relative w-full max-w-2xl mx-auto z-10 px-1">
      <div 
        className={`flex items-center gap-3 px-4 sm:px-6 border border-[#EAB308]/36 bg-[#F8F1E9]/8 transition-all duration-300 hover:border-[#EAB308]/60 focus-within:ring-1 focus-within:ring-[#EAB308]/50 focus-within:border-[#EAB308]/50
          h-[56px] rounded-[24px]
          sm:h-[68px] sm:rounded-full
          shadow-[inset_0_0_24px_rgba(52,211,153,0.08),0_0_32px_rgba(234,179,8,0.08)]
        `}
      >
        <Search className="w-5 h-5 text-amber-200/50 shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find me dancing at the reception..."
          className="w-full bg-transparent border-0 outline-none text-[#F8F1E9] placeholder-[#FDE68A]/40 text-base sm:text-lg py-1 focus:ring-0 focus:outline-none"
          aria-label="Search wedding photos with Apsara"
          disabled={isLoading}
        />
        <Button
          onClick={onSearch}
          disabled={isLoading || !value.trim()}
          className={`rounded-xl sm:rounded-full h-9 w-9 sm:h-11 sm:w-11 bg-gradient-to-r from-[#9F1239] to-[#EAB308] text-amber-100 hover:brightness-110 shrink-0 p-0 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all duration-300
            ${hasText ? "shadow-[0_0_16px_rgba(234,179,8,0.65)] scale-105" : "shadow-[0_0_12px_rgba(234,179,8,0.3)]"}
          `}
          aria-label="Search photos"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ==========================================
// Prompt Chips Component
// ==========================================

interface ApsaraPromptChipsProps {
  onChipClick: (text: string) => void;
}

export function ApsaraPromptChips({ onChipClick }: ApsaraPromptChipsProps) {
  const chips = [
    "Reception dance photos",
    "Candid smiling moments",
    "Photos with parents",
    "Bride and groom portraits",
    "Family near the mandap",
    "Haldi ceremony",
    "Group photos with friends",
  ];

  return (
    <div className="w-full overflow-x-auto flex gap-2.5 py-2 px-1 scrollbar-none scroll-smooth shrink-0 z-10 select-none">
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onChipClick(chip)}
          className="shrink-0 text-xs sm:text-sm font-sans py-2 px-[14px] border border-[#EAB308]/28 bg-[#9F1239]/18 text-[#FDE68A] rounded-full cursor-pointer hover:bg-[#9F1239]/35 hover:border-[#EAB308]/60 hover:shadow-[0_0_12px_rgba(234,179,8,0.15),inset_0_0_8px_rgba(52,211,153,0.15)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

// ==========================================
// AI Result Summary Component
// ==========================================

interface ApsaraResultSummaryProps {
  resultsCount: number;
  query: string;
  selectedEventSlug: string | null;
}

export function ApsaraResultSummary({ resultsCount, query, selectedEventSlug }: ApsaraResultSummaryProps) {
  let summaryText = `I found ${resultsCount} ${resultsCount === 1 ? "memory" : "memories"}`;
  
  if (selectedEventSlug) {
    summaryText += ` in the ${selectedEventSlug.toUpperCase()}`;
  }
  
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes("dance") || lowerQuery.includes("dancing")) {
    summaryText = `Here are your wedding dance floor memories (${resultsCount} photos found).`;
  } else if (lowerQuery.includes("smile") || lowerQuery.includes("smiling") || lowerQuery.includes("laugh") || lowerQuery.includes("laughing")) {
    summaryText = `Here are your candid smiling and laughing moments (${resultsCount} photos found).`;
  } else if (lowerQuery.includes("family") || lowerQuery.includes("parent") || lowerQuery.includes("parents")) {
    summaryText = `I found ${resultsCount} family memories near the mandap and stage.`;
  } else if (lowerQuery.includes("haldi")) {
    summaryText = `I found ${resultsCount} warm memories from the Haldi ceremony.`;
  } else if (query) {
    summaryText = `I found ${resultsCount} memories matching "${query}".`;
  }

  return (
    <div className="flex items-center gap-1.5 px-1 select-none shrink-0 z-10">
      <Sparkles className="w-4 h-4 text-[#EAB308]" />
      <p className="text-sm font-sans font-medium text-[#FDE68A] tracking-wide">
        {summaryText}
      </p>
    </div>
  );
}

// ==========================================
// Photo Results Grid Component
// ==========================================

interface ApsaraPhotoResultsGridProps {
  children: React.ReactNode;
}

export function ApsaraPhotoResultsGrid({ children }: ApsaraPhotoResultsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 md:gap-[14px] lg:gap-[18px] pb-6">
      {children}
    </div>
  );
}

// ==========================================
// Photo Card Component
// ==========================================

interface ApsaraPhotoCardProps {
  photo: Photo;
  onClick: () => void;
}

export function ApsaraPhotoCard({ photo, onClick }: ApsaraPhotoCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div
      onClick={onClick}
      className="group relative rounded-[20px] overflow-hidden border border-[#EAB308]/22 bg-white/6 shadow-[0_12px_32px_rgba(0,0,0,0.28)] hover:border-[#EAB308]/60 transition-all duration-500 cursor-pointer select-none apsara-card-glow-hover hover:-translate-y-1 hover:scale-[1.015]"
    >
      {/* Aspect Ratio Container */}
      <div className="aspect-[4/5] sm:aspect-square relative w-full overflow-hidden bg-black/20">
        {photo.thumbnailUrl || photo.previewUrl ? (
          <Image
            src={photo.thumbnailUrl || photo.previewUrl || ""}
            alt={photo.caption || "Search result"}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${
              imageLoaded ? "blur-0 scale-100" : "blur-md scale-95"
            }`}
            onLoad={() => setImageLoaded(true)}
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/5">
            <span className="text-[#FDE68A]/40 text-xs">No preview</span>
          </div>
        )}

        {/* Skeleton loading overlay */}
        {!imageLoaded && (
          <div className="absolute inset-0 animate-gold-shimmer" />
        )}

        {/* Subtle dark bottom fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Metadata Labels */}
      {(photo.eventName || photo.caption) && (
        <div className="p-3 bg-[#050807]/90 border-t border-[#EAB308]/10 flex flex-col gap-1 min-w-0">
          {photo.eventName && (
            <span className="text-[10px] sm:text-[11px] font-sans font-semibold tracking-wider text-[#EAB308] uppercase truncate">
              {photo.eventName}
            </span>
          )}
          {photo.caption && (
            <p className="text-[11px] sm:text-[12px] text-[#F8F1E9]/80 truncate">
              {photo.caption}
            </p>
          )}
        </div>
      )}

      {/* Decorative Emerald Glow Inward */}
      <div className="absolute inset-0 border border-emerald-500/0 group-hover:border-emerald-500/10 group-hover:shadow-[inset_0_0_16px_rgba(52,211,153,0.18)] transition-all pointer-events-none rounded-[20px]" />
    </div>
  );
}

// ==========================================
// Loading State Component
// ==========================================

export function ApsaraLoadingState() {
  return (
    <div className="flex-1 w-full flex flex-col gap-6 overflow-y-auto px-1">
      {/* Spinner and Status */}
      <div className="flex flex-col items-center justify-center py-8 gap-3 select-none">
        <DiyaSpinner />
        <p className="text-[#FDE68A] font-serif text-lg tracking-wide animate-pulse">
          Finding your moments...
        </p>
      </div>

      {/* Grid skeletons */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 md:gap-[14px] lg:gap-[18px]">
        {Array.from({ length: 10 }).map((_, i) => (
          <div 
            key={i} 
            className="aspect-square w-full rounded-[20px] border border-[#EAB308]/15 bg-white/5 animate-gold-shimmer" 
          />
        ))}
      </div>
    </div>
  );
}

// ==========================================
// Empty State Component
// ==========================================

interface ApsaraEmptyStateProps {
  onChipClick: (text: string) => void;
}

export function ApsaraEmptyState({ onChipClick }: ApsaraEmptyStateProps) {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center py-12 px-4 max-w-lg mx-auto text-center gap-6 select-none z-10">
      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#9F1239]/30 to-[#EAB308]/20 flex items-center justify-center border border-[#EAB308]/30 shadow-[0_0_16px_rgba(234,179,8,0.2)]">
        <LotusIcon className="w-9 h-9 text-[#EAB308]" />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-xl sm:text-2xl font-serif font-semibold text-[#FDE68A] tracking-wide">
          What memory are you looking for?
        </h3>
        <p className="text-sm sm:text-base text-[#F8F1E9]/60 font-sans leading-relaxed">
          Search by person, event, emotion, outfit, or moment.
        </p>
      </div>

      {/* Suggested Chips inside empty state */}
      <div className="flex flex-wrap justify-center gap-2">
        {[
          "Bride and groom portraits",
          "Family photos",
          "Candid laughing moments",
          "Dance floor",
          "Mandap ceremony",
        ].map((tag) => (
          <button
            key={tag}
            onClick={() => onChipClick(tag)}
            className="text-xs font-sans px-3.5 py-1.5 border border-[#EAB308]/20 bg-[#9F1239]/12 text-[#FDE68A] rounded-full cursor-pointer hover:bg-[#9F1239]/25 hover:border-[#EAB308]/40 hover:-translate-y-0.5 transition-all duration-200"
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// No Results State Component
// ==========================================

interface ApsaraNoResultsStateProps {
  onChipClick: (text: string) => void;
}

export function ApsaraNoResultsState({ onChipClick }: ApsaraNoResultsStateProps) {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center py-12 px-4 max-w-md mx-auto text-center gap-6 select-none z-10">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
        <X className="w-5 h-5 text-[#F8F1E9]/60" />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg sm:text-xl font-serif text-[#FDE68A]">
          No matching photos found
        </h3>
        <p className="text-xs sm:text-sm text-[#F8F1E9]/60 leading-relaxed">
          Try searching with a person’s name, ceremony name, outfit color, or moment.
        </p>
      </div>

      {/* Recommended Tags */}
      <div className="flex flex-wrap justify-center gap-2">
        {[
          'with family',
          'reception',
          'smiling',
          'near mandap',
        ].map((item) => (
          <button
            key={item}
            onClick={() => onChipClick(item)}
            className="text-xs font-sans px-3 py-1 bg-[#FDE68A]/5 hover:bg-[#FDE68A]/12 border border-[#EAB308]/20 text-[#FDE68A] rounded-full cursor-pointer transition-colors"
          >
            Try &ldquo;{item}&rdquo;
          </button>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// Fullscreen Photo Lightbox
// ==========================================

interface ApsaraPhotoViewerProps {
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  albumSlug: string;
}

async function getDownloadUrl(albumSlug: string, photo: Photo) {
  if (photo.downloadUrl) return photo.downloadUrl;

  const response = await fetch(
    `/api/albums/${encodeURIComponent(albumSlug)}/photos/signed-urls`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds: [photo.id] }),
    }
  );

  if (!response.ok) return null;

  const data = (await response.json()) as {
    urls?: Record<string, { downloadUrl: string | null }>;
  };
  return data.urls?.[photo.id]?.downloadUrl ?? null;
}

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function ApsaraPhotoViewer({
  photos,
  currentIndex,
  onClose,
  onNavigate,
  albumSlug,
}: ApsaraPhotoViewerProps) {
  const photo = photos[currentIndex];
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus container on mount for accessible keyboard navigation
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "Right") {
        if (currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
      }
      if (e.key === "ArrowLeft" || e.key === "Left") {
        if (currentIndex > 0) onNavigate(currentIndex - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, photos.length, onNavigate, onClose]);

  if (!photo) return null;

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const url = await getDownloadUrl(albumSlug, photo);
      if (!url) throw new Error("Could not fetch download url");
      triggerDownload(url, photo.fileName || `apsara-photo-${photo.id}.jpg`);
      toast({
        title: "Download Started",
        description: "Your high-resolution wedding memory is downloading.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Download Failed",
        description: "Failed to generate a download link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    // Generate shareable URL
    const shareUrl = window.location.origin + `/albums/${albumSlug}?photo=${photo.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: photo.caption || "Wedding Photo",
          text: `Check out this photo from the wedding: ${photo.caption || ""}`,
          url: shareUrl,
        });
      } catch (err) {
        // user cancelled or share failed
        console.error(err);
      }
    } else {
      // Fallback copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast({
          title: "Link Copied",
          description: "Photo link copied to your clipboard.",
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error(err);
        toast({
          title: "Copy Failed",
          description: "Failed to copy photo link.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        tabIndex={-1}
        className="fixed inset-0 z-[60] flex flex-col focus:outline-none select-none"
        style={{
          background: "rgba(0, 0, 0, 0.86)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-label="Photo viewer"
      >
        {/* Ambient background using blurred photo if available */}
        <div className="absolute inset-0 overflow-hidden opacity-30 blur-3xl pointer-events-none scale-110 z-0">
          {(photo.previewUrl || photo.thumbnailUrl) && (
            <Image
              src={photo.previewUrl || photo.thumbnailUrl || ""}
              alt="ambient"
              fill
              className="object-cover"
              unoptimized
            />
          )}
        </div>

        {/* Top Control Bar */}
        <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="text-[#F8F1E9] text-xs sm:text-sm font-sans drop-shadow-md">
            {photo.eventName && (
              <span className="font-semibold text-[#EAB308] mr-2">
                {photo.eventName}
              </span>
            )}
            <span>
              {currentIndex + 1} of {photos.length}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/8 hover:bg-white/18 border border-[#EAB308]/28 text-[#FDE68A] hover:shadow-[0_0_12px_rgba(234,179,8,0.25)] hover:scale-105 transition-all duration-300 cursor-pointer"
            aria-label="Close photo viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Photo Container */}
        <div className="relative flex-1 w-full flex items-center justify-center p-3 sm:p-6 z-10">
          {/* Previous Arrow */}
          {currentIndex > 0 && (
            <button
              onClick={() => onNavigate(currentIndex - 1)}
              className="absolute left-3 sm:left-6 w-12 h-12 rounded-full hidden sm:flex items-center justify-center bg-white/8 hover:bg-white/18 border border-[#EAB308]/28 text-[#FDE68A] hover:shadow-[0_0_12px_rgba(234,179,8,0.25)] hover:scale-105 transition-all duration-300 cursor-pointer"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Large Photo Image with zoom animation */}
          <motion.div
            key={photo.id}
            className="relative max-w-full max-h-[72vh] md:max-h-[78vh] w-auto h-auto aspect-auto flex justify-center items-center shadow-2xl rounded-lg overflow-hidden border border-white/5"
            initial={{ opacity: 0, scale: 0.72, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.72, filter: "blur(8px)" }}
            transition={{ type: "spring", stiffness: 130, damping: 18 }}
          >
            {photo.previewUrl ? (
              <Image
                src={photo.previewUrl}
                alt={photo.caption || "Cinematic view"}
                width={photo.width || 1200}
                height={photo.height || 800}
                className="max-w-full max-h-[72vh] md:max-h-[78vh] w-auto h-auto object-contain rounded-lg"
                priority
                unoptimized
              />
            ) : (
              <div className="p-20 text-center text-zinc-400">
                Failed to load full size image.
              </div>
            )}
          </motion.div>

          {/* Next Arrow */}
          {currentIndex < photos.length - 1 && (
            <button
              onClick={() => onNavigate(currentIndex + 1)}
              className="absolute right-3 sm:right-6 w-12 h-12 rounded-full hidden sm:flex items-center justify-center bg-white/8 hover:bg-white/18 border border-[#EAB308]/28 text-[#FDE68A] hover:shadow-[0_0_12px_rgba(234,179,8,0.25)] hover:scale-105 transition-all duration-300 cursor-pointer"
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Mobile Swipe Navigation Helpers */}
        <div className="flex sm:hidden justify-center gap-8 py-2 z-10">
          <Button
            variant="ghost"
            disabled={currentIndex === 0}
            onClick={() => onNavigate(currentIndex - 1)}
            className="text-[#FDE68A] disabled:opacity-30"
          >
            Prev
          </Button>
          <Button
            variant="ghost"
            disabled={currentIndex === photos.length - 1}
            onClick={() => onNavigate(currentIndex + 1)}
            className="text-[#FDE68A] disabled:opacity-30"
          >
            Next
          </Button>
        </div>

        {/* Bottom Control Bar */}
        <div className="relative z-10 flex flex-col items-center justify-end p-5 pb-8 sm:p-6 bg-gradient-to-t from-black/80 to-transparent gap-4 select-none">
          {photo.caption && (
            <p className="text-center text-sm sm:text-base font-serif text-[#F8F1E9] max-w-xl px-4 drop-shadow-md">
              {photo.caption}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="h-10 px-5 rounded-full flex items-center justify-center gap-2 bg-white/8 hover:bg-white/18 border border-[#EAB308]/28 text-[#FDE68A] hover:shadow-[0_0_12px_rgba(234,179,8,0.22)] hover:scale-105 transition-all duration-300 cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="text-xs font-semibold">Download</span>
            </button>

            <button
              onClick={handleShare}
              className="h-10 px-5 rounded-full flex items-center justify-center gap-2 bg-white/8 hover:bg-[#9F1239]/20 border border-[#EAB308]/28 text-[#FDE68A] hover:shadow-[0_0_12px_rgba(234,179,8,0.22)] hover:scale-105 transition-all duration-300 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-xs font-semibold">Share</span>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ==========================================
// Main Fullscreen Overlay Component
// ==========================================

interface ApsaraMomentsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  albumSlug: string;
  selectedEventSlug: string | null;
  selectedPeopleIds?: string[];
}

export function ApsaraMomentsOverlay({
  isOpen,
  onClose,
  albumSlug,
  selectedEventSlug,
  selectedPeopleIds = [],
}: ApsaraMomentsOverlayProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Photo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && selectedPhotoIndex === null) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, selectedPhotoIndex]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const searchInput = document.querySelector('input[aria-label="Search wedding photos with Apsara"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }, 500);
    } else {
      // Reset state when closed
      setQuery("");
      setResults([]);
      setHasSearched(false);
      setSelectedPhotoIndex(null);
    }
  }, [isOpen]);

  const handleSearch = async (overrideQuery?: string) => {
    const activeQuery = overrideQuery ?? query;
    if (!activeQuery.trim()) return;

    if (overrideQuery) {
      setQuery(overrideQuery);
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: activeQuery.trim(),
            event: selectedEventSlug,
            people: selectedPeopleIds,
            together: true,
            limit: 100,
          }),
        }
      );

      if (!response.ok) throw new Error("Search request failed");
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error("Apsara search failed:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleChipClick = (text: string) => {
    handleSearch(text);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-8 select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Backdrop style */}
          <div
            className="absolute inset-0 cursor-pointer"
            style={{
              background: `
                radial-gradient(circle at top right, rgba(234, 179, 8, 0.18), transparent 35%),
                radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.12), transparent 35%),
                rgba(3, 7, 18, 0.82)
              `,
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
            onClick={onClose}
          />

          {/* Main Container Style with spring expansion from bottom-right orb */}
          <motion.div
            className="relative w-full h-full max-w-[1440px] flex flex-col border border-[#EAB308]/32 bg-[#050807]/88 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_80px_rgba(234,179,8,0.16)] apsara-emerald-glow z-10 overflow-hidden"
            initial={{
              opacity: 0,
              scale: 0.65,
              x: 180,
              y: 180,
              borderRadius: 999,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              x: 0,
              y: 0,
              borderRadius: isMobile ? 24 : 32,
            }}
            exit={{
              opacity: 0,
              scale: 0.65,
              x: 180,
              y: 180,
              borderRadius: 999,
            }}
            transition={{
              type: "spring",
              stiffness: 95,
              damping: 14,
              mass: 0.9,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Particles layer inside container */}
            <ApsaraParticles />

            {/* Top Bar Component */}
            <ApsaraTopBar onClose={onClose} />

            {/* Main Content Area */}
            <div className="flex-1 w-full flex flex-col p-4 sm:p-6 md:p-8 overflow-hidden gap-5 sm:gap-6 z-10">
              {/* Search input and horizontal chips */}
              <div className="flex flex-col gap-3.5 shrink-0">
                <ApsaraSearchBox
                  value={query}
                  onChange={setQuery}
                  onSearch={() => handleSearch()}
                  isLoading={isSearching}
                />
                
                <ApsaraPromptChips onChipClick={handleChipClick} />
              </div>

              {/* Scrollable grid area / status views */}
              <div className="flex-1 w-full overflow-y-auto pr-1">
                {isSearching ? (
                  <ApsaraLoadingState />
                ) : !hasSearched ? (
                  <ApsaraEmptyState onChipClick={handleChipClick} />
                ) : results.length === 0 ? (
                  <ApsaraNoResultsState onChipClick={handleChipClick} />
                ) : (
                  <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                    {/* Result Summary Component */}
                    <ApsaraResultSummary
                      resultsCount={results.length}
                      query={query}
                      selectedEventSlug={selectedEventSlug}
                    />

                    {/* Results Grid Component */}
                    <ApsaraPhotoResultsGrid>
                      {results.map((photo, index) => (
                        <ApsaraPhotoCard
                          key={photo.id}
                          photo={photo}
                          onClick={() => setSelectedPhotoIndex(index)}
                        />
                      ))}
                    </ApsaraPhotoResultsGrid>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Cinematic Lightbox */}
          {selectedPhotoIndex !== null && (
            <ApsaraPhotoViewer
              photos={results}
              currentIndex={selectedPhotoIndex}
              onClose={() => setSelectedPhotoIndex(null)}
              onNavigate={setSelectedPhotoIndex}
              albumSlug={albumSlug}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ==========================================
// Main Root Interface Component
// ==========================================

interface ApsaraMomentsRootProps {
  albumSlug: string;
  selectedEventSlug: string | null;
  selectedPeopleIds?: string[];
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export function ApsaraMomentsRoot({
  albumSlug,
  selectedEventSlug,
  selectedPeopleIds = [],
  isOpen: controlledIsOpen,
  onOpenChange,
}: ApsaraMomentsRootProps) {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;
  const setIsOpen = onOpenChange ?? setUncontrolledIsOpen;

  return (
    <>
      {/* Floating Lotus Trigger Orb */}
      <ApsaraFloatingTrigger onClick={() => setIsOpen(true)} />

      {/* Main Fullscreen Experience Overlay */}
      <ApsaraMomentsOverlay
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        albumSlug={albumSlug}
        selectedEventSlug={selectedEventSlug}
        selectedPeopleIds={selectedPeopleIds}
      />
    </>
  );
}

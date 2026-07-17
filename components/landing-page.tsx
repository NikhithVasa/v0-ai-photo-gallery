"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileImage,
  Heart,
  KeyRound,
  Layers3,
  LockKeyhole,
  MessageCircle,
  Search,
  ScanFace,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import {
  motion,
  useReducedMotion,
  type MotionProps,
  type Variants,
} from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AiPrivacyNotice } from "@/components/ai-privacy-notice";
import { AvalHero } from "@/components/aval-hero";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { BentoGrid } from "@/components/ui/bento-grid";
import { BorderBeam } from "@/components/ui/border-beam";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// Photographer theme: warm ivory, charcoal, muted gold, soft beige, optional rose/sage tones.

function useReveal(): MotionProps {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return { initial: false };
  }

  return {
    initial: "hidden",
    whileInView: "visible",
    viewport: { once: true, margin: "-80px" },
    variants: {
      hidden: { opacity: 0, y: 24 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.7, ease: EASE_OUT },
      },
    } satisfies Variants,
  };
}

function useStagger(): MotionProps {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return { initial: false };
  }

  return {
    initial: "hidden",
    whileInView: "visible",
    viewport: { once: true, margin: "-80px" },
    variants: {
      hidden: {},
      visible: {
        transition: { staggerChildren: 0.08, delayChildren: 0.05 },
      },
    } satisfies Variants,
  };
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT },
  },
};

interface Moment {
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
  /**
   * Optional photo URL. When provided, the card renders this image as its
   * hero visual with a soft scrim. When absent, an owned editorial
   * typographic plate is rendered instead. Wire real album thumbnails here
   * (e.g. from /api/albums/.../photos) when you want photographic content.
   */
  src?: string;
  alt?: string;
  /** Background tone for the typographic plate (used only when src is absent). */
  tone: PlateTone;
}

type PlateTone =
  | "blush"
  | "champagne"
  | "sand"
  | "rose"
  | "sage"
  | "sky"
  | "ink";

const moments: Moment[] = [
  {
    eyebrow: "Faces",
    title: "Find every smile",
    body: "Filter by one person or a group and jump straight to the photos that matter.",
    icon: Users,
    tone: "blush",
    src: "/laugh_1.png",
    alt: "Find every smile",
  },
  {
    eyebrow: "AI edits",
    title: "Fix and finish photos",
    body: "Edit a photo with AI, download the result, or add it back into any event.",
    icon: Sparkles,
    tone: "champagne",
    src: "/filter_1.png",
    alt: "Fix and finish photos",
  },
  {
    eyebrow: "Collage",
    title: "Build the keepsake",
    body: "Upload extra photos, drag them into a collage, crop the best view, and export JPG or PNG.",
    icon: Camera,
    tone: "rose",
    src: "/collage.png",
    alt: "Build the keepsake",
  },
  {
    eyebrow: "Sharing",
    title: "Control every handoff",
    body: "Download all, selected, event, or filtered photos and share albums with watermark and download controls.",
    icon: Download,
    tone: "sand",
    src: "/download.png",
    alt: "Control every handoff",
  },
];

const aiDiscoveryFeatures: Array<{
  title: string;
  body: string;
  desktopImageSrc: string;
  mobileImageSrc: string;
  icon: LucideIcon;
}> = [
  {
    title: "People Search",
    body: "Browse photos by detected people.",
    desktopImageSrc: "/ai-guide/people-search.png",
    mobileImageSrc: "/ai-guide/mobile/people-search.png",
    icon: Users,
  },
  {
    title: "Find Yourself",
    body: "Help guests quickly find photos they appear in.",
    desktopImageSrc: "/ai-guide/find-yourself.png",
    mobileImageSrc: "/ai-guide/mobile/find-yourself.png",
    icon: ScanFace,
  },
  {
    title: "Multiple People Search",
    body: "Find photos where selected people appear together.",
    desktopImageSrc: "/ai-guide/group-search.png",
    mobileImageSrc: "/ai-guide/mobile/group-search.png",
    icon: Users,
  },
  {
    title: "Only Them",
    body: "Filter to photos containing only the chosen people.",
    desktopImageSrc: "/ai-guide/only-them.png",
    mobileImageSrc: "/ai-guide/mobile/only-them.png",
    icon: ShieldCheck,
  },
  {
    title: "SaathiDesk AI",
    body: "Search moments, outfits, scenes, and details.",
    desktopImageSrc: "/ai-guide/saathidesk-ai.png",
    mobileImageSrc: "/ai-guide/mobile/saathidesk-ai.png",
    icon: Sparkles,
  },
];

const toneStyles: Record<
  PlateTone,
  { background: string; grainOpacity: number }
> = {
  blush: {
    background: "#BFA092",
    grainOpacity: 0.11,
  },
  champagne: {
    background: "#BCA679",
    grainOpacity: 0.1,
  },
  rose: {
    background: "#9A655C",
    grainOpacity: 0.12,
  },
  sand: {
    background: "#A18E79",
    grainOpacity: 0.1,
  },
  sage: {
    background: "#71806D",
    grainOpacity: 0.1,
  },
  sky: {
    background: "#687F86",
    grainOpacity: 0.09,
  },
  ink: {
    background: "#26231F",
    grainOpacity: 0.12,
  },
};

const galleryTiles: Array<{
  className: string;
  gradient: string;
  label: string;
  src?: string;
  badge?: { icon: typeof Heart; tone: "rose" | "amber" | "stone" };
  people?: number;
}> = [
  {
    className: "row-span-2",
    gradient: "#B88F7C",
    label: "Golden hour",
    src: "/glow_1.png",
    badge: { icon: Heart, tone: "rose" },
    people: 1,
  },
  {
    className: "",
    gradient: "#9E8E7A",
    label: "First look",
    src: "/First%20look.png",
    people: 3,
  },
  {
    className: "",
    gradient: "#B69B68",
    label: "Ceremony",
    badge: { icon: Sparkles, tone: "amber" },
  },
  {
    className: "row-span-2",
    gradient: "#71806D",
    label: "Vows",
    people: 4,
  },
  {
    className: "",
    gradient: "#98685F",
    label: "Reception",
    src: "/reception.png",
    badge: { icon: Heart, tone: "rose" },
  },
  {
    className: "",
    gradient: "#A48A64",
    label: "Toast",
    people: 5,
  },
];

const badgeToneClasses: Record<"rose" | "amber" | "stone", string> = {
  rose: "bg-[#FFF2EF] text-[#8E4A40] ring-[#E8CFC3]/80",
  amber: "bg-[#FFF8ED] text-[#8A6434] ring-[#E7D6B5]/80",
  stone: "bg-[#F7F1E8] text-[#4F473F] ring-[#E8DED2]/80",
};

const docPages: Array<{
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  icon: LucideIcon;
  tone: PlateTone;
  highlights: string[];
}> = [
  {
    eyebrow: "Guest guide",
    title: "Open, find, save",
    body: "Start with the album link, enter the passcode if one is set, then move between Photos, People, search, collage, and downloads without leaving the gallery.",
    href: "#guest-guide",
    icon: Heart,
    tone: "blush",
    highlights: ["Use People to find yourself", "Search moments in plain words", "Download selected favorites"],
  },
  {
    eyebrow: "Studio guide",
    title: "Upload, process, deliver",
    body: "Create an album, split the day into events, upload files from desktop, Google Drive, or Google Photos, then let processing build previews and AI metadata.",
    href: "#studio-guide",
    icon: UploadCloud,
    tone: "sage",
    highlights: ["Retry failed uploads", "Run event-level AI actions", "Control covers and event order"],
  },
  {
    eyebrow: "AI guide",
    title: "How intelligence is made",
    body: "The AI pipeline creates face groups, scene descriptions, quality signals, searchable text, review clusters, and optional image edits while keeping the original file intact.",
    href: "/how-ai-works",
    icon: BrainCircuit,
    tone: "sky",
    highlights: ["Face grouping", "Search descriptions", "Culling scores"],
  },
  {
    eyebrow: "Delivery guide",
    title: "Share with control",
    body: "Use private links, passcodes, watermark previews, and download controls to decide what clients can view, save, and pass along.",
    href: "#sharing-guide",
    icon: ShieldCheck,
    tone: "champagne",
    highlights: ["Watermarked previews", "Album passcodes", "All, event, or selected exports"],
  },
];

const aiWorkflowSteps: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Photos enter an album event",
    body: "Uploads are registered against an album and event, then stored with original file keys so every photo keeps its source version.",
    icon: UploadCloud,
  },
  {
    title: "Processing builds usable images",
    body: "The app prepares thumbnails, clean previews, watermarked previews, and AI-ready copies so galleries stay fast on phones and desktops.",
    icon: FileImage,
  },
  {
    title: "Faces become people filters",
    body: "Face indexing groups repeated faces into People. You can rename people, filter by one person or a group, and jump into their photos.",
    icon: ScanFace,
  },
  {
    title: "Vision metadata describes the scene",
    body: "AI descriptions capture people, clothing, decor, ceremony details, camera gaze, clarity, background quality, and album-worthy signals.",
    icon: BrainCircuit,
  },
  {
    title: "Search combines names and details",
    body: "Ask AI resolves names or person numbers, respects the current album and event, and matches against captions, scene text, and person-level descriptions.",
    icon: MessageCircle,
  },
  {
    title: "Review tools surface the strongest set",
    body: "Culling views use scores and clusters for needs-review, duplicates, low-score images, photo type, and best-by-person selections.",
    icon: SlidersHorizontal,
  },
];

const promptGuides: Array<{
  title: string;
  body: string;
  examples: string[];
  icon: LucideIcon;
  tone: PlateTone;
}> = [
  {
    title: "Find a person",
    body: "Names work after someone has been renamed in the People screen. Person numbers work before names are added.",
    examples: ["photos of person 1", "photos of Kavya", "person 1 with person 23"],
    icon: Users,
    tone: "blush",
  },
  {
    title: "Find a person in a moment",
    body: "Keep prompts short and visual. Combine a person or name with clothing, decor, pose, or ceremony words.",
    examples: ["Kavya jewelry", "person 1 on stage", "Shramik traditional attire"],
    icon: Search,
    tone: "sage",
  },
  {
    title: "Find a scene",
    body: "Use scene words when you do not care who is in the frame. This is best for decor, venue, ceremony, and group shots.",
    examples: ["family portrait", "floral decorations", "wedding ceremony"],
    icon: Camera,
    tone: "sky",
  },
];

const featureGuides: Array<{
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
  tone: PlateTone;
  steps: string[];
  routeLabel: string;
}> = [
  {
    id: "guest-guide",
    eyebrow: "For guests",
    title: "Move through a delivered album",
    body: "Guests land in a private gallery built for browsing, filtering, saving, and downloading without needing to understand the backend.",
    icon: Heart,
    tone: "rose",
    steps: [
      "Open the shared album link and enter the passcode when required.",
      "Use Photos for the full event story or People to find faces faster.",
      "Use search for visual phrases like stage, jewelry, family portrait, or dancing.",
      "Download one photo, selected photos, an event, or the full album when downloads are enabled.",
    ],
    routeLabel: "Album and share pages",
  },
  {
    id: "studio-guide",
    eyebrow: "For photographers",
    title: "Prepare a clean delivery",
    body: "Studios can keep client albums organized by customer, album, event, cover image, AI status, and share permissions.",
    icon: Layers3,
    tone: "sage",
    steps: [
      "Create customers, albums, and events before upload when the shoot has clear sections.",
      "Upload from device, Google Drive, or Google Photos and retry failed files from the queue.",
      "Start AI processing for new uploads or rerun selected event actions when metadata needs rebuilding.",
      "Set cover imagery and event order before sharing the final gallery.",
    ],
    routeLabel: "/customers, /albums, /upload",
  },
  {
    id: "search-guide",
    eyebrow: "Findability",
    title: "Use AI search with filters",
    body: "Search is album-scoped and can be event-scoped. Person filters are exact, while typed prompts search scene and person metadata.",
    icon: Search,
    tone: "sky",
    steps: [
      "Choose an event first if you only want results from one part of the day.",
      "Use People filters when exact faces matter, especially for multi-person searches.",
      "Use short prompt terms for clothing, decor, emotions, ceremony details, and group types.",
      "Expect matching photos, not a written essay or ranked answer to open-ended questions.",
    ],
    routeLabel: "Album search panel",
  },
  {
    id: "culling-guide",
    eyebrow: "Review",
    title: "Cull and compare faster",
    body: "The culling view turns AI scores and duplicate clusters into review lanes so the best delivery set is easier to assemble.",
    icon: CheckCircle2,
    tone: "ink",
    steps: [
      "Review all photos, needs-review images, low-score frames, duplicate clusters, and photo-type groups.",
      "Open best-by-person when every important person needs strong coverage.",
      "Keep or reject candidates as you review and export selected keepers.",
      "Use scores as a starting point; final taste and client context still matter.",
    ],
    routeLabel: "Album culling",
  },
  {
    id: "editing-guide",
    eyebrow: "Finishing",
    title: "Edit photos, presets, and collages",
    body: "Finishing tools are optional layers on top of the gallery: AI image edits, LUT presets, before/after previews, and exportable collages.",
    icon: Wand2,
    tone: "champagne",
    steps: [
      "Open a photo and use AI edit presets or a custom prompt for targeted changes.",
      "Apply saved or marketplace LUT presets to one photo or selected photos.",
      "Build collages from album photos, drag and crop each frame, then export JPG or PNG.",
      "Edited outputs are saved separately so the original photo remains available.",
    ],
    routeLabel: "Photo viewer, /presets, /collage",
  },
  {
    id: "sharing-guide",
    eyebrow: "Delivery",
    title: "Protect what clients see",
    body: "Sharing controls let the same album work for private review, client delivery, and selected-photo handoff.",
    icon: LockKeyhole,
    tone: "blush",
    steps: [
      "Turn on passcodes for albums or customer pages that need gated access.",
      "Use watermarked previews when clients can browse before final download rights are granted.",
      "Share by album link and keep downloads limited to all, event, filtered, or selected sets.",
      "Use signed media URLs so private image files are not exposed as permanent public links.",
    ],
    routeLabel: "Share links and album settings",
  },
];

const vibrantLandingStyles = `
  [data-landing-palette="vibrant"] {
    --vibrant-ink: #101828;
    --vibrant-cobalt: #315CFF;
    --vibrant-coral: #FF5C5C;
    --vibrant-aqua: #45E0D0;
    --vibrant-lilac: #B8A1FF;
    --vibrant-off-white: #F7F8FC;
    background: var(--vibrant-off-white);
    color: var(--vibrant-ink);
  }
  [data-landing-palette="vibrant"] [class~="bg-[#F7F5F0]"],
  [data-landing-palette="vibrant"] [class~="bg-[#FAF7F2]"],
  [data-landing-palette="vibrant"] [class~="bg-[#F4F1EB]"],
  [data-landing-palette="vibrant"] [class~="bg-[#F2EEE8]"] { background-color: var(--vibrant-off-white) !important; }
  [data-landing-palette="vibrant"] [class~="bg-[#F7F5F0]/90"] { background-color: rgb(247 248 252 / 0.94) !important; }
  [data-landing-palette="vibrant"] [class~="bg-[#EDE8DF]"] { background-color: #EEF1FF !important; }
  [data-landing-palette="vibrant"] [class~="bg-[#E9E3DA]"],
  [data-landing-palette="vibrant"] [class~="bg-[#E9E1D6]"] { background-color: #E8EDFF !important; }
  [data-landing-palette="vibrant"] [class~="bg-[#C8D5C5]"] { background-color: var(--vibrant-aqua) !important; }
  [data-landing-palette="vibrant"] [class~="bg-[#E6C7BC]"] { background-color: var(--vibrant-coral) !important; }
  [data-landing-palette="vibrant"] [class~="bg-[#C7C2E3]"],
  [data-landing-palette="vibrant"] [class~="bg-[#F0E4D5]"] { background-color: var(--vibrant-lilac) !important; }
  [data-landing-palette="vibrant"] [class~="bg-[#F5EF45]"] { background-color: var(--vibrant-aqua) !important; }
  [data-landing-palette="vibrant"] [class~="bg-[#171411]"],
  [data-landing-palette="vibrant"] [class~="bg-[#171717]"],
  [data-landing-palette="vibrant"] [class~="bg-[#1D1B19]"] { background-color: var(--vibrant-ink) !important; }
  [data-landing-palette="vibrant"] [class~="bg-[#171411]/90"] { background-color: rgb(16 24 40 / 0.92) !important; }
  [data-landing-palette="vibrant"] [class~="text-[#1C1B18]"],
  [data-landing-palette="vibrant"] [class~="text-[#1F1B16]"],
  [data-landing-palette="vibrant"] [class~="text-[#171411]"],
  [data-landing-palette="vibrant"] [class~="text-[#514A43]"],
  [data-landing-palette="vibrant"] [class~="text-[#5E564D]"],
  [data-landing-palette="vibrant"] [class~="text-[#655D54]"],
  [data-landing-palette="vibrant"] [class~="text-[#71685F]"],
  [data-landing-palette="vibrant"] [class~="text-[#756B60]"],
  [data-landing-palette="vibrant"] [class~="text-[#80766B]"] { color: var(--vibrant-ink) !important; }
  [data-landing-palette="vibrant"] [class~="text-[#4F473F]"],
  [data-landing-palette="vibrant"] [class~="text-[#6F675E]"] { color: #344054 !important; }
  [data-landing-palette="vibrant"] [class~="text-[#725C3D]"],
  [data-landing-palette="vibrant"] [class~="text-[#744E43]"],
  [data-landing-palette="vibrant"] [class~="text-[#8A6534]"] { color: var(--vibrant-cobalt) !important; }
  [data-landing-palette="vibrant"] [class~="text-[#D9BF8D]"],
  [data-landing-palette="vibrant"] [class~="text-[#E7D6B5]/65"],
  [data-landing-palette="vibrant"] [class~="text-[#E7D6B5]/90"] { color: var(--vibrant-aqua) !important; }
  [data-landing-palette="vibrant"] [class~="text-[#E7D6B5]"] { color: var(--vibrant-lilac) !important; }
  [data-landing-palette="vibrant"] [class~="bg-[#1C1B18]"] { background-color: var(--vibrant-cobalt) !important; }
  [data-landing-palette="vibrant"] [class~="bg-[#F5EF45]"][class~="text-black"] { background-color: var(--vibrant-cobalt) !important; color: var(--vibrant-off-white) !important; }
  [data-landing-palette="vibrant"] [class~="border-[#D9D1C6]"],
  [data-landing-palette="vibrant"] [class~="border-[#D0C5B7]"],
  [data-landing-palette="vibrant"] [class~="border-[#BDB2A4]"] { border-color: rgb(49 92 255 / 0.3) !important; }
  [data-landing-palette="vibrant"] [class*="rgba(202,161,110"],
  [data-landing-palette="vibrant"] [class*="rgba(199,161,91"] { background-image: radial-gradient(circle at 82% 8%, rgb(184 161 255 / 0.55), transparent 30%), radial-gradient(circle at 8% 72%, rgb(69 224 208 / 0.35), transparent 28%) !important; }
  [data-landing-palette="vibrant"] [class~="bg-[#D27B68]"] { background-color: var(--vibrant-coral) !important; }
  [data-landing-palette="vibrant"] [class~="bg-[#D7AF62]"] { background-color: var(--vibrant-lilac) !important; }
  [data-landing-palette="vibrant"] [class~="bg-[#79977D]"] { background-color: var(--vibrant-aqua) !important; }
  [data-landing-palette="vibrant"] [class~="text-[#A7C6A9]"] { color: var(--vibrant-aqua) !important; }
`;

export function LandingPage({ vibrant = false }: { vibrant?: boolean }) {
  const reveal = useReveal();
  const stagger = useStagger();

  return (
    <main
      data-landing-palette={vibrant ? "vibrant" : undefined}
      className="min-h-screen overflow-hidden bg-[#F7F5F0] text-[#1C1B18] antialiased"
    >
      <style>{vibrantLandingStyles}</style>
      <MarketingHeader />
      <Hero reveal={reveal} />
      <AudienceWorkflow />
      <ProductTour reveal={reveal} />
      <ProductStories reveal={reveal} />
      <LandingFeatureIndex reveal={reveal} stagger={stagger} />
      <OpenSourceCallout reveal={reveal} />
      <FinalCTA reveal={reveal} />
      <MarketingFooter />
    </main>
  );
}


export function LegacyLandingPage() {
  const reveal = useReveal();
  const stagger = useStagger();

  return (
    <main className="min-h-screen bg-[#F7F5F0] text-[#1C1B18] antialiased">
      <LegacyMarketingHeader />
      <LegacyHero reveal={reveal} />
      <AiDiscoveryShowcase reveal={reveal} stagger={stagger} />
      <MomentsCarousel reveal={reveal} />
      <LegacyGalleryPreview reveal={reveal} stagger={stagger} />
      <LegacyFinalCTA reveal={reveal} />
      <MarketingFooter />
    </main>
  );
}

export function LegacyMarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#F7F5F0]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-[#1F1B16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 rounded-md"
          aria-label="SaathiDesk home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1C1B18] text-[#F7F5F0] transition-transform duration-300 group-hover:scale-[1.03]">
            <Camera className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="font-serif text-lg leading-none tracking-tight">
            SaathiDesk
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/docs"
            className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-[#4F473F] transition hover:text-[#1F1B16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 md:inline-flex"
          >
            Docs
          </Link>
          <Link
            href="/how-ai-works"
            className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-[#4F473F] transition hover:text-[#1F1B16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 lg:inline-flex"
          >
            How AI works
          </Link>
          <Link
            href="/login"
            className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-[#4F473F] transition hover:text-[#1F1B16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 sm:inline-flex"
          >
            Galleries
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#1C1B18] px-4 text-sm font-medium text-[#F7F5F0] shadow-sm transition hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 cursor-pointer"
          >
            Open album
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </nav>
      </div>
    </header>
  );
}

const heroPetals = [
  { left: "8%", top: "18%", delay: 0.4, duration: 18, scale: 0.85 },
  { left: "18%", top: "62%", delay: 2.8, duration: 22, scale: 1.05 },
  { left: "34%", top: "24%", delay: 1.6, duration: 19, scale: 0.7 },
  { left: "58%", top: "14%", delay: 3.4, duration: 24, scale: 1.2 },
  { left: "72%", top: "72%", delay: 0.9, duration: 21, scale: 0.9 },
  { left: "86%", top: "34%", delay: 2.1, duration: 20, scale: 0.75 },
];

const heroParticles = [
  { left: "12%", top: "38%", delay: 0.2 },
  { left: "24%", top: "78%", delay: 1.3 },
  { left: "43%", top: "18%", delay: 2.4 },
  { left: "66%", top: "52%", delay: 0.9 },
  { left: "79%", top: "21%", delay: 1.8 },
  { left: "91%", top: "67%", delay: 2.9 },
];

function LegacyHero({ reveal }: { reveal: MotionProps }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative isolate min-h-[calc(100svh-10rem)] overflow-hidden bg-[#F6F0E9] text-[#1F1B16] sm:min-h-[calc(100svh-9rem)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-30 overflow-hidden opacity-[0.72] brightness-[1.04] saturate-[0.9] contrast-[1.02]"
      >
        <AvalHero />
      </div>

      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(246,240,233,0.88)_0%,rgba(246,240,233,0.62)_54%,rgba(22,17,12,0.52)_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_50%_18%,rgba(232,199,126,0.28)_0%,rgba(232,199,126,0)_38%),radial-gradient(ellipse_at_18%_78%,rgba(89,38,47,0.2)_0%,rgba(89,38,47,0)_32%),linear-gradient(180deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_48%,rgba(0,0,0,0.42)_100%)]"
      />

      {!prefersReducedMotion ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-0 -z-10 h-full w-[42rem] rotate-[-13deg] bg-[linear-gradient(90deg,rgba(255,247,226,0)_0%,rgba(255,247,226,0.42)_38%,rgba(216,177,101,0.2)_50%,rgba(255,247,226,0)_72%)] blur-2xl"
          animate={{ x: ["-10%", "18%", "-6%"], opacity: [0.25, 0.72, 0.3] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(116deg,rgba(255,248,233,0.18)_0%,rgba(255,248,233,0.04)_26%,rgba(255,248,233,0)_42%),repeating-linear-gradient(100deg,rgba(89,38,47,0.08)_0px,rgba(89,38,47,0.08)_1px,rgba(255,255,255,0)_1px,rgba(255,255,255,0)_10px)] opacity-45 mix-blend-multiply"
      />

      {!prefersReducedMotion ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {heroPetals.map((petal, index) => (
            <motion.span
              key={`petal-${index}`}
              className="absolute h-3 w-1.5 rounded-full bg-[#E8CFC3]/70 shadow-[0_0_18px_rgba(255,235,202,0.25)]"
              style={{ left: petal.left, top: petal.top, scale: petal.scale }}
              animate={{
                x: [0, 24, -18, 12],
                y: [0, -28, 30, 0],
                rotate: [0, 42, -24, 12],
                opacity: [0.16, 0.6, 0.26, 0.16],
              }}
              transition={{
                duration: petal.duration,
                delay: petal.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}

          {heroParticles.map((particle, index) => (
            <motion.span
              key={`particle-${index}`}
              className="absolute h-1 w-1 rounded-full bg-[#F4D795]/75"
              style={{ left: particle.left, top: particle.top }}
              animate={{ opacity: [0.12, 0.65, 0.18], y: [0, -18, 0] }}
              transition={{
                duration: 8 + index,
                delay: particle.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="relative mx-auto flex min-h-[calc(100svh-10rem)] max-w-7xl items-start justify-center px-5 pb-12 pt-20 text-center sm:min-h-[calc(100svh-9rem)] sm:px-8 sm:pt-28 lg:pt-32">
        <motion.div {...reveal} className="mx-auto max-w-[880px]">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#B88A2D]">
            Private AI wedding galleries
          </p>
          <h1 className="mt-7 [font-family:var(--font-editorial),Georgia,serif] text-[4.25rem] font-medium leading-[0.96] tracking-normal text-[#59262F] [text-wrap:balance] sm:text-[4.75rem]">
            SaathiDesk
          </h1>
          <p className="mx-auto mt-3 max-w-[760px] [font-family:var(--font-editorial),Georgia,serif] text-[2.65rem] font-light italic leading-[0.98] tracking-normal text-[#1F1B16]/65 [text-wrap:balance] sm:text-[3.4rem]">
            A cinematic gallery where every face, feeling, and frame stays
            beautifully findable.
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[#2F2924]/78 sm:text-lg">
            Curate wedding albums with semantic search, people filters, AI
            finishing, private sharing, and downloads wrapped in a polished
            ivory, gold, and black delivery experience.
          </p>

          <AiPrivacyNotice
            className="mt-6 max-w-2xl border-[#E8C77E]/35 bg-[#0E0C09]/55 text-[#F7EBDD] backdrop-blur-md"
            iconClassName="text-[#E8C77E]"
          />

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#F4D795] px-6 text-sm font-semibold text-[#120F0A] shadow-[0_18px_45px_rgba(0,0,0,0.28)] transition duration-500 hover:bg-[#FFE8A8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F4D795]/60"
            >
              Open your album
              <ArrowRight
                className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1"
                strokeWidth={1.75}
              />
            </Link>

            <Link
              href="/login?mode=signup"
              className="inline-flex h-12 items-center rounded-full border border-[#F4D795]/45 bg-[#090806]/40 px-6 text-sm font-medium text-[#FFF8EC] backdrop-blur-md transition duration-500 hover:border-[#F4D795]/80 hover:bg-[#090806]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F4D795]/45"
            >
              Sign Up
            </Link>

            <Link
              href="/docs"
              className="inline-flex h-12 items-center rounded-full border border-[#FFF8EC]/25 bg-[#FFF8EC]/10 px-6 text-sm font-medium text-[#FFF8EC] backdrop-blur-md transition duration-500 hover:bg-[#FFF8EC]/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F4D795]/45"
            >
              Read the docs
            </Link>
          </div>
        </motion.div>
      </div>

      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#F7F5F0] via-[#F7F5F0]/55 to-transparent"
      />
    </section>
  );
}

function LegacyGalleryPreview({
  reveal,
  stagger,
}: {
  reveal: MotionProps;
  stagger: MotionProps;
}) {
  return (
    <section className="relative border-y border-[#E8DED2]/70 bg-[#EEEAE2]">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <motion.div
          {...reveal}
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#A77C45]">
              A glimpse
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-tight text-[#1F1B16] sm:text-4xl">
              The whole day, <span className="italic">held in light.</span>
            </h2>
            <p className="mt-3 text-base text-[#6F675E]">
              Masonry-style galleries, face filters and a focused viewer that
              feels as good on a phone as on a 27-inch screen.
            </p>
          </div>

          <Link
            href="/login"
            className="group inline-flex h-11 w-fit items-center gap-1.5 rounded-full border border-[#D6C8B8] bg-white px-5 text-sm font-medium text-[#1F1B16] transition hover:border-[#C8B8A6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 cursor-pointer"
          >
            Browse galleries
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
              strokeWidth={1.75}
            />
          </Link>
        </motion.div>

        <motion.div
          {...stagger}
          className="mt-10 grid auto-rows-[150px] grid-cols-2 gap-3 sm:auto-rows-[180px] sm:grid-cols-3 sm:gap-4 lg:auto-rows-[200px] lg:grid-cols-4"
        >
          {galleryTiles.map((tile, idx) => (
            <motion.div
              key={tile.label + idx}
              variants={itemVariants}
              className={`group relative overflow-hidden rounded-xl shadow-sm ring-1 ring-[#1F1B16]/5 transition duration-500 hover:shadow-lg ${tile.className}`}
              style={{ background: tile.gradient }}
            >
              {tile.src ? (
                <Image
                  src={tile.src}
                  alt={tile.label}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover"
                />
              ) : null}

              <div
                aria-hidden
                className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(60% 60% at 50% 50%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%)",
                }}
              />

              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent opacity-90"
              />

              {tile.badge && (
                <div
                  className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full ring-1 backdrop-blur ${
                    badgeToneClasses[tile.badge.tone]
                  }`}
                >
                  <tile.badge.icon className="h-3.5 w-3.5" strokeWidth={2} />
                </div>
              )}

              <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
                <p className="font-serif text-base leading-tight text-white drop-shadow-sm sm:text-lg">
                  {tile.label}
                </p>

                {tile.people ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-medium text-[#3A2A22] ring-1 ring-[#1F1B16]/5 backdrop-blur">
                    <Users className="h-3 w-3" strokeWidth={2} />
                    {tile.people}
                  </span>
                ) : null}
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          {...reveal}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#8B8176]"
        >
          <span className="inline-flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            Selected and event downloads
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
            AI photo edits
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Watermarked share links
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" strokeWidth={1.75} />
            Collage exports
          </span>
        </motion.div>
      </div>
    </section>
  );
}

function LegacyFinalCTA({ reveal }: { reveal: MotionProps }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
      <motion.div
        {...reveal}
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#171411] px-6 py-14 text-center text-[#FAF7F2] shadow-[0_30px_80px_-45px_rgba(0,0,0,0.8)] sm:px-12 sm:py-20"
      >
        {!prefersReducedMotion ? (
          <AnimatedGridPattern
            width={56}
            height={56}
            numSquares={10}
            maxOpacity={0.08}
            duration={6}
            repeatDelay={2}
            className="fill-[#E7D6B5]/10 stroke-white/[0.06] [mask-image:radial-gradient(500px_circle_at_center,black,transparent)]"
          />
        ) : null}

        <p className="relative text-xs font-medium uppercase tracking-[0.18em] text-[#E7D6B5]/90">
          Ready when you are
        </p>
        <h2 className="relative mx-auto mt-3 max-w-2xl font-serif text-3xl leading-tight sm:text-5xl">
          Open your album. <span className="italic">Relive the day.</span>
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-base text-[#D6C8B8] sm:text-lg">
          Sign in to your private gallery and let the photos find you.
        </p>

        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#FAF7F2] px-6 text-sm font-medium text-[#1F1B16] shadow-lg shadow-black/20 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
          >
            Open your album
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
              strokeWidth={1.75}
            />
          </Link>

          <Link
            href="/contact"
            className="inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-sm font-medium text-[#FAF7F2] transition hover:border-white/40 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
          >
            Talk to us
          </Link>
        </div>

        {!prefersReducedMotion ? (
          <BorderBeam
            size={160}
            duration={16}
            colorFrom="#D8C7A4"
            colorTo="#78846F"
            borderWidth={1}
          />
        ) : null}
      </motion.div>
    </section>
  );
}

const landingFeatureRail = [
  ["01", "Upload", "Device, Drive, Photos, RAW"],
  ["02", "Discover", "People, groups, visual search"],
  ["03", "Review", "Culling, duplicates, best by person"],
  ["04", "Finish", "AI edits, LUTs, collages"],
  ["05", "Deliver", "Private links, watermarks, downloads"],
] as const;

const searchDemoQueries = [
  { query: "Find photos of the bride with her grandparents", result: "Family moments", image: "/reception.png", tags: ["Bride", "Family", "Reception"] },
  { query: "Show couple portraits at golden hour", result: "Golden-hour portraits", image: "/glow_1.png", tags: ["Couple", "Portrait", "Golden hour"] },
  { query: "Only photos where these people are together", result: "People together", image: "/laugh_1.png", tags: ["People filter", "Together", "Private album"] },
] as const;

function InteractiveSearchDemo() {
  const [activeQuery, setActiveQuery] = useState(0);
  const demo = searchDemoQueries[activeQuery];

  return (
    <section id="search-demo" className="scroll-mt-20 overflow-hidden bg-[#F5EF45] text-[#151515]">
      <div className="mx-auto max-w-[92rem] px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]">Try the idea</p>
            <h2 className="mt-4 max-w-xl text-5xl font-semibold leading-[0.94] tracking-[-0.045em] sm:text-7xl">A thousand photos. One sentence.</h2>
            <p className="mt-6 max-w-lg text-base leading-7 text-black/65 sm:text-lg">Clients do not want to scroll forever. Type a person, a relationship, a scene, or a visible detail. SaathiDesk returns the photos that match.</p>
            <div className="mt-8 space-y-2">
              {searchDemoQueries.map((item, index) => (
                <button key={item.query} type="button" onClick={() => setActiveQuery(index)} className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl px-4 text-left text-sm font-semibold transition ${index === activeQuery ? "bg-black text-white" : "bg-white/45 text-black hover:bg-white/70"}`} aria-pressed={index === activeQuery}>
                  <Search className="h-4 w-4 shrink-0" /><span>{item.query}</span><ArrowRight className="ml-auto h-4 w-4 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] bg-[#171717] p-3 shadow-[0_38px_80px_-38px_rgba(0,0,0,0.55)] sm:p-5">
            <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-4 text-sm text-[#343434] shadow-sm">
              <Search className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1 truncate">{demo.query}</span><span className="rounded-full bg-[#F5EF45] px-3 py-1.5 text-xs font-bold text-black">Search</span>
            </div>
            <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-[1.45rem] bg-[#2A2A2A]">
              <Image key={demo.image} src={demo.image} alt="Example gallery search result" fill sizes="(min-width:1024px) 55vw, 100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <div className="absolute inset-x-5 bottom-5 text-white">
                <p className="text-2xl font-semibold tracking-tight sm:text-4xl">{demo.result}</p>
                <div className="mt-3 flex flex-wrap gap-2">{demo.tags.map((tag) => <span key={tag} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur">{tag}</span>)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFeatureRail() {
  return (
    <section aria-label="SaathiDesk workflow" className="border-y border-black/10 bg-[#171411] text-[#FAF7F2]">
      <div className="mx-auto grid max-w-7xl divide-y divide-white/10 px-5 sm:px-8 md:grid-cols-5 md:divide-x md:divide-y-0">
        {landingFeatureRail.map(([number, title, body]) => (
          <a key={number} href="#platform" className="group flex min-h-28 cursor-pointer items-start gap-4 py-5 transition-colors hover:bg-white/[0.04] md:px-5 md:first:pl-0">
            <span className="font-serif text-xs tracking-[0.18em] text-[#E7D6B5]/65">{number}</span>
            <span>
              <strong className="block text-sm font-semibold text-white">{title}</strong>
              <span className="mt-1 block text-xs leading-5 text-white/55">{body}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function LandingFeatureIndex({ reveal, stagger }: { reveal: MotionProps; stagger: MotionProps }) {
  return (
    <section id="platform" className="relative overflow-hidden bg-[#171411] text-[#FAF7F2]">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(199,161,91,0.18),transparent_30%),radial-gradient(circle_at_90%_70%,rgba(104,128,109,0.18),transparent_34%)]" />
      <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <motion.div {...reveal} className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#E7D6B5]">One working album</p>
            <h2 className="mt-3 font-serif text-4xl leading-[1.02] sm:text-6xl">Everything after the shutter.</h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-white/60 sm:text-lg">SaathiDesk keeps the original files, the AI work, the review decisions, and the client delivery in one album. No feature lives in a disconnected side tool.</p>
        </motion.div>

        <motion.div {...stagger} className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featureGuides.map((guide, index) => {
            const Icon = guide.icon;
            return (
              <motion.article key={guide.id} variants={itemVariants} className={`group flex min-h-72 flex-col rounded-[1.5rem] border border-white/10 p-6 transition duration-300 hover:-translate-y-1 hover:border-white/25 ${index === 0 || index === 5 ? "bg-[#F0E4D5] text-[#1F1B16]" : "bg-white/[0.045]"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.17em] opacity-60">{guide.eyebrow}</span>
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full ${index === 0 || index === 5 ? "bg-[#171411] text-white" : "bg-white/10 text-[#E7D6B5]"}`}><Icon className="h-5 w-5" strokeWidth={1.6} /></span>
                </div>
                <h3 className="mt-12 font-serif text-3xl leading-tight">{guide.title}</h3>
                <p className="mt-4 text-sm leading-6 opacity-65">{guide.body}</p>
                <div className="mt-auto pt-7 text-xs font-medium uppercase tracking-[0.14em] opacity-55">{guide.routeLabel}</div>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function OpenSourceCallout({ reveal }: { reveal: MotionProps }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
      <motion.div {...reveal} className="grid overflow-hidden rounded-[2rem] border border-[#D9D1C6] bg-[#E9E1D6] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="p-7 sm:p-12">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8A6534]">Free and open source</p>
          <h2 className="mt-4 max-w-2xl font-serif text-4xl leading-[1.05] text-[#1F1B16] sm:text-6xl">A gallery stack you can inspect, adapt, and run.</h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#655D54]">Private galleries, people filters, AI search, culling, edits, collages, watermarks, and controlled downloads are part of the same MIT-licensed project.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login?mode=signup" className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full bg-[#171411] px-6 text-sm font-semibold text-white transition hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30">Start free <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/docs" className="inline-flex h-12 cursor-pointer items-center rounded-full border border-[#BDB2A4] bg-white/55 px-6 text-sm font-semibold text-[#1F1B16] transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20">See how it works</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-[#D0C5B7] lg:border-l lg:border-t-0">
          {[['Open','Source'],['MIT','License'],['RAW','Originals kept'],['AI','Album scoped']].map(([value,label]) => (
            <div key={label} className="flex min-h-40 flex-col justify-end border-b border-r border-[#D0C5B7] p-6 last:border-b-0">
              <strong className="font-serif text-4xl text-[#1F1B16]">{value}</strong>
              <span className="mt-2 text-xs uppercase tracking-[0.14em] text-[#756B60]">{label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

function AiDiscoveryShowcase({
  reveal,
  stagger,
}: {
  reveal: MotionProps;
  stagger: MotionProps;
}) {
  return (
    <section className="border-b border-[#E8DED2]/70 bg-[#F7F5F0]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <motion.div {...reveal} className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#A77C45]">
            Guest discovery
          </p>
          <h2 className="mt-3 font-serif text-3xl leading-[1.08] text-[#1F1B16] sm:text-5xl">
            AI tools that help guests find their photos.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#6F675E] sm:text-lg">
            SaathiDesk helps guests search large galleries by people, groups,
            and meaningful moments.
          </p>
        </motion.div>

        <motion.div
          {...stagger}
          className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          {aiDiscoveryFeatures.map((feature) => {
            const Icon = feature.icon;

            return (
              <motion.article
                key={feature.title}
                variants={itemVariants}
                className="group overflow-hidden rounded-2xl border border-[#E8DED2] bg-white shadow-[0_18px_50px_-36px_rgba(0,0,0,0.35)] transition duration-500 hover:-translate-y-1 hover:border-[#C8B8A6]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#E8DED2]">
                  <ResponsiveAiGuideImage
                    title={feature.title}
                    desktopImageSrc={feature.desktopImageSrc}
                    mobileImageSrc={feature.mobileImageSrc}
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1F1B16] text-[#F7F5F0]">
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <h3 className="text-sm font-semibold leading-tight text-[#1F1B16]">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#6F675E]">
                    {feature.body}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function ResponsiveAiGuideImage({
  title,
  desktopImageSrc,
  mobileImageSrc,
}: {
  title: string;
  desktopImageSrc: string;
  mobileImageSrc: string;
}) {
  const [resolvedMobileImageSrc, setResolvedMobileImageSrc] =
    useState(mobileImageSrc);

  useEffect(() => {
    setResolvedMobileImageSrc(mobileImageSrc);
  }, [mobileImageSrc]);

  return (
    <>
      <Image
        src={resolvedMobileImageSrc}
        alt={title}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 240px"
        className="object-contain p-2 transition duration-500 group-hover:scale-[1.03] md:hidden"
        onError={() => setResolvedMobileImageSrc(desktopImageSrc)}
      />
      <Image
        src={desktopImageSrc}
        alt={title}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 240px"
        className="hidden object-contain p-2 transition duration-500 group-hover:scale-[1.03] md:block"
      />
    </>
  );
}

export function DocsPageContent() {
  const reveal = useReveal();
  const stagger = useStagger();

  return (
    <>
      <DocsHub reveal={reveal} stagger={stagger} />
      <FeatureGuides reveal={reveal} stagger={stagger} />
    </>
  );
}

export function HowAiWorksPageContent() {
  const reveal = useReveal();
  const stagger = useStagger();

  return (
    <>
      <AiWorkflow reveal={reveal} stagger={stagger} />
      <PromptGuide reveal={reveal} stagger={stagger} />
    </>
  );
}

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#F7F5F0]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group inline-flex items-center gap-2 rounded-md text-[#1F1B16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30" aria-label="SaathiDesk home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1C1B18] text-[#F7F5F0] transition-transform duration-300 group-hover:scale-[1.03]"><Camera className="h-4 w-4" strokeWidth={1.75} /></span>
          <span className="font-serif text-lg leading-none tracking-tight">SaathiDesk</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <a href="#platform" className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-[#4F473F] transition hover:text-[#1F1B16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 md:inline-flex">Features</a>
          <Link href="/docs" className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-[#4F473F] transition hover:text-[#1F1B16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 md:inline-flex">Docs</Link>
          <Link href="/how-ai-works" className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-[#4F473F] transition hover:text-[#1F1B16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 lg:inline-flex">How AI works</Link>
          <Link href="/login" className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-[#4F473F] transition hover:text-[#1F1B16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 sm:inline-flex">Sign in</Link>
          <Link href="/login?mode=signup" className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-[#1C1B18] px-4 text-sm font-medium text-[#F7F5F0] shadow-sm transition hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30">Start free <ArrowRight className="h-4 w-4" strokeWidth={1.75} /></Link>
        </nav>
      </div>
    </header>
  );
}

function Hero({ reveal }: { reveal: MotionProps }) {
  return (
    <section className="relative overflow-hidden bg-[#EDE8DF] pb-16 pt-14 text-[#171411] sm:pb-24 sm:pt-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.24] saturate-[0.7]"
      >
        <AvalHero />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#EDE8DF]/65"
      />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_82%_8%,rgba(202,161,110,0.34),transparent_30%),radial-gradient(circle_at_8%_72%,rgba(112,138,116,0.22),transparent_28%)]" />
      <div className="relative mx-auto max-w-[92rem] px-5 sm:px-8">
        <motion.div {...reveal} className="mx-auto max-w-6xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#725C3D]">The wedding photo workspace</p>
          <h1 className="mt-5 font-serif text-[clamp(3.5rem,9vw,8.5rem)] leading-[0.84] tracking-[-0.055em]">One home for the<br /><span className="italic text-[#744E43]">whole celebration.</span></h1>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-[#5E564D] sm:text-xl sm:leading-8">Bring in every event, find the people and moments that matter, review the strongest frames, and deliver a private gallery without breaking the story across tools.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login?mode=signup" className="group inline-flex h-12 cursor-pointer items-center gap-2 rounded-full bg-[#171411] px-6 text-sm font-semibold text-white transition-colors hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#171411]/40">Start free <ArrowRight className="h-4 w-4 transition-transform motion-reduce:transition-none group-hover:translate-x-0.5" /></Link>
            <a href="#product-tour" className="inline-flex h-12 cursor-pointer items-center rounded-full border border-black/15 bg-white/55 px-6 text-sm font-semibold transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25">Tour the workspace</a>
          </div>
        </motion.div>
        <motion.div {...reveal} className="mx-auto mt-12 max-w-7xl sm:mt-16">
          <SoftwareWindow title="Aanya & Dev · Wedding weekend" status="AI processing complete">
            <div className="grid min-h-[420px] grid-cols-[4.5rem_1fr] bg-[#F4F1EB] sm:grid-cols-[12rem_1fr] lg:min-h-[610px]">
              <DemoSidebar active="Photos" />
              <div className="min-w-0 p-3 sm:p-6">
                <div className="flex flex-col gap-3 border-b border-black/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-xs font-semibold text-[#80766B]">Reception</p><h2 className="mt-1 text-xl font-semibold sm:text-2xl">All moments</h2></div>
                  <div className="flex gap-2"><DemoControl icon={Search} label="Search" /><DemoControl icon={Users} label="People" /></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                  {["/reception.png", "/laugh_1.png", "/glow_1.png", "/First%20look.png", "/filter_1.png", "/collage.png", "/download.png", "/hero_one.png"].map((src, index) => <div key={src} className={`relative overflow-hidden rounded-lg bg-[#D8D1C7] ${index === 0 || index === 5 ? "aspect-[4/5] sm:row-span-2" : "aspect-square"}`}><Image src={src} alt="" fill sizes="(min-width:640px) 22vw, 45vw" className="object-cover" /><span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white">{index < 3 ? "Keeper" : "Ready"}</span></div>)}
                </div>
              </div>
            </div>
          </SoftwareWindow>
        </motion.div>
      </div>
    </section>
  );
}

function SoftwareWindow({ title, status, children }: { title: string; status: string; children: ReactNode }) {
  return <div className="overflow-hidden rounded-[1.25rem] border border-black/15 bg-[#1D1B19] shadow-[0_45px_100px_-48px_rgba(23,20,17,0.65)] sm:rounded-[2rem]"><div className="flex min-h-14 items-center gap-3 border-b border-white/10 px-4 text-white sm:px-6"><div aria-hidden className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#D27B68]" /><span className="h-2.5 w-2.5 rounded-full bg-[#D7AF62]" /><span className="h-2.5 w-2.5 rounded-full bg-[#79977D]" /></div><span className="min-w-0 flex-1 truncate text-xs font-semibold sm:text-sm">{title}</span><span className="hidden items-center gap-1.5 text-xs text-white/60 sm:flex"><CheckCircle2 className="h-3.5 w-3.5 text-[#A7C6A9]" />{status}</span></div>{children}</div>;
}

function DemoSidebar({ active }: { active: string }) {
  return <nav aria-label="Demo navigation" className="border-r border-black/10 bg-[#E9E3DA] p-2 sm:p-4"><div className="mb-6 hidden font-serif text-lg sm:block">SaathiDesk</div>{[[Camera,"Photos"],[Users,"People"],[SlidersHorizontal,"Cull"],[Wand2,"Finish"],[Share2,"Share"]].map(([Icon,label]) => { const DemoIcon = Icon as LucideIcon; return <div key={label as string} className={`mb-1 flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold sm:justify-start sm:px-3 ${active === label ? "bg-[#1D1B19] text-white" : "text-[#71685F]"}`}><DemoIcon className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{label as string}</span></div>;})}</nav>;
}

function DemoControl({ icon: Icon, label, active = false }: { icon: LucideIcon; label: string; active?: boolean }) {
  return <span className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${active ? "border-[#1D1B19] bg-[#1D1B19] text-white" : "border-black/10 bg-white text-[#514A43]"}`}><Icon className="h-3.5 w-3.5" />{label}</span>;
}

const audienceWorkflows = [
  { id: "photographers", label: "Photographers", title: "Stay in the creative flow.", body: "Move from upload queues to event organization, AI-assisted review, finishing, and client delivery in one album.", active: "Cull", note: "Review · Needs attention", action: "Keep selected" },
  { id: "studios", label: "Studios", title: "Keep every job legible.", body: "Organize customers, albums, events, cover images, processing state, and sharing permissions from a consistent workspace.", active: "Photos", note: "Albums · This season", action: "Open album" },
  { id: "clients", label: "Clients & guests", title: "Find the moments you came for.", body: "Open a private gallery, browse by event or people, search visual details, select favorites, and download when enabled.", active: "People", note: "People · Reception", action: "View photos" },
] as const;

function AudienceWorkflow() {
  const [active, setActive] = useState(0);
  const workflow = audienceWorkflows[active];
  return <section className="bg-[#171411] py-20 text-[#FAF7F2] sm:py-28"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D9BF8D]">Built around the handoff</p><h2 className="mt-4 font-serif text-4xl leading-[0.95] sm:text-6xl">One wedding.<br />Three ways in.</h2><div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Audience workflows">{audienceWorkflows.map((item,index) => <button key={item.id} role="tab" aria-selected={index === active} aria-controls="audience-demo" type="button" onClick={() => setActive(index)} className={`min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E7D6B5] ${index === active ? "bg-[#F5EF45] text-black" : "bg-white/8 text-white hover:bg-white/15"}`}>{item.label}</button>)}</div><h3 className="mt-8 font-serif text-3xl">{workflow.title}</h3><p className="mt-3 max-w-lg leading-7 text-white/60">{workflow.body}</p></div><div id="audience-demo" role="tabpanel"><SoftwareWindow title={workflow.note} status="Album ready"><div className="grid min-h-[390px] grid-cols-[4.5rem_1fr] bg-[#F2EEE7] sm:grid-cols-[10rem_1fr]"><DemoSidebar active={workflow.active} /><div className="p-3 sm:p-5"><div className="flex items-center justify-between"><div><p className="text-xs text-[#766D63]">Aanya & Dev</p><p className="mt-1 font-semibold text-[#1D1B19]">{workflow.note}</p></div><DemoControl icon={ArrowRight} label={workflow.action} active /></div><div className="mt-5 grid grid-cols-3 gap-2">{["/laugh_1.png","/reception.png","/glow_1.png","/First%20look.png","/hero_one.png","/filter_1.png"].map((src,index) => <div key={src} className="relative aspect-[4/5] overflow-hidden rounded-lg bg-[#D7D0C6]"><Image src={src} alt="" fill sizes="20vw" className="object-cover" />{index < 2 ? <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#F5EF45] text-black"><CheckCircle2 className="h-3.5 w-3.5" /></span> : null}</div>)}</div></div></div></SoftwareWindow></div></div></div></section>;
}

const tourSteps = [
  { label: "Bring it in", title: "Upload by event", body: "Add photos from a device, Google Drive, or Google Photos. The queue keeps processing and retry state visible.", active: "Photos", image: "/hero_one.png" },
  { label: "Make it findable", title: "Build people and scene context", body: "Album-scoped processing prepares previews, face groups, descriptions, and search metadata.", active: "People", image: "/laugh_1.png" },
  { label: "Shape the set", title: "Review with context", body: "Use duplicate clusters, quality signals, photo types, and best-by-person views as a starting point for your choices.", active: "Cull", image: "/glow_1.png" },
  { label: "Hand it over", title: "Share on your terms", body: "Set passcodes, watermarked previews, and download controls before sending the album link.", active: "Share", image: "/reception.png" },
] as const;

function ProductTour({ reveal }: { reveal: MotionProps }) {
  const [step, setStep] = useState(0); const current = tourSteps[step];
  return <section id="product-tour" className="scroll-mt-20 bg-[#F7F5F0] py-20 sm:py-28"><div className="mx-auto max-w-7xl px-5 sm:px-8"><motion.div {...reveal} className="max-w-4xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6534]">Product tour</p><h2 className="mt-4 font-serif text-5xl leading-[0.94] sm:text-7xl">The full journey stays visible.</h2></motion.div><div className="mt-10 grid gap-6 lg:grid-cols-[0.65fr_1.35fr]"><div className="space-y-2" role="tablist" aria-label="Product tour">{tourSteps.map((item,index) => <button key={item.label} role="tab" aria-selected={index === step} type="button" onClick={() => setStep(index)} className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 ${index === step ? "border-[#171411] bg-[#171411] text-white" : "border-black/10 bg-white hover:border-black/25"}`}><span className="text-xs font-bold uppercase tracking-[0.14em] opacity-55">0{index+1} · {item.label}</span><span className="mt-2 block text-lg font-semibold">{item.title}</span>{index === step ? <span className="mt-2 block text-sm leading-6 text-white/60">{item.body}</span> : null}</button>)}</div><div role="tabpanel"><SoftwareWindow title={current.title} status={`Step ${step+1} of 4`}><div className="grid min-h-[440px] grid-cols-[4.5rem_1fr] bg-[#EFEAE2] sm:grid-cols-[10rem_1fr]"><DemoSidebar active={current.active} /><div className="p-4 sm:p-6"><div className="flex flex-wrap gap-2"><DemoControl icon={Layers3} label="Reception" active /><DemoControl icon={SlidersHorizontal} label="Filters" /><DemoControl icon={Share2} label="Actions" /></div><div className="relative mt-5 min-h-[300px] overflow-hidden rounded-xl bg-[#CCC3B7]"><Image key={current.image} src={current.image} alt="Wedding gallery workflow preview" fill sizes="(min-width:1024px) 50vw, 80vw" className="object-cover" /><div className="absolute inset-x-3 bottom-3 rounded-xl bg-[#FBF8F2]/95 p-4 shadow-lg"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171411] text-white"><CheckCircle2 className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-[#171411]">{current.title}</p><p className="text-xs text-[#70675D]">{current.body}</p></div></div></div></div></div></div></SoftwareWindow></div></div></div></section>;
}

function ProductStories({ reveal }: { reveal: MotionProps }) {
  return <div className="bg-[#F7F5F0]"><StorySection reveal={reveal} eyebrow="01 · Ingest + organize" title="A calm intake for a very big day." body="Split a wedding into events, watch uploads move through the queue, retry failed files, and keep the original source attached to the right album." tone="bg-[#C8D5C5]" active="Photos" image="/First%20look.png" chips={["Device", "Google Drive", "Google Photos", "Processing"]} /><InteractiveSearchDemo /><StorySection reveal={reveal} eyebrow="03 · Cull + finish" title="Decisions beside the frames." body="Review duplicate clusters and quality signals, mark keepers, then move selected photos into presets, AI edits, or collage layouts while originals remain available." tone="bg-[#E6C7BC]" active="Cull" image="/filter_1.png" chips={["Needs review", "Duplicates", "Best by person", "Presets"]} reverse /><StorySection reveal={reveal} eyebrow="04 · Private delivery" title="A gallery with boundaries built in." body="Choose the cover, event order, passcode, watermark, and download permissions. Clients receive a focused album rather than a folder of files." tone="bg-[#C7C2E3]" active="Share" image="/download.png" chips={["Passcode", "Watermark", "Selected download", "Share link"]} /></div>;
}

function StorySection({ reveal, eyebrow, title, body, tone, active, image, chips, reverse = false }: { reveal: MotionProps; eyebrow: string; title: string; body: string; tone: string; active: string; image: string; chips: readonly string[]; reverse?: boolean }) {
  return <section className={`${tone} py-20 sm:py-28`}><div className={`mx-auto grid max-w-[92rem] gap-10 px-5 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}><motion.div {...reveal}><p className="text-xs font-bold uppercase tracking-[0.18em] text-black/55">{eyebrow}</p><h2 className="mt-4 font-serif text-5xl leading-[0.94] tracking-[-0.035em] sm:text-7xl">{title}</h2><p className="mt-6 max-w-xl text-base leading-7 text-black/65 sm:text-lg">{body}</p><div className="mt-7 flex flex-wrap gap-2">{chips.map(chip => <span key={chip} className="rounded-full border border-black/15 bg-white/35 px-3 py-2 text-xs font-semibold">{chip}</span>)}</div></motion.div><SoftwareWindow title="Aanya & Dev" status="Changes saved"><div className="grid min-h-[480px] grid-cols-[4.5rem_1fr] bg-[#F2EEE8] sm:grid-cols-[10rem_1fr]"><DemoSidebar active={active} /><div className="p-3 sm:p-5"><div className="flex items-center justify-between"><DemoControl icon={SlidersHorizontal} label={chips[0]} active /><DemoControl icon={CheckCircle2} label="Apply" /></div><div className="relative mt-4 min-h-[350px] overflow-hidden rounded-xl"><Image src={image} alt="SaathiDesk product workflow" fill sizes="(min-width:1024px) 55vw, 80vw" className="object-cover" /><div className="absolute inset-x-3 bottom-3 grid grid-cols-3 gap-2 rounded-xl bg-[#171411]/90 p-3 text-white backdrop-blur"><div><p className="text-[10px] uppercase text-white/45">Status</p><p className="mt-1 text-xs font-semibold">Ready</p></div><div><p className="text-[10px] uppercase text-white/45">Event</p><p className="mt-1 text-xs font-semibold">Reception</p></div><div><p className="text-[10px] uppercase text-white/45">Action</p><p className="mt-1 text-xs font-semibold">{chips[1]}</p></div></div></div></div></div></SoftwareWindow></div></section>;
}

function DocsHub({
  reveal,
  stagger,
}: {
  reveal: MotionProps;
  stagger: MotionProps;
}) {
  return (
    <section id="docs" className="relative border-y border-[#E8DED2]/70 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <motion.div
          {...reveal}
          className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#A77C45]">
              Documentation hub
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-[1.1] text-[#1F1B16] sm:text-5xl">
              Clear paths for every <span className="italic">album job.</span>
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#6F675E] sm:text-lg">
              SaathiDesk is both a client gallery and a studio workspace. These
              quick pages explain where to go, what the AI prepares, and how to
              deliver a finished set with the right privacy controls.
            </p>
          </div>

          <a
            href="#guides"
            className="inline-flex h-11 w-fit items-center gap-2 rounded-full border border-[#D6C8B8] bg-[#FAF7F2] px-5 text-sm font-medium text-[#1F1B16] transition hover:border-[#C8B8A6] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30"
          >
            View all guides
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </a>
        </motion.div>

        <motion.div {...stagger} className="mt-10">
          <BentoGrid className="auto-rows-auto grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {docPages.map((page) => {
              const Icon = page.icon;

              return (
                <motion.article
                  key={page.title}
                  variants={itemVariants}
                  className="group col-span-1 flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-[#F7F5F0] shadow-[0_1px_0_rgba(0,0,0,0.02),0_18px_50px_-38px_rgba(0,0,0,0.3)] transition duration-500 hover:-translate-y-1 hover:border-black/15 hover:shadow-xl"
                >
                  <DocPhotoPlate
                    icon={Icon}
                    title={page.title}
                    tone={page.tone}
                    label={page.eyebrow}
                  />

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1C1B18] text-[#F7F5F0] transition group-hover:bg-[#6F795F]">
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <h3 className="font-serif text-xl leading-tight text-[#1F1B16]">
                        {page.title}
                      </h3>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-[#6F675E]">
                      {page.body}
                    </p>

                    <ul className="mt-4 space-y-2 text-sm text-[#4F473F]">
                      {page.highlights.map((highlight) => (
                        <li key={highlight} className="flex gap-2">
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-[#66735F]"
                            strokeWidth={2}
                          />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={page.href}
                      className="mt-5 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[#1F1B16] transition hover:text-[#6F795F]"
                    >
                      Open guide
                      <ArrowRight
                        className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                        strokeWidth={1.75}
                      />
                    </Link>
                  </div>
                </motion.article>
              );
            })}
          </BentoGrid>
        </motion.div>
      </div>
    </section>
  );
}

function DocPhotoPlate({
  icon: Icon,
  title,
  tone,
  label,
}: {
  icon: LucideIcon;
  title: string;
  tone: PlateTone;
  label: string;
}) {
  const toneStyle = toneStyles[tone];
  const grainId = useId().replace(/:/g, "");
  const words = title.split(" ");
  const lead = words.slice(0, 2).join(" ");
  const rest = words.slice(2).join(" ");

  return (
    <div className="relative aspect-[4/3] overflow-hidden" style={{ background: toneStyle.background }}>
      <div
        aria-hidden
        className="absolute inset-0 mix-blend-soft-light"
        style={{
          background:
            "radial-gradient(40% 35% at 25% 25%, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0) 70%), radial-gradient(55% 45% at 85% 75%, rgba(40,20,10,0.35) 0%, rgba(40,20,10,0) 75%)",
        }}
      />
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full mix-blend-overlay"
        style={{ opacity: toneStyle.grainOpacity }}
      >
        <filter id={grainId}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0.45 0"
          />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${grainId})`} />
      </svg>

      <span className="absolute left-4 top-4 inline-flex h-8 items-center rounded-full bg-white/85 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-[#4F473F] ring-1 ring-[#1F1B16]/10 backdrop-blur">
        {label}
      </span>

      <Icon
        aria-hidden
        className="absolute -right-5 -bottom-6 h-36 w-36 text-white/18"
        strokeWidth={1}
      />

      <div className="absolute inset-x-4 bottom-4">
        <p className="max-w-[12rem] font-serif text-2xl leading-[1.05] text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.18)]">
          {lead}
          {rest ? <span className="block italic text-white/80">{rest}</span> : null}
        </p>
      </div>

      <div
        aria-hidden
        className="absolute inset-3 rounded-xl ring-1 ring-white/15"
      />
    </div>
  );
}

function AiWorkflow({
  reveal,
  stagger,
}: {
  reveal: MotionProps;
  stagger: MotionProps;
}) {
  return (
    <section id="ai-workflow" className="relative overflow-hidden bg-[#171411] text-[#FAF7F2]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 60% at 10% 0%, rgba(252,217,177,0.18) 0%, rgba(252,217,177,0) 70%), radial-gradient(55% 60% at 100% 35%, rgba(115,150,135,0.22) 0%, rgba(115,150,135,0) 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <motion.div {...reveal}>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#E7D6B5]/90">
              How the AI works
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-[1.1] sm:text-5xl">
              From upload to <span className="italic">findable gallery.</span>
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#D6C8B8] sm:text-lg">
              AI processing is submitted by an authenticated album owner, handled
              by the configured worker, then written back as searchable metadata,
              people groups, review scores, and optional edited outputs.
            </p>

            <div className="mt-7 grid gap-3 text-sm text-[#D6C8B8] sm:grid-cols-2">
              {[
                "Original photos stay separate from generated previews and edits.",
                "AI metadata is scoped to the album and event the photo belongs to.",
                "Ask AI returns matching photos; culling views handle review and ranking.",
                "Share permissions still decide what guests can view or download.",
              ].map((note) => (
                <div
                  key={note}
                  className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                >
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#B7C4AA]"
                    strokeWidth={2}
                  />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            {...reveal}
            className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_30px_80px_-35px_rgba(0,0,0,0.8)]"
          >
            <AiSystemPreview />
          </motion.div>
        </div>

        <motion.div
          {...stagger}
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {aiWorkflowSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <motion.article
                key={step.title}
                variants={itemVariants}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] p-5 ring-1 ring-white/5"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="font-serif text-sm tracking-[0.22em] text-[#E7D6B5]/80">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#E7D6B5] ring-1 ring-white/10">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                </div>
                <h3 className="mt-5 font-serif text-xl leading-tight">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#D6C8B8]">
                  {step.body}
                </p>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function AiSystemPreview() {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-[1.1rem] bg-[#FAF7F2] text-[#1F1B16]">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(145deg, #FFF8ED 0%, #E7D6B5 48%, #5F755C 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-tr from-[#171411]/55 via-[#171411]/5 to-white/20"
      />

      <div className="absolute left-4 top-4 rounded-2xl bg-white/85 p-3 shadow-lg ring-1 ring-[#1F1B16]/10 backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-medium text-[#4F473F]">
          <UploadCloud className="h-4 w-4 text-[#8B8176]" strokeWidth={1.75} />
          Upload complete
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {["#E8CFC3", "#D6C8B8", "#B7C4AA", "#B88366", "#8A7252", "#B8CDD3"].map(
            (color, index) => (
              <span
                key={color}
                className="h-10 rounded-md ring-1 ring-[#1F1B16]/5"
                style={{ backgroundColor: color, opacity: index === 5 ? 0.85 : 1 }}
              />
            ),
          )}
        </div>
      </div>

      <div className="absolute right-4 top-14 w-52 rounded-2xl bg-[#171411]/82 p-3 text-[#FAF7F2] shadow-xl ring-1 ring-white/10 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#E7D6B5]">
            Pipeline
          </span>
          <Sparkles className="h-4 w-4 text-[#E7D6B5]" strokeWidth={1.75} />
        </div>
        <div className="mt-3 space-y-2">
          {[
            ["Faces", "grouped"],
            ["Scenes", "described"],
            ["Search", "indexed"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-full bg-white/10 px-3 py-1.5 text-xs"
            >
              <span>{label}</span>
              <span className="text-[#DDE8D5]">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/88 p-3 shadow-xl ring-1 ring-[#1F1B16]/10 backdrop-blur">
        <div className="flex items-center gap-2 rounded-xl bg-[#F7F1E8] px-3 py-2 ring-1 ring-[#E8DED2]/70">
          <Search className="h-4 w-4 text-[#8B8176]" strokeWidth={1.75} />
          <span className="truncate text-sm text-[#4F473F]">
            bride jewelry near floral stage
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-[#4F473F]">
          {["14 matches", "2 people", "ceremony event"].map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-[#F3EDE4] px-2 py-1 ring-1 ring-[#E8DED2]"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PromptGuide({
  reveal,
  stagger,
}: {
  reveal: MotionProps;
  stagger: MotionProps;
}) {
  return (
    <section id="ai-search-guide" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
      <motion.div
        {...reveal}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#A77C45]">
            Ask AI directions
          </p>
          <h2 className="mt-3 font-serif text-3xl leading-[1.1] text-[#1F1B16] sm:text-5xl">
            Search like you are describing <span className="italic">a frame.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#6F675E] sm:text-lg">
            Ask AI is strongest when the prompt names a person, a scene, or a
            visible detail. It returns matching photos, while culling and review
            pages handle best-photo comparisons.
          </p>
        </div>

        <Link
          href="/docs#search-guide"
          className="inline-flex h-11 w-fit items-center gap-2 rounded-full border border-[#D6C8B8] bg-white px-5 text-sm font-medium text-[#1F1B16] transition hover:border-[#C8B8A6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30"
        >
          Search guide
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </motion.div>

      <motion.div
        {...stagger}
        className="mt-10 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_0.95fr]"
      >
        {promptGuides.map((guide) => {
          const Icon = guide.icon;

          return (
            <motion.article
              key={guide.title}
              variants={itemVariants}
              className="overflow-hidden rounded-2xl border border-[#E8DED2] bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)]"
            >
              <DocPhotoPlate
                icon={Icon}
                title={guide.title}
                tone={guide.tone}
                label="Prompt"
              />
              <div className="p-5">
                <h3 className="font-serif text-xl leading-tight text-[#1F1B16]">
                  {guide.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6F675E]">
                  {guide.body}
                </p>
                <div className="mt-4 space-y-2">
                  {guide.examples.map((example) => (
                    <code
                      key={example}
                      className="block rounded-lg bg-[#F7F1E8] px-3 py-2 text-xs text-[#4F473F] ring-1 ring-[#E8DED2]"
                    >
                      {example}
                    </code>
                  ))}
                </div>
              </div>
            </motion.article>
          );
        })}

        <motion.aside
          variants={itemVariants}
          className="rounded-2xl border border-[#E8DED2] bg-[#FAF7F2] p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#171411] text-[#FAF7F2]">
            <BookOpen className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <h3 className="mt-5 font-serif text-xl leading-tight text-[#1F1B16]">
            What to avoid
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[#6F675E]">
            Open-ended questions need a ranking layer. Use visual keywords or
            culling views instead.
          </p>
          <div className="mt-4 space-y-2">
            {[
              "who wore the most ornaments?",
              "which photo is the best?",
              "write a summary of the wedding",
            ].map((example) => (
              <code
                key={example}
                className="block rounded-lg bg-white px-3 py-2 text-xs text-[#8B8176] line-through decoration-[#B88366] ring-1 ring-[#E8DED2]"
              >
                {example}
              </code>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-[#EEF3EA] px-3 py-2 text-xs leading-relaxed text-[#4F6F52] ring-1 ring-[#DDE8D5]">
            Better: search for jewelry, bangles, saree, stage, couple portrait,
            family group, or a named person plus a visible detail.
          </p>
        </motion.aside>
      </motion.div>
    </section>
  );
}

function FeatureGuides({
  reveal,
  stagger,
}: {
  reveal: MotionProps;
  stagger: MotionProps;
}) {
  return (
    <section
      id="guides"
      className="relative border-y border-[#E8DED2]/70 bg-[#EFEBE4]"
    >
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <motion.div {...reveal} className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#A77C45]">
            Product walkthroughs
          </p>
          <h2 className="mt-3 font-serif text-3xl leading-[1.1] text-[#1F1B16] sm:text-5xl">
            The sub-pages your team <span className="italic">actually needs.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#6F675E] sm:text-lg">
            Each guide below maps to an existing app surface and explains the
            practical order of work, from first upload to final client handoff.
          </p>
        </motion.div>

        <motion.div {...stagger} className="mt-10 space-y-5">
          {featureGuides.map((guide, index) => {
            const Icon = guide.icon;
            const flip = index % 2 === 1;

            return (
              <motion.article
                id={guide.id}
                key={guide.id}
                variants={itemVariants}
                className="grid overflow-hidden rounded-2xl border border-[#E8DED2] bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)] lg:grid-cols-[0.85fr_1.15fr]"
              >
                <div className={flip ? "lg:order-2" : undefined}>
                  <DocPhotoPlate
                    icon={Icon}
                    title={guide.title}
                    tone={guide.tone}
                    label={guide.eyebrow}
                  />
                </div>

                <div className="flex flex-col justify-center p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex h-9 items-center rounded-full bg-[#171411] px-3 text-xs font-medium uppercase tracking-[0.16em] text-[#FAF7F2]">
                      {guide.eyebrow}
                    </span>
                    <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#F7F1E8] px-3 text-xs font-medium text-[#6F675E] ring-1 ring-[#E8DED2]">
                      <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {guide.routeLabel}
                    </span>
                  </div>

                  <h3 className="mt-5 font-serif text-2xl leading-tight text-[#1F1B16] sm:text-3xl">
                    {guide.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#6F675E] sm:text-base">
                    {guide.body}
                  </p>

                  <ol className="mt-6 grid gap-3 sm:grid-cols-2">
                    {guide.steps.map((step, stepIndex) => (
                      <li
                        key={step}
                        className="flex gap-3 rounded-xl border border-[#E8DED2] bg-[#FAF7F2] p-3 text-sm leading-relaxed text-[#4F473F]"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-[#4F473F] ring-1 ring-[#E8DED2]">
                          {stepIndex + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function MomentsCarousel({ reveal }: { reveal: MotionProps }) {
  const prefersReducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLUListElement>(null);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const updateEdgeState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollPrev(el.scrollLeft > 4);
    setCanScrollNext(el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateEdgeState();
    el.addEventListener("scroll", updateEdgeState, { passive: true });
    window.addEventListener("resize", updateEdgeState);
    return () => {
      el.removeEventListener("scroll", updateEdgeState);
      window.removeEventListener("resize", updateEdgeState);
    };
  }, [updateEdgeState]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { index: number; ratio: number } | null = null;
        for (const entry of entries) {
          const index = Number(
            (entry.target as HTMLElement).dataset.index ?? -1,
          );
          if (Number.isNaN(index) || index < 0) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { index, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio > 0.55) setActiveIndex(best.index);
      },
      { root, threshold: [0.55, 0.75, 0.95] },
    );

    for (const el of cardRefs.current) {
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  const scrollByDir = useCallback(
    (dir: 1 | -1) => {
      const el = scrollRef.current;
      if (!el) return;
      const card = cardRefs.current[0];
      const gap = 16;
      const step = card ? card.offsetWidth + gap : el.clientWidth * 0.8;
      el.scrollBy({
        left: dir * step,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    },
    [prefersReducedMotion],
  );

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = scrollRef.current;
      const card = cardRefs.current[index];
      if (!el || !card) return;
      el.scrollTo({
        left: card.offsetLeft - 16,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    },
    [prefersReducedMotion],
  );

  return (
    <section
      id="features"
      className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28"
    >
      <motion.div {...reveal} className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#A77C45]">
          Moments, not features
        </p>
        <h2 className="mt-3 font-serif text-3xl leading-[1.1] text-[#1F1B16] sm:text-5xl">
          A gallery that <span className="italic">remembers</span>
          <br className="hidden sm:block" /> for you.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[#6F675E] sm:text-lg">
          Swipe through the small, quiet ways your photographs become a story
          you can actually find your way back into.
        </p>
      </motion.div>

      <div className="relative mt-10 sm:mt-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-16 bg-gradient-to-r from-[#FAF7F2] to-transparent transition-opacity duration-300 sm:block"
          style={{ opacity: canScrollPrev ? 1 : 0 }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-16 bg-gradient-to-l from-[#FAF7F2] to-transparent transition-opacity duration-300 sm:block"
          style={{ opacity: canScrollNext ? 1 : 0 }}
        />

        <button
          type="button"
          onClick={() => scrollByDir(-1)}
          disabled={!canScrollPrev}
          aria-label="Previous moment"
          className="absolute -left-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[#E8DED2] bg-white/95 text-[#3A2A22] shadow-md backdrop-blur transition hover:border-[#D6C8B8] hover:text-[#1F1B16] disabled:cursor-not-allowed disabled:opacity-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 sm:flex"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={() => scrollByDir(1)}
          disabled={!canScrollNext}
          aria-label="Next moment"
          className="absolute -right-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[#E8DED2] bg-white/95 text-[#3A2A22] shadow-md backdrop-blur transition hover:border-[#D6C8B8] hover:text-[#1F1B16] disabled:cursor-not-allowed disabled:opacity-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 sm:flex"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
        </button>

        <ul
          ref={scrollRef}
          className="scrollbar-hide -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-5 pb-4 sm:-mx-8 sm:px-8 [scroll-padding-inline:1.25rem] sm:[scroll-padding-inline:2rem]"
          role="list"
        >
          {moments.map((moment, index) => (
            <li
              key={moment.title}
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              data-index={index}
              className="w-[82vw] max-w-[420px] shrink-0 snap-start sm:w-[58vw] md:w-[44vw] lg:w-[32vw] xl:w-[28rem]"
            >
              <MomentCard moment={moment} index={index} total={moments.length} />
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 sm:mt-8">
        {moments.map((m, i) => (
          <button
            key={m.title}
            type="button"
            onClick={() => scrollToIndex(i)}
            aria-label={`Go to ${m.title}`}
            aria-current={activeIndex === i}
            className="group inline-flex h-11 w-11 cursor-pointer items-center justify-center focus:outline-none"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                activeIndex === i
                  ? "w-8 bg-[#1F1B16]"
                  : "w-2 bg-[#D6C8B8] group-hover:bg-[#6F675E]"
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

function MomentCard({
  moment,
  index,
  total,
}: {
  moment: Moment;
  index: number;
  total: number;
}) {
  const { icon: Icon, title, body, eyebrow, src, alt, tone } = moment;
  const indexLabel = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  const toneStyle = toneStyles[tone];

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E8DED2] bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)] transition duration-500 hover:-translate-y-1 hover:border-[#D6C8B8] hover:shadow-xl">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#F3EDE4]">
        {src ? (
          <>
            <img
              src={src}
              alt={alt ?? title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent"
            />
          </>
        ) : (
          <EditorialPlate icon={Icon} title={title} tone={tone} toneStyle={toneStyle} />
        )}

        <span
          className="absolute left-4 top-4 font-serif text-xs tracking-[0.25em] text-white/90 drop-shadow-sm"
          aria-hidden
        >
          {indexLabel}
        </span>

        <span className="absolute right-4 top-4 inline-flex h-8 items-center rounded-full bg-white/85 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-[#4F473F] ring-1 ring-[#1F1B16]/10 backdrop-blur">
          {eyebrow}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#171411] text-[#FAF7F2] transition group-hover:bg-[#C6A15B]">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <h3 className="font-serif text-xl leading-tight text-[#1F1B16] sm:text-2xl">
            {title}
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-[#6F675E] sm:text-base">
          {body}
        </p>
      </div>
    </article>
  );
}

function EditorialPlate({
  icon: Icon,
  title,
  tone,
  toneStyle,
}: {
  icon: LucideIcon;
  title: string;
  tone: Moment["tone"];
  toneStyle: { background: string; grainOpacity: number };
}) {
  return (
    <div className="absolute inset-0" style={{ background: toneStyle.background }}>
      <div
        aria-hidden
        className="absolute inset-0 mix-blend-soft-light"
        style={{
          background:
            "radial-gradient(45% 35% at 25% 25%, rgba(255,236,210,0.7) 0%, rgba(255,236,210,0) 70%), radial-gradient(55% 45% at 80% 75%, rgba(40,20,10,0.35) 0%, rgba(40,20,10,0) 75%)",
        }}
      />

      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full mix-blend-overlay"
        style={{ opacity: toneStyle.grainOpacity }}
      >
        <filter id={`moment-grain-${tone}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0.5 0"
          />
        </filter>
        <rect width="100%" height="100%" filter={`url(#moment-grain-${tone})`} />
      </svg>

      <Icon
        aria-hidden
        className="absolute -right-4 -bottom-6 h-44 w-44 text-white/15"
        strokeWidth={1}
      />

      <div className="absolute inset-x-6 bottom-6">
        <p
          className="font-serif text-3xl leading-[1.05] text-white/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.18)] sm:text-4xl"
          aria-hidden
        >
          {title.split(" ").slice(0, 2).join(" ")}
          <span className="block italic text-white/80">
            {title.split(" ").slice(2).join(" ") || "—"}
          </span>
        </p>
      </div>

      <div
        aria-hidden
        className="absolute inset-3 rounded-xl ring-1 ring-white/15"
      />
    </div>
  );
}

function GalleryPreview({
  reveal,
  stagger,
}: {
  reveal: MotionProps;
  stagger: MotionProps;
}) {
  return (
    <section className="relative border-y border-[#E8DED2]/70 bg-[#EEEAE2]">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <motion.div
          {...reveal}
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#A77C45]">
              A glimpse
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-tight text-[#1F1B16] sm:text-4xl">
              The whole day, <span className="italic">held in light.</span>
            </h2>
            <p className="mt-3 text-base text-[#6F675E]">
              Masonry-style galleries, face filters and a focused viewer that
              feels as good on a phone as on a 27-inch screen.
            </p>
          </div>

          <Link
            href="/login"
            className="group inline-flex h-11 w-fit items-center gap-1.5 rounded-full border border-[#D6C8B8] bg-white px-5 text-sm font-medium text-[#1F1B16] transition hover:border-[#C8B8A6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 cursor-pointer"
          >
            Browse galleries
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
              strokeWidth={1.75}
            />
          </Link>
        </motion.div>

        <motion.div
          {...stagger}
          className="mt-10 grid auto-rows-[150px] grid-cols-2 gap-3 sm:auto-rows-[180px] sm:grid-cols-3 sm:gap-4 lg:auto-rows-[200px] lg:grid-cols-4"
        >
          {galleryTiles.map((tile, idx) => (
            <motion.div
              key={tile.label + idx}
              variants={itemVariants}
              className={`group relative overflow-hidden rounded-xl shadow-sm ring-1 ring-[#1F1B16]/5 transition duration-500 hover:shadow-lg ${tile.className}`}
              style={{ background: tile.gradient }}
            >
              {tile.src ? (
                <Image
                  src={tile.src}
                  alt={tile.label}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover"
                />
              ) : null}

              <div
                aria-hidden
                className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(60% 60% at 50% 50%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%)",
                }}
              />

              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent opacity-90"
              />

              {tile.badge && (
                <div
                  className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full ring-1 backdrop-blur ${
                    badgeToneClasses[tile.badge.tone]
                  }`}
                >
                  <tile.badge.icon className="h-3.5 w-3.5" strokeWidth={2} />
                </div>
              )}

              <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
                <p className="font-serif text-base leading-tight text-white drop-shadow-sm sm:text-lg">
                  {tile.label}
                </p>

                {tile.people ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-medium text-[#3A2A22] ring-1 ring-[#1F1B16]/5 backdrop-blur">
                    <Users className="h-3 w-3" strokeWidth={2} />
                    {tile.people}
                  </span>
                ) : null}
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div {...reveal} className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#8B8176]">
          <span className="inline-flex items-center gap-1.5"><Download className="h-3.5 w-3.5" strokeWidth={1.75} />Selected and event downloads</span>
          <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />AI photo edits</span>
          <span className="inline-flex items-center gap-1.5"><Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />Watermarked share links</span>
          <span className="inline-flex items-center gap-1.5"><Camera className="h-3.5 w-3.5" strokeWidth={1.75} />Collage exports</span>
        </motion.div>
      </div>
    </section>
  );
}

function FinalCTA({ reveal }: { reveal: MotionProps }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
      <motion.div {...reveal} className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#171411] px-6 py-14 text-center text-[#FAF7F2] shadow-[0_30px_80px_-45px_rgba(0,0,0,0.8)] sm:px-12 sm:py-20">
        {!prefersReducedMotion ? <AnimatedGridPattern width={56} height={56} numSquares={10} maxOpacity={0.08} duration={6} repeatDelay={2} className="fill-[#E7D6B5]/10 stroke-white/[0.06] [mask-image:radial-gradient(500px_circle_at_center,black,transparent)]" /> : null}
        <p className="relative text-xs font-medium uppercase tracking-[0.18em] text-[#E7D6B5]/90">Your next delivery</p>
        <h2 className="relative mx-auto mt-3 max-w-3xl font-serif text-3xl leading-tight sm:text-5xl">Give clients a gallery they can actually find themselves in.</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-base text-[#D6C8B8] sm:text-lg">Start with one album. Upload the event, run AI when you are ready, and send a private link when the story feels complete.</p>
        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login?mode=signup" className="group inline-flex h-12 cursor-pointer items-center gap-2 rounded-full bg-[#FAF7F2] px-6 text-sm font-medium text-[#1F1B16] shadow-lg shadow-black/20 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50">Start a free gallery <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.75} /></Link>
          <Link href="/login" className="inline-flex h-12 cursor-pointer items-center rounded-full border border-white/20 px-6 text-sm font-medium text-[#FAF7F2] transition hover:border-white/40 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40">Open a shared gallery</Link>
        </div>
        {!prefersReducedMotion ? <BorderBeam size={160} duration={16} colorFrom="#D8C7A4" colorTo="#78846F" borderWidth={1} /> : null}
      </motion.div>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#E8DED2]/70 bg-[#FAF7F2]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs text-[#8B8176] sm:flex-row sm:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#171411] text-[#FAF7F2]">
            <Camera className="h-3 w-3" strokeWidth={1.75} />
          </span>
          <span className="font-serif text-sm text-[#4F473F]">SaathiDesk</span>
        </div>

        <p>© {new Date().getFullYear()} SaathiDesk. All photographs belong to their owners.</p>

        <div className="flex items-center gap-4">
          <Link href="/login" className="hover:text-[#3A2A22]">
            Galleries
          </Link>
          <Link href="/docs" className="hover:text-[#3A2A22]">
            Docs
          </Link>
          <Link href="/how-ai-works" className="hover:text-[#3A2A22]">
            AI
          </Link>
          <Link href="/legal/privacy-policy" className="hover:text-[#3A2A22]">
            Privacy
          </Link>
          <Link href="/legal/terms-of-service" className="hover:text-[#3A2A22]">
            Terms
          </Link>
          <Link href="/contact" className="hover:text-[#3A2A22]">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}

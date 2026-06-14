"use client";

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
import { useDialKit } from "dialkit";
import { useCallback, useEffect, useId, useRef, useState } from "react";

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
  },
  {
    eyebrow: "AI edits",
    title: "Fix and finish photos",
    body: "Edit a photo with AI, download the result, or add it back into any event.",
    icon: Sparkles,
    tone: "champagne",
  },
  {
    eyebrow: "Collage",
    title: "Build the keepsake",
    body: "Upload extra photos, drag them into a collage, crop the best view, and export JPG or PNG.",
    icon: Camera,
    tone: "rose",
  },
  {
    eyebrow: "Sharing",
    title: "Control every handoff",
    body: "Download all, selected, event, or filtered photos and share albums with watermark and download controls.",
    icon: Download,
    tone: "sand",
  },
];

const toneStyles: Record<
  PlateTone,
  { background: string; grainOpacity: number }
> = {
  blush: {
    background:
      "linear-gradient(150deg, #FFF8ED 0%, #E8CFC3 55%, #B88366 100%)",
    grainOpacity: 0.16,
  },
  champagne: {
    background:
      "linear-gradient(160deg, #FAF7F2 0%, #E7D6B5 55%, #C6A15B 100%)",
    grainOpacity: 0.14,
  },
  rose: {
    background:
      "linear-gradient(145deg, #FFF2EF 0%, #E8CFC3 55%, #8E4A40 100%)",
    grainOpacity: 0.17,
  },
  sand: {
    background:
      "linear-gradient(155deg, #F3EDE4 0%, #D6C8B8 55%, #8A7252 100%)",
    grainOpacity: 0.14,
  },
  sage: {
    background:
      "linear-gradient(145deg, #EEF3EA 0%, #B7C4AA 55%, #5F755C 100%)",
    grainOpacity: 0.14,
  },
  sky: {
    background:
      "linear-gradient(150deg, #EEF6F7 0%, #B8CDD3 55%, #506F7A 100%)",
    grainOpacity: 0.13,
  },
  ink: {
    background:
      "linear-gradient(150deg, #3A2A22 0%, #241C17 58%, #171411 100%)",
    grainOpacity: 0.18,
  },
};

const galleryTiles: Array<{
  className: string;
  gradient: string;
  label: string;
  badge?: { icon: typeof Heart; tone: "rose" | "amber" | "stone" };
  people?: number;
}> = [
  {
    className: "row-span-2",
    gradient:
      "linear-gradient(135deg, #FFF8ED 0%, #E8CFC3 45%, #B88366 100%)",
    label: "Golden hour",
    badge: { icon: Heart, tone: "rose" },
    people: 2,
  },
  {
    className: "",
    gradient:
      "linear-gradient(135deg, #FAF7F2 0%, #D6C8B8 60%, #8A7252 100%)",
    label: "First look",
    people: 3,
  },
  {
    className: "",
    gradient:
      "linear-gradient(160deg, #FFF8ED 0%, #E7D6B5 70%, #A77C45 100%)",
    label: "Ceremony",
    badge: { icon: Sparkles, tone: "amber" },
  },
  {
    className: "row-span-2",
    gradient:
      "linear-gradient(135deg, #F3EDE4 0%, #B7C4AA 55%, #5F755C 100%)",
    label: "Vows",
    people: 4,
  },
  {
    className: "",
    gradient:
      "linear-gradient(150deg, #FFF2EF 0%, #E8CFC3 50%, #8E4A40 100%)",
    label: "Reception",
    badge: { icon: Heart, tone: "rose" },
  },
  {
    className: "",
    gradient:
      "linear-gradient(145deg, #FAF7F2 0%, #E7D6B5 55%, #8A7252 100%)",
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
    href: "#ai-workflow",
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

export function LandingPage() {
  const reveal = useReveal();
  const stagger = useStagger();

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#1F1B16] antialiased">
      <Header />

      <Hero reveal={reveal} />

      <DocsHub reveal={reveal} stagger={stagger} />

      <section className="border-y border-[#E8DED2]/70 bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-center sm:flex-row sm:justify-between sm:gap-8 sm:py-12 sm:text-left">
          <motion.div {...reveal} className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#A77C45]">
              Powered by AI
            </p>
            <h2 className="mt-2 font-serif text-2xl leading-tight text-[#1F1B16] sm:text-3xl">
              Search by face, by feeling, by moment.
            </h2>
            <p className="mt-2 text-sm text-[#6F675E] sm:text-base">
              Every photo is indexed by who is in it and what is happening — so
              the right memory surfaces in a single tap.
            </p>
          </motion.div>

          <motion.div
            {...reveal}
            className="flex flex-wrap items-center justify-center gap-2 sm:justify-end"
          >
            {[
              "Face grouping",
              "Semantic search",
              "AI photo editing",
              "Collage exports",
              "Upload retries",
              "Watermarked sharing",
            ].map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center rounded-full border border-[#E8DED2] bg-white px-3 py-1 text-xs font-medium text-[#4F473F] shadow-[0_1px_0_rgba(0,0,0,0.02)]"
              >
                {chip}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      <AiWorkflow reveal={reveal} stagger={stagger} />

      <MomentsCarousel reveal={reveal} />

      <PromptGuide reveal={reveal} stagger={stagger} />

      <FeatureGuides reveal={reveal} stagger={stagger} />

      <GalleryPreview reveal={reveal} stagger={stagger} />

      <FinalCTA reveal={reveal} />

      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8DED2]/60 bg-[#FAF7F2]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-[#1F1B16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 rounded-md"
          aria-label="SaathiDesk home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#171411] text-[#FAF7F2] transition-transform duration-300 group-hover:scale-105">
            <Camera className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="font-serif text-lg leading-none tracking-tight">
            SaathiDesk
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <a
            href="#docs"
            className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-[#4F473F] transition hover:text-[#1F1B16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 md:inline-flex"
          >
            Docs
          </a>
          <a
            href="#ai-workflow"
            className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-[#4F473F] transition hover:text-[#1F1B16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 lg:inline-flex"
          >
            How AI works
          </a>
          <Link
            href="/login"
            className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-[#4F473F] transition hover:text-[#1F1B16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 sm:inline-flex"
          >
            Galleries
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#171411] px-4 text-sm font-medium text-[#FAF7F2] shadow-sm transition hover:bg-[#241C17] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 cursor-pointer"
          >
            Open album
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero({ reveal }: { reveal: MotionProps }) {
  const prefersReducedMotion = useReducedMotion();
  const heroControls = useDialKit("Landing Hero", {
    glow: {
      _collapsed: true,
      warm: [0.45, 0, 0.8, 0.01],
      side: [0.35, 0, 0.8, 0.01],
      floor: [0.45, 0, 0.8, 0.01],
    },
    preview: {
      radius: [24, 12, 40, 1],
      saturation: [1, 0.7, 1.35, 0.01],
      badgeOffset: [0, -16, 16, 1],
    },
    showBadges: true,
    entrance: {
      type: "spring",
      visualDuration: 0.9,
      bounce: 0.12,
    },
  });
  const entranceTransition =
    heroControls.entrance.type === "spring"
      ? {
          type: "spring" as const,
          visualDuration: heroControls.entrance.visualDuration,
          bounce: heroControls.entrance.bounce,
        }
      : { duration: 0.9, ease: EASE_OUT };

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            `radial-gradient(60% 60% at 20% 10%, rgba(240,200,170,${heroControls.glow.warm}) 0%, rgba(240,200,170,0) 60%), radial-gradient(50% 60% at 90% 20%, rgba(220,196,176,${heroControls.glow.side}) 0%, rgba(220,196,176,0) 65%), radial-gradient(70% 60% at 50% 100%, rgba(232,220,205,${heroControls.glow.floor}) 0%, rgba(232,220,205,0) 70%)`,
        }}
      />

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <motion.div {...reveal}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8DED2] bg-white/80 px-3 py-1 text-xs font-medium text-[#4F473F] shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[#A77C45]" strokeWidth={2} />
              SaathiDesk · Free open-source AI photo gallery platform
            </span>

            <h1 className="mt-5 font-serif text-[2.6rem] leading-[1.05] tracking-tight text-[#1F1B16] sm:text-6xl lg:text-[4.2rem]">
              Every moment,
              <br />
              <span className="italic text-[#3A2A22]">beautifully</span> findable.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#6F675E] sm:text-lg">
              A free, open-source private gallery for your wedding day with
              people filters, semantic search, AI photo edits, collage exports,
              flexible downloads, and share links you can protect with
              watermarks. No monthly plans, store commission, penny, or cent.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#171411] px-6 text-sm font-medium text-[#FAF7F2] shadow-md shadow-[#1F1B16]/10 transition hover:bg-[#241C17] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 cursor-pointer"
              >
                Open your album
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                  strokeWidth={1.75}
                />
              </Link>

              <Link
                href="/login?mode=signup"
                className="inline-flex h-12 items-center rounded-full border border-[#D6C8B8] bg-white/80 px-6 text-sm font-medium text-[#3A2A22] backdrop-blur transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 cursor-pointer"
              >
                Sign Up
              </Link>

              <a
                href="#docs"
                className="inline-flex h-12 items-center rounded-full border border-[#D6C8B8] bg-white/80 px-6 text-sm font-medium text-[#3A2A22] backdrop-blur transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30 cursor-pointer"
              >
                Read the docs
              </a>
            </div>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-[#E8DED2]/80 pt-6">
              {[
                { value: "People", label: "Face filters" },
                { value: "Ask AI", label: "Search prompts" },
                { value: "Private", label: "Share controls" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="font-serif text-2xl text-[#1F1B16]">
                    {stat.value}
                  </dt>
                  <dd className="mt-1 text-xs text-[#8B8176]">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
            transition={entranceTransition}
            className="relative mx-auto w-full max-w-xl"
          >
            <HeroPreview
              badgeOffset={heroControls.preview.badgeOffset}
              radius={heroControls.preview.radius}
              saturation={heroControls.preview.saturation}
              showBadges={heroControls.showBadges}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function HeroPreview({
  badgeOffset,
  radius,
  saturation,
  showBadges,
}: {
  badgeOffset: number;
  radius: number;
  saturation: number;
  showBadges: boolean;
}) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-x-4 -inset-y-6 -z-10 rounded-[2rem] bg-gradient-to-br from-white/70 via-white/30 to-transparent blur-2xl"
      />

      <div
        className="relative aspect-[4/5] w-full overflow-hidden border border-[#E8DED2]/80 bg-[#F3EDE4] shadow-[0_30px_80px_-30px_rgba(20,15,10,0.35)]"
        style={{
          borderRadius: radius,
          filter: `saturate(${saturation})`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, #FFF8ED 0%, #E8CFC3 38%, #B88366 78%, #3A2A22 100%)",
          }}
        />

        <div
          aria-hidden
          className="absolute inset-0 opacity-70 mix-blend-soft-light"
          style={{
            background:
              "radial-gradient(40% 30% at 30% 25%, rgba(255,236,210,0.85) 0%, rgba(255,236,210,0) 70%), radial-gradient(50% 40% at 75% 70%, rgba(80,40,20,0.45) 0%, rgba(80,40,20,0) 70%)",
          }}
        />

        {showBadges ? (
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-[#3A2A22] shadow-sm ring-1 ring-[#1F1B16]/5 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-[#A77C45]" strokeWidth={2} />
            AI suggested
          </div>
        ) : null}

        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-[#1F1B16]/5 backdrop-blur">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#8B8176]">
              Golden hour
            </p>
            <p className="font-serif text-base leading-tight text-[#1F1B16]">
              First dance
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-2 py-1.5 shadow-sm ring-1 ring-[#1F1B16]/5 backdrop-blur">
            {[0, 1, 2].map((idx) => (
              <span
                key={idx}
                className="relative h-6 w-6 overflow-hidden rounded-full ring-2 ring-white"
                style={{
                  background: [
                    "linear-gradient(135deg,#E8CFC3,#8E4A40)",
                    "linear-gradient(135deg,#D6C8B8,#5F755C)",
                    "linear-gradient(135deg,#FFF2EF,#B88366)",
                  ][idx],
                }}
              />
            ))}
            <Users className="ml-1 h-3.5 w-3.5 text-[#4F473F]" strokeWidth={1.75} />
          </div>
        </div>
      </div>

      {showBadges ? (
        <>
          <div
            className="absolute -right-3 -top-3 hidden w-56 rounded-2xl border border-[#E8DED2] bg-white/90 p-3 shadow-lg shadow-[#1F1B16]/5 ring-1 ring-[#1F1B16]/5 backdrop-blur sm:block"
            style={{ transform: `translateY(${badgeOffset}px)` }}
          >
            <div className="flex items-center gap-2 rounded-xl bg-[#F7F1E8] px-3 py-2 ring-1 ring-[#E8DED2]/70">
              <Search className="h-4 w-4 text-[#8B8176]" strokeWidth={1.75} />
              <span className="truncate text-sm text-[#4F473F]">
                “Mum laughing at the toast”
              </span>
            </div>
            <p className="mt-2 px-1 text-[11px] text-[#8B8176]">
              12 matches · sorted by best moment
            </p>
          </div>

          <div
            className="absolute -bottom-4 -left-2 hidden items-center gap-3 rounded-2xl border border-[#E8DED2] bg-white/95 px-3 py-2.5 shadow-lg shadow-[#1F1B16]/5 ring-1 ring-[#1F1B16]/5 backdrop-blur sm:flex"
            style={{ transform: `translateY(${-badgeOffset}px)` }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF2EF] text-[#A85D50] ring-1 ring-[#E8CFC3]">
              <Heart className="h-4 w-4" strokeWidth={2} />
            </span>
            <div>
              <p className="text-xs font-semibold text-[#1F1B16]">
                Saved to favourites
              </p>
              <p className="text-[11px] text-[#8B8176]">Synced to your album</p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
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

        <motion.div
          {...stagger}
          className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {docPages.map((page) => {
            const Icon = page.icon;

            return (
              <motion.article
                key={page.title}
                variants={itemVariants}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E8DED2] bg-[#FAF7F2] shadow-[0_1px_0_rgba(0,0,0,0.02)] transition duration-500 hover:-translate-y-1 hover:border-[#D6C8B8] hover:shadow-xl"
              >
                <DocPhotoPlate
                  icon={Icon}
                  title={page.title}
                  tone={page.tone}
                  label={page.eyebrow}
                />

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171411] text-[#FAF7F2] transition group-hover:bg-[#C6A15B]">
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
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#5F755C]"
                          strokeWidth={2}
                        />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href={page.href}
                    className="mt-5 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[#1F1B16] transition hover:text-[#8A6434]"
                  >
                    Open guide
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                      strokeWidth={1.75}
                    />
                  </a>
                </div>
              </motion.article>
            );
          })}
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

        <a
          href="#search-guide"
          className="inline-flex h-11 w-fit items-center gap-2 rounded-full border border-[#D6C8B8] bg-white px-5 text-sm font-medium text-[#1F1B16] transition hover:border-[#C8B8A6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1B16]/30"
        >
          Search guide
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </a>
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
      className="relative border-y border-[#E8DED2]/70 bg-gradient-to-b from-[#F3EDE4] via-[#FAF7F2] to-white"
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
    <section className="relative border-y border-[#E8DED2]/70 bg-gradient-to-b from-[#F3EDE4] via-[#FAF7F2] to-[#FAF7F2]">
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

function FinalCTA({ reveal }: { reveal: MotionProps }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
      <motion.div
        {...reveal}
        className="relative overflow-hidden rounded-3xl bg-[#171411] px-6 py-14 text-center text-[#FAF7F2] sm:px-12 sm:py-20"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 60% at 50% 0%, rgba(252,217,177,0.18) 0%, rgba(252,217,177,0) 70%), radial-gradient(60% 60% at 100% 100%, rgba(180,120,80,0.22) 0%, rgba(180,120,80,0) 70%)",
          }}
        />

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

          <a
            href="mailto:support@saathidesk.com"
            className="inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-sm font-medium text-[#FAF7F2] transition hover:border-white/40 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
          >
            Talk to us
          </a>
        </div>
      </motion.div>
    </section>
  );
}

function Footer() {
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
          <a href="#docs" className="hover:text-[#3A2A22]">
            Docs
          </a>
          <a href="#ai-workflow" className="hover:text-[#3A2A22]">
            AI
          </a>
          <Link href="/legal/privacy-policy" className="hover:text-[#3A2A22]">
            Privacy
          </Link>
          <Link href="/legal/terms-of-service" className="hover:text-[#3A2A22]">
            Terms
          </Link>
          <a href="mailto:support@saathidesk.com" className="hover:text-[#3A2A22]">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}

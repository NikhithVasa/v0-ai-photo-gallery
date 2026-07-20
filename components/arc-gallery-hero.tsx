"use client";

import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { SITE_NAME } from "@/lib/seo";

interface GalleryImage {
  src: string;
  alt: string;
  position: string;
  size: string;
  priority?: boolean;
}

const galleryImages: GalleryImage[] = [
  {
    src: "/reception.png",
    alt: "Wedding guests celebrating together at the reception",
    position: "hidden sm:block translate-y-12 -rotate-6",
    size: "w-36 md:w-44 lg:w-52",
  },
  {
    src: "/laugh_1.png",
    alt: "A joyful candid laugh captured during a wedding",
    position: "translate-y-7 -rotate-3",
    size: "w-32 sm:w-40 md:w-48 lg:w-56",
  },
  {
    src: "/glow_1.png",
    alt: "A warmly lit wedding portrait",
    position: "translate-y-2 -rotate-1",
    size: "w-36 sm:w-44 md:w-52 lg:w-60",
  },
  {
    src: "/First%20look.png",
    alt: "A couple sharing their first look on their wedding day",
    position: "-translate-y-3 rotate-1",
    size: "w-40 sm:w-48 md:w-56 lg:w-64",
    priority: true,
  },
  {
    src: "/filter_1.png",
    alt: "A polished wedding photograph prepared for delivery",
    position: "translate-y-2 rotate-2",
    size: "w-36 sm:w-44 md:w-52 lg:w-60",
  },
  {
    src: "/collage.png",
    alt: "A wedding photo collage arranged for a client gallery",
    position: "translate-y-7 rotate-4",
    size: "w-32 sm:w-40 md:w-48 lg:w-56",
  },
  {
    src: "/hero_one.png",
    alt: "A finished wedding image ready to share with clients",
    position: "hidden sm:block translate-y-12 rotate-6",
    size: "w-36 md:w-44 lg:w-52",
  },
];

const contentVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  },
};

const galleryVariants: Variants = {
  hidden: {},
  visible: {
    transition: { delayChildren: 0.12, staggerChildren: 0.06 },
  },
};

const imageVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

export function ArcGalleryHero() {
  const prefersReducedMotion = useReducedMotion();
  const initial = prefersReducedMotion ? false : "hidden";

  return (
    <section
      aria-labelledby="arc-gallery-heading"
      className="relative isolate overflow-hidden border-b border-stone-300/70 bg-stone-100 text-stone-950"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-amber-50/80 to-transparent"
      />

      <div className="mx-auto max-w-7xl px-5 pb-12 pt-16 text-center sm:px-8 sm:pb-16 sm:pt-20 lg:pt-24">
        <motion.div
          initial={initial}
          animate="visible"
          variants={contentVariants}
          className="mx-auto max-w-4xl"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-600">
            The wedding photography workspace
          </p>
          <h1
            id="arc-gallery-heading"
            className="mt-5 text-balance font-serif text-5xl leading-[0.92] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
          >
            From first look to final gallery,
            <span className="block italic text-stone-600">{" "}keep the story together.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-stone-700 sm:text-lg sm:leading-8">
            {SITE_NAME} gives professional wedding photographers one calm place to
            organize events, find people and moments with AI, refine the set, and
            deliver a private client gallery.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login?mode=signup"
              className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-stone-950 px-6 text-sm font-semibold text-stone-50 shadow-sm transition-colors duration-200 hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-100"
            >
              Start your free gallery
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-200 motion-reduce:transition-none group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
                strokeWidth={1.75}
              />
            </Link>
            <Link
              href="/how-ai-works"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-stone-400 bg-stone-50 px-6 text-sm font-semibold text-stone-800 transition-colors duration-200 hover:border-stone-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-100"
            >
              How AI Works
            </Link>
          </div>
        </motion.div>

        <motion.figure
          initial={initial}
          animate="visible"
          variants={galleryVariants}
          className="relative left-1/2 mt-10 flex w-screen -translate-x-1/2 items-end justify-center -space-x-12 overflow-hidden px-2 pt-8 sm:mt-12 sm:-space-x-10 sm:px-6 md:-space-x-8 lg:mt-14 lg:-space-x-6"
        >
          {galleryImages.map((image) => (
            <motion.div
              key={image.src}
              variants={imageVariants}
              className={`group relative shrink-0 ${image.position} ${image.size}`}
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-t-full rounded-b-xl border-4 border-stone-50 bg-stone-200 shadow-xl shadow-stone-950/15 transition-transform duration-300 ease-out group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  priority={image.priority}
                  sizes="(min-width: 1024px) 256px, (min-width: 768px) 224px, (min-width: 640px) 192px, 160px"
                  className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-stone-950/25 via-transparent to-white/10"
                />
              </div>
            </motion.div>
          ))}
          <figcaption className="sr-only">
            A selection of wedding moments organized and prepared for client delivery in {SITE_NAME}.
          </figcaption>
        </motion.figure>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Download,
  Heart,
  Search,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import {
  motion,
  useReducedMotion,
  type MotionProps,
  type Variants,
} from "framer-motion";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

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

const features = [
  {
    icon: Search,
    title: "AI photo search",
    body: "Describe the moment in plain words. Find the dance, the toast, the quiet glance.",
  },
  {
    icon: Users,
    title: "Recognise everyone",
    body: "Face recognition groups every guest, so finding photos of grandma takes one tap.",
  },
  {
    icon: Heart,
    title: "Favourite & curate",
    body: "Build your own edit. Star the keepers and skip the duplicates without losing context.",
  },
  {
    icon: Share2,
    title: "Share & download",
    body: "Original-quality downloads and one-tap sharing. No watermarks, no friction.",
  },
] as const;

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
      "linear-gradient(135deg, #f5e0d3 0%, #e6b8a5 45%, #b0816a 100%)",
    label: "Golden hour",
    badge: { icon: Heart, tone: "rose" },
    people: 2,
  },
  {
    className: "",
    gradient:
      "linear-gradient(135deg, #efe7dc 0%, #d6c6b2 60%, #a89379 100%)",
    label: "First look",
    people: 3,
  },
  {
    className: "",
    gradient:
      "linear-gradient(160deg, #efe1d0 0%, #d8a87a 70%, #8a5a3a 100%)",
    label: "Ceremony",
    badge: { icon: Sparkles, tone: "amber" },
  },
  {
    className: "row-span-2",
    gradient:
      "linear-gradient(135deg, #e7e2d6 0%, #b8b6a4 55%, #6f6e5a 100%)",
    label: "Vows",
    people: 4,
  },
  {
    className: "",
    gradient:
      "linear-gradient(150deg, #f1ddd0 0%, #d99c8a 50%, #9a5642 100%)",
    label: "Reception",
    badge: { icon: Heart, tone: "rose" },
  },
  {
    className: "",
    gradient:
      "linear-gradient(145deg, #ebe6d8 0%, #cbb692 55%, #8a7252 100%)",
    label: "Toast",
    people: 5,
  },
];

const badgeToneClasses: Record<"rose" | "amber" | "stone", string> = {
  rose: "bg-rose-50 text-rose-700 ring-rose-200/80",
  amber: "bg-amber-50 text-amber-800 ring-amber-200/80",
  stone: "bg-stone-50 text-stone-700 ring-stone-200/80",
};

export function LandingPage() {
  const reveal = useReveal();
  const stagger = useStagger();

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-stone-950 antialiased">
      <Header />

      <Hero reveal={reveal} />

      <section className="border-y border-stone-200/70 bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-center sm:flex-row sm:justify-between sm:gap-8 sm:py-12 sm:text-left">
          <motion.div {...reveal} className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700">
              Powered by AI
            </p>
            <h2 className="mt-2 font-serif text-2xl leading-tight text-stone-950 sm:text-3xl">
              Search by face, by feeling, by moment.
            </h2>
            <p className="mt-2 text-sm text-stone-600 sm:text-base">
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
              "Smart albums",
              "Auto-favourites",
            ].map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
              >
                {chip}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      <Features stagger={stagger} />

      <GalleryPreview reveal={reveal} stagger={stagger} />

      <FinalCTA reveal={reveal} />

      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/60 bg-[#fbfaf8]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-stone-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 rounded-md"
          aria-label="AI Photo Gallery — home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-950 text-[#fbfaf8] transition-transform duration-300 group-hover:scale-105">
            <Camera className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="font-serif text-lg leading-none tracking-tight">
            Apsara
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/customers"
            className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-stone-700 transition hover:text-stone-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 sm:inline-flex"
          >
            Galleries
          </Link>
          <Link
            href="/customers"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-stone-950 px-4 text-sm font-medium text-[#fbfaf8] shadow-sm transition hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 cursor-pointer"
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

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 60% at 20% 10%, rgba(240,200,170,0.45) 0%, rgba(240,200,170,0) 60%), radial-gradient(50% 60% at 90% 20%, rgba(220,196,176,0.35) 0%, rgba(220,196,176,0) 65%), radial-gradient(70% 60% at 50% 100%, rgba(232,220,205,0.45) 0%, rgba(232,220,205,0) 70%)",
        }}
      />

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <motion.div {...reveal}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs font-medium text-stone-700 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-amber-700" strokeWidth={2} />
              New: face recognition for every guest
            </span>

            <h1 className="mt-5 font-serif text-[2.6rem] leading-[1.05] tracking-tight text-stone-950 sm:text-6xl lg:text-[4.2rem]">
              Every moment,
              <br />
              <span className="italic text-stone-800">beautifully</span> findable.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-stone-600 sm:text-lg">
              A private gallery for your wedding day — with AI that knows every
              face, every scene, and every favourite, so the photos you love are
              always one tap away.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/customers"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-stone-950 px-6 text-sm font-medium text-[#fbfaf8] shadow-md shadow-stone-900/10 transition hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 cursor-pointer"
              >
                Open your album
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                  strokeWidth={1.75}
                />
              </Link>

              <a
                href="#features"
                className="inline-flex h-12 items-center rounded-full border border-stone-300 bg-white/80 px-6 text-sm font-medium text-stone-800 backdrop-blur transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 cursor-pointer"
              >
                See how it works
              </a>
            </div>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-stone-200/80 pt-6">
              {[
                { value: "100%", label: "Original quality" },
                { value: "1-tap", label: "Find anyone" },
                { value: "Private", label: "Only your guests" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="font-serif text-2xl text-stone-950">
                    {stat.value}
                  </dt>
                  <dd className="mt-1 text-xs text-stone-500">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: EASE_OUT }}
            className="relative mx-auto w-full max-w-xl"
          >
            <HeroPreview />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-x-4 -inset-y-6 -z-10 rounded-[2rem] bg-gradient-to-br from-white/70 via-white/30 to-transparent blur-2xl"
      />

      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.5rem] border border-stone-200/80 bg-stone-100 shadow-[0_30px_80px_-30px_rgba(20,15,10,0.35)]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, #f4e3d2 0%, #e0b89a 38%, #b07a5a 78%, #6e4a36 100%)",
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

        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-stone-800 shadow-sm ring-1 ring-stone-900/5 backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-amber-700" strokeWidth={2} />
          AI suggested
        </div>

        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-stone-900/5 backdrop-blur">
            <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">
              Golden hour
            </p>
            <p className="font-serif text-base leading-tight text-stone-950">
              First dance
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-2 py-1.5 shadow-sm ring-1 ring-stone-900/5 backdrop-blur">
            {[0, 1, 2].map((idx) => (
              <span
                key={idx}
                className="relative h-6 w-6 overflow-hidden rounded-full ring-2 ring-white"
                style={{
                  background: [
                    "linear-gradient(135deg,#e8c4a8,#9c6a4a)",
                    "linear-gradient(135deg,#d8d3c4,#7a7560)",
                    "linear-gradient(135deg,#efd0c4,#a87060)",
                  ][idx],
                }}
              />
            ))}
            <Users className="ml-1 h-3.5 w-3.5 text-stone-700" strokeWidth={1.75} />
          </div>
        </div>
      </div>

      <div className="absolute -right-3 -top-3 hidden w-56 rounded-2xl border border-stone-200 bg-white/90 p-3 shadow-lg shadow-stone-900/5 ring-1 ring-stone-900/5 backdrop-blur sm:block">
        <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 ring-1 ring-stone-200/70">
          <Search className="h-4 w-4 text-stone-500" strokeWidth={1.75} />
          <span className="truncate text-sm text-stone-700">
            “Mum laughing at the toast”
          </span>
        </div>
        <p className="mt-2 px-1 text-[11px] text-stone-500">
          12 matches · sorted by best moment
        </p>
      </div>

      <div className="absolute -bottom-4 -left-2 hidden items-center gap-3 rounded-2xl border border-stone-200 bg-white/95 px-3 py-2.5 shadow-lg shadow-stone-900/5 ring-1 ring-stone-900/5 backdrop-blur sm:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <Heart className="h-4 w-4" strokeWidth={2} />
        </span>
        <div>
          <p className="text-xs font-semibold text-stone-950">
            Saved to favourites
          </p>
          <p className="text-[11px] text-stone-500">Synced to your album</p>
        </div>
      </div>
    </div>
  );
}

function Features({ stagger }: { stagger: MotionProps }) {
  return (
    <section
      id="features"
      className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700">
          Built for the keepsakes
        </p>
        <h2 className="mt-3 font-serif text-3xl leading-tight text-stone-950 sm:text-4xl">
          A gallery that <span className="italic">remembers</span> for you.
        </h2>
        <p className="mt-3 text-base text-stone-600">
          Four quiet superpowers, working behind every photo.
        </p>
      </div>

      <motion.ul
        {...stagger}
        className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {features.map(({ icon: Icon, title, body }) => (
          <motion.li
            key={title}
            variants={itemVariants}
            className="group relative flex h-full flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition duration-300 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-950 text-[#fbfaf8] transition group-hover:bg-amber-700">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="font-serif text-xl leading-tight text-stone-950">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {body}
              </p>
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </section>
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
    <section className="relative border-y border-stone-200/70 bg-gradient-to-b from-[#f6f1ea] via-[#fbfaf8] to-[#fbfaf8]">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <motion.div
          {...reveal}
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700">
              A glimpse
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-tight text-stone-950 sm:text-4xl">
              The whole day, <span className="italic">held in light.</span>
            </h2>
            <p className="mt-3 text-base text-stone-600">
              Masonry-style galleries, face filters and a focused viewer that
              feels as good on a phone as on a 27-inch screen.
            </p>
          </div>

          <Link
            href="/customers"
            className="group inline-flex h-11 w-fit items-center gap-1.5 rounded-full border border-stone-300 bg-white px-5 text-sm font-medium text-stone-900 transition hover:border-stone-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 cursor-pointer"
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
              className={`group relative overflow-hidden rounded-xl shadow-sm ring-1 ring-stone-900/5 transition duration-500 hover:shadow-lg ${tile.className}`}
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-medium text-stone-800 ring-1 ring-stone-900/5 backdrop-blur">
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
          className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-stone-500"
        >
          <span className="inline-flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            Original-quality downloads
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" strokeWidth={1.75} />
            Personal favourites
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Share with family
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
            Filter by people
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
        className="relative overflow-hidden rounded-3xl bg-stone-950 px-6 py-14 text-center text-[#fbfaf8] sm:px-12 sm:py-20"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 60% at 50% 0%, rgba(252,217,177,0.18) 0%, rgba(252,217,177,0) 70%), radial-gradient(60% 60% at 100% 100%, rgba(180,120,80,0.22) 0%, rgba(180,120,80,0) 70%)",
          }}
        />

        <p className="relative text-xs font-medium uppercase tracking-[0.18em] text-amber-300/90">
          Ready when you are
        </p>
        <h2 className="relative mx-auto mt-3 max-w-2xl font-serif text-3xl leading-tight sm:text-5xl">
          Open your album. <span className="italic">Relive the day.</span>
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-base text-stone-300 sm:text-lg">
          Sign in to your private gallery and let the photos find you.
        </p>

        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/customers"
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#fbfaf8] px-6 text-sm font-medium text-stone-950 shadow-lg shadow-black/20 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
          >
            Open your album
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
              strokeWidth={1.75}
            />
          </Link>

          <a
            href="mailto:hello@apsara.gallery"
            className="inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-sm font-medium text-[#fbfaf8] transition hover:border-white/40 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
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
    <footer className="border-t border-stone-200/70 bg-[#fbfaf8]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs text-stone-500 sm:flex-row sm:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-950 text-[#fbfaf8]">
            <Camera className="h-3 w-3" strokeWidth={1.75} />
          </span>
          <span className="font-serif text-sm text-stone-700">Apsara</span>
        </div>

        <p>© {new Date().getFullYear()} Apsara Gallery. All photographs belong to their owners.</p>

        <div className="flex items-center gap-4">
          <Link href="/customers" className="hover:text-stone-800">
            Galleries
          </Link>
          <a href="mailto:hello@apsara.gallery" className="hover:text-stone-800">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}

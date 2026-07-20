import Image from "next/image";
import Link from "next/link";
import { HeroBrowserStack } from "@/components/hero-browser-stack";
import { RotatingHeroKeyword } from "@/components/rotating-hero-keyword";

const outcomes = [
  {
    number: "01",
    eyebrow: "Organize the assignment",
    title: "One wedding, held together.",
    description:
      "Keep shoots, events, selects, edits, and delivery in one calm workspace built around the way wedding teams actually work.",
  },
  {
    number: "02",
    eyebrow: "Find the frame",
    title: "Search people. Recall moments.",
    description:
      "Use AI-assisted people and moment search to move through a large wedding without losing the human story inside it.",
  },
  {
    number: "03",
    eyebrow: "Finish the handoff",
    title: "Cull, refine, and deliver privately.",
    description:
      "Shape the final set, then share a considered client gallery with privacy and download controls already in place.",
  },
] as const;

const focusClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-100 motion-reduce:transition-none";

export function FreshHomepage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-stone-100 text-stone-950">
      <header className="border-b border-stone-300">
        <nav
          aria-label="Primary navigation"
          className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12"
        >
          <Link
            href="/"
            className={`inline-flex min-h-11 items-center font-editorial text-2xl font-semibold tracking-tight ${focusClass}`}
          >
            SaathiDesk
          </Link>

          <div className="flex items-center gap-1 sm:gap-3">
            <Link
              href="/how-ai-works"
              className={`hidden min-h-11 items-center px-3 text-sm font-medium text-stone-700 transition-colors hover:text-stone-950 sm:inline-flex ${focusClass}`}
            >
              How AI works
            </Link>
            <Link
              href="/docs"
              className={`hidden min-h-11 items-center px-3 text-sm font-medium text-stone-700 transition-colors hover:text-stone-950 md:inline-flex ${focusClass}`}
            >
              Docs
            </Link>
            <Link
              href="/login"
              className={`inline-flex min-h-11 items-center px-3 text-sm font-medium text-stone-700 transition-colors hover:text-stone-950 ${focusClass}`}
            >
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              className={`inline-flex min-h-11 items-center bg-stone-950 px-4 text-sm font-semibold text-stone-50 transition-colors hover:bg-orange-700 sm:px-5 ${focusClass}`}
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <section
        aria-labelledby="home-heading"
        className="mx-auto flex max-w-screen-2xl flex-col px-5 pb-10 pt-8 sm:px-8 sm:pb-12 sm:pt-12 lg:min-h-[calc(100svh-77px)] lg:px-12 lg:pb-12"
      >
        <h1
          id="home-heading"
          className="max-w-[13em] font-editorial text-[clamp(2.75rem,7.2vw,6.5rem)] font-medium leading-[0.88] tracking-[-0.04em]"
        >
          <span className="block">
            <span className="block sm:inline">The</span>{" "}
            <span className="block sm:inline"><RotatingHeroKeyword /></span>{" "}
            <span className="block sm:inline">is a story.</span>
          </span>
          <span className="mt-[0.16em] block">
            Your workspace should know the plot.
          </span>
        </h1>

        <div className="mt-10 grid gap-12 border-t border-stone-300 pt-8 sm:mt-12 sm:pt-10 md:grid-cols-12 md:gap-6 lg:mt-auto lg:pt-12">
          <div className="md:col-span-5 lg:col-span-4">
            <p className="max-w-xs text-xs font-semibold uppercase leading-5 tracking-widest text-orange-700">
              A professional wedding photography workspace
            </p>
            <p className="mt-4 max-w-sm text-base leading-7 text-stone-600">
              From the first import to the private gallery, SaathiDesk keeps the
              work clear and the photographs central.
            </p>
            <div className="mt-7 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
              <Link
                href="/login?mode=signup"
                className={`inline-flex min-h-11 items-center border-b-2 border-orange-700 text-sm font-semibold text-stone-950 transition-colors hover:text-orange-700 ${focusClass}`}
              >
                Start your workspace
              </Link>
              <Link
                href="/how-ai-works"
                className={`inline-flex min-h-11 items-center text-sm font-medium text-stone-600 transition-colors hover:text-stone-950 ${focusClass}`}
              >
                See how AI search works
              </Link>
            </div>
          </div>

          <div className="md:col-span-6 md:col-start-6 lg:col-span-5 lg:col-start-6">
            <HeroBrowserStack />
          </div>
        </div>
      </section>

      <figure className="border-y border-stone-300 bg-stone-950">
        <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[16/9] lg:aspect-[2/1]">
          <Image
            src="/First%20look.png"
            alt="A newlywed couple sharing a quiet first-look moment on their wedding day"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/40 via-transparent to-transparent" aria-hidden="true" />
          <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-xs uppercase leading-5 tracking-widest text-stone-50 sm:p-8 lg:p-12">
            <span>The frame stays the focus.</span>
            <span className="hidden text-right sm:block">Organize · Find · Finish · Deliver</span>
          </figcaption>
        </div>
      </figure>

      <section aria-labelledby="outcomes-heading" className="mx-auto max-w-screen-2xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36">
        <div className="grid gap-10 border-b border-stone-300 pb-12 md:grid-cols-12 md:gap-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-700 md:col-span-3">
            Built for the full story
          </p>
          <h2 id="outcomes-heading" className="max-w-4xl font-editorial text-4xl font-medium leading-tight tracking-tight sm:text-6xl md:col-span-8 md:col-start-5 lg:text-7xl">
            Less time managing the work. More attention for the pictures that matter.
          </h2>
        </div>

        <ol>
          {outcomes.map((outcome) => (
            <li key={outcome.number} className="grid gap-5 border-b border-stone-300 py-10 md:grid-cols-12 md:gap-6 md:py-14">
              <span className="font-editorial text-2xl text-orange-700 md:col-span-1" aria-hidden="true">
                {outcome.number}
              </span>
              <p className="text-xs font-semibold uppercase leading-5 tracking-widest text-stone-600 md:col-span-3">
                {outcome.eyebrow}
              </p>
              <div className="md:col-span-7 md:col-start-6">
                <h3 className="font-editorial text-3xl font-medium leading-tight tracking-tight sm:text-5xl">
                  {outcome.title}
                </h3>
                <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
                  {outcome.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="closing-heading" className="bg-stone-950 px-5 py-20 text-stone-50 sm:px-8 sm:py-28 lg:px-12 lg:py-36">
        <div className="mx-auto grid max-w-screen-2xl gap-10 md:grid-cols-12 md:items-end md:gap-6">
          <div className="md:col-span-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">
              Your next wedding, better held
            </p>
            <h2 id="closing-heading" className="mt-5 max-w-5xl font-editorial text-5xl font-medium leading-none tracking-tight sm:text-7xl lg:text-8xl">
              Give every frame a place in the story.
            </h2>
          </div>
          <div className="md:col-span-3 md:col-start-10">
            <p className="text-base leading-7 text-stone-300">
              Get started and build a calmer path from shoot to client delivery.
            </p>
            <Link
              href="/login?mode=signup"
              className="mt-7 inline-flex min-h-11 items-center bg-orange-600 px-5 text-sm font-semibold text-stone-950 transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 motion-reduce:transition-none"
            >
              Create your workspace
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-stone-950 text-stone-400">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-6 border-t border-stone-800 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p>© {new Date().getFullYear()} SaathiDesk</p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/how-ai-works" className="min-h-11 content-center transition-colors hover:text-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 motion-reduce:transition-none">
              How AI works
            </Link>
            <Link href="/docs" className="min-h-11 content-center transition-colors hover:text-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 motion-reduce:transition-none">
              Docs
            </Link>
            <Link href="/legal/privacy-policy" className="min-h-11 content-center transition-colors hover:text-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 motion-reduce:transition-none">
              Privacy
            </Link>
            <Link href="/legal/terms-of-service" className="min-h-11 content-center transition-colors hover:text-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 motion-reduce:transition-none">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

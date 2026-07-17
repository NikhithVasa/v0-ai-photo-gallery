import Image from "next/image";
import Link from "next/link";

const setupSteps = [
  {
    number: "01",
    eyebrow: "Start with the client",
    title: "One client space. Every album in context.",
    description:
      "Give each customer a dedicated place for their work, then organize a wedding into albums and named events—from portraits to the final reception.",
  },
  {
    number: "02",
    eyebrow: "Mirror the day",
    title: "Keep every chapter in its place.",
    description:
      "Covers, dates, descriptions, and event sections make a large assignment easier to navigate without flattening it into one endless folder.",
  },
  {
    number: "03",
    eyebrow: "Bring in the originals",
    title: "Import from the places you already work.",
    description:
      "Add photographs from your device, Google Drive, or Google Photos, including common camera RAW formats. Files that need previews continue through processing after import.",
  },
] as const;

const finishSteps = [
  {
    number: "06",
    eyebrow: "Review with context",
    title: "Let AI surface the questions. Keep the decisions.",
    description:
      "Review likely problems, low-scoring frames, and duplicate groups with reasons alongside each suggestion. The photographer stays in control of the final selection.",
  },
  {
    number: "07",
    eyebrow: "Finish without overwriting",
    title: "Build the look beside the original.",
    description:
      "Preview LUT presets at adjustable intensity and apply them to one photograph or a selection as separate copies. Turn favorites into a collage, then export it as JPG or PNG.",
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

      <section aria-labelledby="home-heading" className="mx-auto max-w-screen-2xl px-5 pb-5 pt-8 sm:px-8 sm:pb-8 sm:pt-12 lg:px-12 lg:pb-12">
        <div className="grid gap-10 md:grid-cols-12 md:items-start md:gap-6">
          <div className="md:col-span-4 lg:col-span-3">
            <p className="max-w-xs text-xs font-semibold uppercase leading-5 tracking-widest text-orange-700">
              A professional wedding photography workspace
            </p>
            <p className="mt-4 max-w-sm text-base leading-7 text-stone-600">
              From the first import to the private gallery, SaathiDesk keeps the
              work clear and the photographs central.
            </p>
          </div>

          <div className="md:col-span-8 md:col-start-5 lg:col-span-8 lg:col-start-5">
            <h1
              id="home-heading"
              className="text-balance text-left font-editorial text-5xl font-medium leading-none tracking-tight sm:text-7xl md:text-right lg:text-8xl xl:text-9xl"
            >
              The wedding is a story. Your workspace should know the plot.
            </h1>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 md:justify-end">
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

      <nav aria-label="Product journey" className="border-b border-stone-300">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap px-5 sm:px-8 lg:px-12">
          {[
            ["#workflow", "Set up"],
            ["#find", "Find"],
            ["#finish", "Review & finish"],
            ["#deliver", "Deliver"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`inline-flex min-h-11 items-center border-r border-stone-300 px-4 text-xs font-semibold uppercase tracking-widest text-stone-600 transition-colors first:border-l hover:bg-stone-200 hover:text-stone-950 ${focusClass}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <section
        id="workflow"
        aria-labelledby="workflow-heading"
        className="scroll-mt-6 mx-auto max-w-screen-2xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36"
      >
        <div className="grid gap-10 border-b border-stone-300 pb-12 md:grid-cols-12 md:gap-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-700 md:col-span-3">
            From card to client
          </p>
          <div className="md:col-span-8 md:col-start-5">
            <h2
              id="workflow-heading"
              className="max-w-4xl font-editorial text-4xl font-medium leading-tight tracking-tight sm:text-6xl lg:text-7xl"
            >
              A working rhythm that follows the wedding.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
              Begin with the relationship, keep the day in chapters, and bring
              every original into one considered workspace.
            </p>
          </div>
        </div>

        <ol>
          {setupSteps.map((step) => (
            <li
              key={step.number}
              className="grid gap-5 border-b border-stone-300 py-10 md:grid-cols-12 md:gap-6 md:py-14"
            >
              <span
                className="font-editorial text-2xl text-orange-700 md:col-span-1"
                aria-hidden="true"
              >
                {step.number}
              </span>
              <p className="text-xs font-semibold uppercase leading-5 tracking-widest text-stone-600 md:col-span-3">
                {step.eyebrow}
              </p>
              <div className="md:col-span-7 md:col-start-6">
                <h3 className="font-editorial text-3xl font-medium leading-tight tracking-tight sm:text-5xl">
                  {step.title}
                </h3>
                <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="find"
        aria-labelledby="find-heading"
        className="scroll-mt-6 bg-stone-950 px-5 py-20 text-stone-50 sm:px-8 sm:py-28 lg:px-12 lg:py-36"
      >
        <div className="mx-auto max-w-screen-2xl">
          <div className="grid gap-10 md:grid-cols-12 md:gap-6">
            <div className="md:col-span-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">
                04–05 · Find the frame
              </p>
              <h2
                id="find-heading"
                className="mt-5 max-w-xl font-editorial text-4xl font-medium leading-tight tracking-tight sm:text-6xl"
              >
                Ask for the moment, not the filename.
              </h2>
            </div>
            <div className="md:col-span-7 md:col-start-6">
              <p className="max-w-2xl text-lg leading-8 text-stone-300">
                AI-assisted search helps you move through people, outfits,
                scenes, and details in everyday language. Narrow the result by
                event or by one or more people when the story calls for it.
              </p>
              <Link
                href="/how-ai-works"
                className={`mt-6 inline-flex min-h-11 items-center border-b border-orange-400 text-sm font-semibold text-stone-50 transition-colors hover:text-orange-300 focus-visible:ring-orange-400 focus-visible:ring-offset-stone-950 ${focusClass}`}
              >
                How AI-assisted search works
              </Link>
            </div>
          </div>

          <div className="mt-14 grid gap-12 border-t border-stone-700 pt-10 lg:grid-cols-2 lg:gap-8">
            <figure>
              <div className="relative aspect-[16/10] overflow-hidden bg-stone-200">
                <Image
                  src="/ai-guide/people-search.png"
                  alt="SaathiDesk gallery showing people filters used to narrow photographs by person"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-contain"
                />
              </div>
              <figcaption className="grid gap-3 border-t border-stone-700 pt-5 sm:grid-cols-6">
                <span className="font-editorial text-2xl text-orange-400" aria-hidden="true">
                  04
                </span>
                <div className="sm:col-span-5">
                  <h3 className="font-editorial text-3xl font-medium">People and moment search</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-stone-400">
                    Search naturally, then use people filters to bring a guest,
                    a group, or a shared moment into focus.
                  </p>
                </div>
              </figcaption>
            </figure>

            <figure className="lg:mt-24">
              <div className="relative aspect-[16/10] overflow-hidden bg-stone-200">
                <Image
                  src="/ai-guide/find-yourself.png"
                  alt="SaathiDesk Find Yourself flow inviting a guest to upload a portrait for matching gallery photos"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-contain"
                />
              </div>
              <figcaption className="grid gap-3 border-t border-stone-700 pt-5 sm:grid-cols-6">
                <span className="font-editorial text-2xl text-orange-400" aria-hidden="true">
                  05
                </span>
                <div className="sm:col-span-5">
                  <h3 className="font-editorial text-3xl font-medium">Find Yourself</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-stone-400">
                    A guest can submit a selfie to look for the photographs they
                    appear in, with results shaped by completed album processing.
                  </p>
                </div>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section
        id="finish"
        aria-labelledby="finish-heading"
        className="scroll-mt-6 mx-auto max-w-screen-2xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36"
      >
        <div className="grid gap-10 border-b border-stone-300 pb-12 md:grid-cols-12 md:gap-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-700 md:col-span-3">
            Review and finish
          </p>
          <h2
            id="finish-heading"
            className="max-w-4xl font-editorial text-4xl font-medium leading-tight tracking-tight sm:text-6xl md:col-span-8 md:col-start-5 lg:text-7xl"
          >
            Faster judgment. Still your judgment.
          </h2>
        </div>

        <ol>
          {finishSteps.map((step) => (
            <li
              key={step.number}
              className="grid gap-5 border-b border-stone-300 py-10 md:grid-cols-12 md:gap-6 md:py-14"
            >
              <span
                className="font-editorial text-2xl text-orange-700 md:col-span-1"
                aria-hidden="true"
              >
                {step.number}
              </span>
              <p className="text-xs font-semibold uppercase leading-5 tracking-widest text-stone-600 md:col-span-3">
                {step.eyebrow}
              </p>
              <div className="md:col-span-7 md:col-start-6">
                <h3 className="font-editorial text-3xl font-medium leading-tight tracking-tight sm:text-5xl">
                  {step.title}
                </h3>
                <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="deliver"
        aria-labelledby="deliver-heading"
        className="scroll-mt-6 border-y border-stone-300 bg-stone-200 px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36"
      >
        <div className="mx-auto grid max-w-screen-2xl gap-12 md:grid-cols-12 md:gap-6">
          <div className="md:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-700">
              08 · Private delivery
            </p>
            <h2
              id="deliver-heading"
              className="mt-5 font-editorial text-4xl font-medium leading-tight tracking-tight sm:text-6xl"
            >
              A gallery shaped for the people receiving it.
            </h2>
          </div>

          <div className="md:col-span-7 md:col-start-6">
            <div className="border-t border-stone-400 py-7">
              <h3 className="font-editorial text-3xl font-medium">Design the room</h3>
              <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                Set the gallery layout, spacing, typography, background, and
                photo order with a live preview before the link leaves your desk.
              </p>
            </div>
            <div className="border-t border-stone-400 py-7">
              <h3 className="font-editorial text-3xl font-medium">Choose the boundaries</h3>
              <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                Add a passcode, watermark, expiration, person restrictions, and
                download controls. Create a full-gallery link or a more focused
                view for selected people.
              </p>
            </div>
            <div className="border-y border-stone-400 py-7">
              <h3 className="font-editorial text-3xl font-medium">Deliver the right files</h3>
              <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                When downloads are enabled, deliver all photographs or a chosen
                event, selection, or people-filtered set in original, JPEG, or PNG format.
              </p>
            </div>
          </div>
        </div>
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
              Get started with a calmer path from shoot to client delivery.
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
            <Link href="/how-ai-works" className="min-h-11 content-center px-2 transition-colors hover:text-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 motion-reduce:transition-none">
              How AI works
            </Link>
            <Link href="/docs" className="min-h-11 content-center px-2 transition-colors hover:text-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 motion-reduce:transition-none">
              Docs
            </Link>
            <Link href="/legal/privacy-policy" className="min-h-11 content-center px-2 transition-colors hover:text-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 motion-reduce:transition-none">
              Privacy
            </Link>
            <Link href="/legal/terms-of-service" className="min-h-11 content-center px-2 transition-colors hover:text-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 motion-reduce:transition-none">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

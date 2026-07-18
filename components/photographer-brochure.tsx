import Image from "next/image";
import Link from "next/link";

const focusClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-100 motion-reduce:transition-none";

const evidence = [
  {
    src: "/ai-guide/saathidesk-ai.png",
    alt: "SaathiDesk gallery search with a natural-language moment query and matching wedding photographs",
    label: "Describe a moment",
    sizes: "(min-width: 1024px) 32vw, (min-width: 640px) 50vw, 86vw",
  },
  {
    src: "/ai-guide/group-search.png",
    alt: "People filter showing photographs with two or more selected people",
    label: "Find selected people in group photographs",
    sizes: "(min-width: 1024px) 34vw, (min-width: 640px) 50vw, 86vw",
  },
  {
    src: "/ai-guide/find-yourself.png",
    alt: "Find Yourself panel for uploading a portrait and locating the closest-looking album photograph",
    label: "Find the nearest whole-image match",
    sizes: "(min-width: 1024px) 34vw, (min-width: 640px) 50vw, 86vw",
  },
] as const;

const capabilityGroups = [
  {
    number: "01",
    tier: "Core",
    title: "Find moments in natural language",
    summary:
      "Describe what is visible in everyday words, then browse the closest photos within an album or event. Add a named, numbered, or selected person when the moment matters as much as who is in it.",
    chips: [
      "Natural-language visual search",
      "Actions and emotions",
      "Ceremony, scene, venue and decor",
      "Outfits, colors, jewelry and details",
      "Person by name or number",
      "Person + moment, outfit or scene",
      "Selected people together",
      "Album or event scope",
      "Searchable AI captions and descriptions",
      "Keyword and person fallback",
      "Ranked result browsing",
      "Permission-aware download handoff",
    ],
    caveat:
      "This ranks similar photos; it is not a chatbot and has no relevance cutoff. Semantic search needs completed full-photo embeddings, pgvector, a matching model and OpenRouter. If that provider fails, search falls back to captions and generated metadata. Names come from the photographer. Text search is unavailable on person-restricted shares or links that hide AI.",
  },
  {
    number: "02",
    tier: "Core",
    title: "Organize and deliver by People",
    summary:
      "Completed face processing groups repeat appearances into browsable People. Photographers can correct the groups, combine People with photo filters, and make person-scoped delivery links.",
    chips: [
      "Face detection and grouping",
      "Person covers",
      "Photo and event counts",
      "Rename people",
      "Search aliases",
      "Merge duplicate groups",
      "Choose a cover while merging",
      "One-person galleries",
      "Any selected",
      "All together",
      "Only them",
      "Group shots",
      "Person and group share links",
      "Passcode, expiry, download and watermark controls",
      "Find Yourself",
    ],
    caveat:
      "People are algorithmic clusters, not verified identities, so missed or duplicate faces may need review. Any means at least one selection; All includes every selection and may include others; Only them requires exactly the selected indexed people; Group means at least two selected people. Find Yourself sends a resized portrait to OpenRouter, picks one nearest whole-image match with no acceptance threshold, then opens the People labeled in that photo. Clothing, background and the moment can affect the match. Processing depends on an external worker whose model and accuracy are not established here.",
  },
  {
    number: "03",
    tier: "Core",
    title: "Review and cull with AI context",
    summary:
      "Bring quality signals, written reasons, alternates and strong candidates by person into one review workspace. The photographer compares and decides what becomes a delivery set.",
    chips: [
      "Album-worthy score",
      "Frame clarity",
      "Background quality",
      "Camera gaze",
      "People count",
      "Decor and detail tags",
      "Written reasons",
      "Missing-AI and low-signal issues",
      "All photos",
      "Needs review",
      "Low score",
      "Similarity and likely-duplicate groups",
      "Best by person",
      "Event filtering",
      "Compare alternates",
      "Persist cluster best",
      "Keep and Reject working marks",
      "Keyboard review",
      "Auto-select up to 100 loaded candidates",
      "Selected-original ZIP",
      "Create a selection album",
    ],
    caveat:
      "This is assisted review, not automatic final culling. Keep, Reject and Auto-select live only in browser memory and disappear on reload. Setting a cluster best and creating a new selection album are durable. Similarity groups are not guaranteed duplicates. The system does not implement blur, blink, closed-eye, composition, exposure, noise, pose or general photo-type classifiers. Some cluster scores are adapted to Clarity and Background labels and are not the same fields as the separate frame-clarity and background-quality signals.",
  },
  {
    number: "04",
    tier: "Optional",
    title: "Make generative photo edits",
    summary:
      "In the photo viewer, combine a short instruction with a preset prompt. Preview the generated still, download it, or add it to an album as a separate photo.",
    chips: [
      "Free-text prompt",
      "Remove background",
      "Blur background",
      "Enhance lighting",
      "Remove object",
      "Add a dog",
      "Studio portrait",
      "Anime-style restyling",
      "Cinematic look",
      "Remove background people",
      "Inline result preview",
      "Download result",
      "Add to event as a separate copy",
    ],
    caveat:
      "This optional feature sends a flattened, resized JPEG (normally no more than 1280 px on the long side) to Novita Flux Kontext Max. Results vary; transparent backgrounds, exact removal, original resolution and pixel-perfect identity are not promised. The anime shortcut still makes one image, not animation or video. There is no later status or history screen after the synchronous polling window. Generation can be available through album, share or passcode access, but only the owner can add a result to an album.",
  },
  {
    number: "05",
    tier: "Optional",
    title: "Find faces across video timelines",
    summary:
      "Manually scan a video for album People, uploaded selfie references or newly discovered faces. Filter occurrence intervals by person and jump playback to the exact detected moments.",
    chips: [
      "One or many known-person targets",
      "Multiple selfie targets",
      "Known + unknown discovery",
      "Extract all faces",
      "Face chips and thumbnails",
      "Occurrence counts",
      "Timestamped intervals",
      "Timeline markers",
      "Click to seek",
      "Frame count and similarity by interval",
      "People-filtered Reels",
      "Active-occurrence face overlay",
      "Access-gated timeline deep link",
    ],
    caveat:
      "This is face-occurrence detection, not general video intelligence. It does not search scenes or objects, recognize speech, transcribe, caption, summarize, find highlights, infer actions or emotions, or edit video. Unknown and selfie-only targets do not become album People or drive album filters. Runs are manual and asynchronous, clear prior matches when resubmitted, and rely on an external Lambda or RunPod worker with model, threshold and accuracy details outside this repository. A copied timeline URL is not a public share link; person-restricted shares currently have a video authorization gap.",
  },
  {
    number: "06",
    tier: "Operations",
    title: "Control, monitor and disclose processing",
    summary:
      "Studio users choose when AI runs, inspect per-file and gallery status, retry failures, rebuild selected outputs, or clear generated data. Share settings can hide many guest-facing discovery surfaces.",
    chips: [
      "AI on or off for event uploads",
      "Full pipeline",
      "Face worker",
      "Image-text worker",
      "Best-photo culling",
      "New-photo event and album runs",
      "20-photo sample",
      "Retry captions",
      "Retry face detection",
      "Full-photo embeddings only",
      "Status check",
      "Reset and rerun",
      "Delete faces, embeddings and LLM text",
      "Per-file upload and processing state",
      "Retry failed processing",
      "Gallery processing and failure banners",
      "Hide AI on a share",
    ],
    caveat:
      "These controls orchestrate external Lambda or RunPod workers; semantic and image matching also use OpenRouter. The separate upload flow always enables AI, while the event uploader can turn it off. Event management does not poll a submitted job in place. Hide AI changes presentation rather than stopping processing or deleting data, and it is not universal: direct culling may remain available with a share token, while the edit wand has separate access rules. AI-completion email is not supported.",
  },
] as const;

function TierBadge({ tier }: { tier: (typeof capabilityGroups)[number]["tier"] }) {
  const color =
    tier === "Core"
      ? "border-orange-700 bg-orange-700 text-stone-50"
      : tier === "Optional"
        ? "border-stone-500 bg-stone-200 text-stone-800"
        : "border-stone-700 bg-stone-950 text-stone-50";

  return (
    <span
      className={`inline-flex min-h-7 items-center border px-2.5 text-[0.6875rem] font-bold uppercase tracking-widest ${color}`}
    >
      {tier}
    </span>
  );
}

export function PhotographerBrochure() {
  return (
    <main className="min-h-screen overflow-x-clip bg-stone-100 text-stone-950">
      <header className="border-b border-stone-300 bg-stone-100">
        <nav
          aria-label="Primary navigation"
          className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-12"
        >
          <Link
            href="/"
            className={`inline-flex min-h-11 items-center font-editorial text-2xl font-semibold tracking-tight ${focusClass}`}
          >
            SaathiDesk
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
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
              href="/login?mode=signup"
              className={`inline-flex min-h-11 items-center bg-stone-950 px-4 text-sm font-semibold text-stone-50 transition-colors hover:bg-orange-700 ${focusClass}`}
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <section
        aria-labelledby="brochure-heading"
        className="border-b border-stone-300 px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16"
      >
        <div className="mx-auto grid max-w-screen-2xl gap-8 lg:grid-cols-12 lg:items-end lg:gap-6">
          <div className="lg:col-span-8">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-700">
              Complete AI capabilities guide
            </p>
            <h1
              id="brochure-heading"
              className="mt-4 max-w-5xl text-balance font-editorial text-5xl font-medium leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl"
            >
              What the AI can do. Where it needs you.
            </h1>
          </div>
          <div className="lg:col-span-4">
            <p className="max-w-xl text-base leading-7 text-stone-700">
              A plain-language field guide for photographers: six verified parts
              of SaathiDesk, the controls around them, and the limits worth
              knowing before a client does.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="#capabilities"
                className={`inline-flex min-h-11 items-center border-b-2 border-orange-700 text-sm font-semibold transition-colors hover:text-orange-700 ${focusClass}`}
              >
                Read the six-part guide
              </Link>
              <Link
                href="/how-ai-works"
                className={`inline-flex min-h-11 items-center px-2 text-sm font-medium text-stone-600 transition-colors hover:text-stone-950 ${focusClass}`}
              >
                How AI works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="evidence-heading"
        className="border-b border-stone-300 bg-stone-950 px-5 py-8 text-stone-50 sm:px-8 lg:px-12"
      >
        <div className="mx-auto max-w-screen-2xl">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-orange-400">
                In the gallery
              </p>
              <h2
                id="evidence-heading"
                className="mt-2 font-editorial text-3xl font-medium tracking-tight sm:text-4xl"
              >
                Search and People, shown as they work
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-stone-400">
              These product captures document photo search and People matching.
              They do not depict culling, generative editing, video analysis or
              processing controls.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {evidence.map((item) => (
              <figure key={item.src} className="border border-stone-700 bg-stone-900">
                <div className="relative aspect-[16/9] overflow-hidden bg-stone-800">
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    sizes={item.sizes}
                    loading="eager"
                    className="object-contain"
                  />
                </div>
                <figcaption className="border-t border-stone-700 px-3 py-2 text-xs leading-5 text-stone-300">
                  {item.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="capabilities" aria-labelledby="capabilities-heading">
        <div className="mx-auto max-w-screen-2xl px-5 pt-10 sm:px-8 sm:pt-12 lg:px-12">
          <div className="grid gap-4 border-b border-stone-400 pb-7 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <p className="text-xs font-bold uppercase tracking-widest text-orange-700">
                The verified catalog
              </p>
              <h2
                id="capabilities-heading"
                className="mt-2 font-editorial text-4xl font-medium tracking-tight sm:text-5xl"
              >
                Six parts, with the fine print kept close
              </h2>
            </div>
            <p className="text-sm leading-6 text-stone-600 lg:col-span-4 lg:self-end">
              Core marks the strongest everyday workflows. Optional needs a
              separately configured provider or worker. Operations covers the
              controls around AI rather than an AI result.
            </p>
          </div>
        </div>

        <ol className="mx-auto max-w-screen-2xl px-5 sm:px-8 lg:px-12">
          {capabilityGroups.map((group) => (
            <li
              key={group.number}
              className="grid gap-5 border-b border-stone-300 py-8 lg:grid-cols-12 lg:gap-6 lg:py-10"
            >
              <div className="lg:col-span-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-stone-500" aria-hidden="true">
                    {group.number}
                  </span>
                  <TierBadge tier={group.tier} />
                </div>
                <h3 className="mt-4 max-w-sm font-editorial text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
                  {group.title}
                </h3>
              </div>

              <div className="lg:col-span-4">
                <p className="text-base leading-7 text-stone-800">{group.summary}</p>
                <aside className="mt-5 border-l-2 border-orange-700 pl-4">
                  <p className="text-[0.8125rem] font-bold uppercase tracking-widest text-stone-600">
                    What to know
                  </p>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{group.caveat}</p>
                </aside>
              </div>

              <div className="lg:col-span-5">
                <p className="mb-3 text-[0.8125rem] font-bold uppercase tracking-widest text-stone-600">
                  Included
                </p>
                <ul className="flex flex-wrap gap-2" aria-label={`${group.title} capabilities`}>
                  {group.chips.map((chip) => (
                    <li
                      key={chip}
                      className="border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs leading-5 text-stone-700"
                    >
                      {chip}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="supporting-heading"
        className="border-b border-stone-800 bg-stone-950 px-5 py-10 text-stone-50 sm:px-8 lg:px-12"
      >
        <div className="mx-auto grid max-w-screen-2xl gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-400">
              Supporting workflow, not AI
            </p>
            <h2
              id="supporting-heading"
              className="mt-2 font-editorial text-4xl font-medium tracking-tight"
            >
              Useful tools. Different category.
            </h2>
          </div>
          <div className="lg:col-span-8">
            <p className="text-base leading-7 text-stone-300">
              Deterministic .cube LUT marketplace search, metadata, popularity,
              previews, intensity, save, apply and batch copies; CSS and canvas
              photo filters; collage templates, first-N Auto Fill, random Shuffle,
              manual crop, zoom, rotation, layout and JPG or PNG export; manual
              gallery layout, spacing, typography, palette, sorting, template art
              and live preview; RAW previews, video transcoding and playback, EXIF
              capture time, Google-source deduplication, upload retry, permissions,
              passcodes, watermarks and downloads all support the photography
              workflow. Collage Save to Album is disabled. These are not AI
              recommendations, face-aware crops, AI design or generated output.
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="closing-heading"
        className="bg-stone-100 px-5 py-10 sm:px-8 sm:py-12 lg:px-12"
      >
        <div className="mx-auto grid max-w-screen-2xl gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-700">
              Keep the photographer in the loop
            </p>
            <h2
              id="closing-heading"
              className="mt-3 max-w-4xl font-editorial text-4xl font-medium leading-tight tracking-tight sm:text-6xl"
            >
              Use the signals. Check the result. Make the call.
            </h2>
          </div>
          <nav aria-label="Brochure actions" className="flex flex-wrap gap-3 lg:col-span-4 lg:justify-end">
            <Link
              href="/login?mode=signup"
              className={`inline-flex min-h-11 items-center bg-orange-700 px-5 text-sm font-semibold text-stone-50 transition-colors hover:bg-orange-800 ${focusClass}`}
            >
              Get started
            </Link>
            <Link
              href="/docs"
              className={`inline-flex min-h-11 items-center border border-stone-400 px-5 text-sm font-semibold transition-colors hover:border-stone-950 ${focusClass}`}
            >
              Read the docs
            </Link>
            <Link
              href="/how-ai-works"
              className={`inline-flex min-h-11 items-center px-3 text-sm font-medium text-stone-700 transition-colors hover:text-stone-950 ${focusClass}`}
            >
              How AI works
            </Link>
          </nav>
        </div>
      </section>

      <footer className="border-t border-stone-300 bg-stone-100 px-5 py-6 text-sm text-stone-600 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SaathiDesk</p>
          <p>Capabilities depend on the processing and providers configured for a workspace.</p>
        </div>
      </footer>
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";
import { SITE_NAME } from "@/lib/seo";
import { FullWorkflow } from "@/components/full-workflow";

const focusClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-100 motion-reduce:transition-none";

const capabilityGroups = [
  {
    number: "01",
    tier: "Optional",
    title: "Find faces across video timelines",
    summary:
      "Scan a video for album People, selfie references, or newly discovered faces, then jump to the moments where each face appears.",
    capabilities: [
      "Target one or many known People, multiple selfie uploads, known and unknown discovery, or extract all faces.",
      "Review face chips and thumbnails, occurrence counts, timestamped intervals, timeline markers, frame counts, and similarity for each interval.",
      "Filter Reels by People, show the active-occurrence face overlay, and click an interval to seek playback.",
      "Open an access-gated timeline deep link when the viewer has the required gallery access.",
    ],
    caveat:
      "This is face-occurrence detection, not general video intelligence. It does not search scenes or objects, recognize speech, transcribe, caption, summarize, find highlights, infer actions or emotions, or edit video. Unknown and selfie-only targets do not become album People or drive album filters. Runs are manual and asynchronous, clear prior matches when resubmitted, and rely on an external Lambda or RunPod worker with model, threshold, and accuracy details outside this repository. A copied timeline URL is not a public share link; person-restricted shares currently have a video authorization gap.",
    visual: "video",
  },
  {
    number: "02",
    tier: "Operations",
    title: "Control, monitor, and disclose processing",
    summary:
      "Choose when AI runs, inspect file and gallery status, retry failures, rebuild selected outputs, or clear generated data.",
    capabilities: [
      "Turn AI on or off for event uploads; run the full pipeline, face worker, image-text worker, best-photo culling, new-photo event or album jobs, or a 20-photo sample.",
      "Retry captions or face detection, rebuild full-photo embeddings only, check status, or reset and rerun.",
      "Delete faces, embeddings, and LLM text; inspect per-file upload and processing state, retry failed processing, and read gallery processing or failure banners.",
      "Hide AI on a share when guest-facing discovery should stay out of view.",
    ],
    caveat:
      "These controls orchestrate external Lambda or RunPod workers; semantic and image matching also use OpenRouter. The separate upload flow always enables AI, while the event uploader can turn it off. Event management does not poll a submitted job in place. Hide AI changes presentation rather than stopping processing or deleting data, and it is not universal: direct culling may remain available with a share token, while the edit wand has separate access rules. AI-completion email is not supported.",
    visual: "processing",
  },
  {
    number: "03",
    tier: "Core",
    title: "Find moments in natural language",
    summary:
      "Describe what is visible in everyday words, then browse the closest photos within an album or event.",
    capabilities: [
      "Search actions, emotions, ceremonies, scenes, venues, decor, outfits, colors, jewelry, and small details in natural language.",
      "Add a person by name, number, or selection; combine that person with a moment, outfit, or scene; or ask for selected People together.",
      "Search within an album or event using AI captions and descriptions, with keyword and person fallback when semantic search is unavailable.",
      "Browse ranked results and continue into a permission-aware download handoff.",
    ],
    caveat:
      "This ranks similar photos; it is not a chatbot and has no relevance cutoff. Semantic search needs completed full-photo embeddings, pgvector, a matching model, and OpenRouter. If that provider fails, search falls back to captions and generated metadata. Names come from the photographer. Text search is unavailable on person-restricted shares or links that hide AI.",
    visual: "search",
  },
  {
    number: "04",
    tier: "Core",
    title: "Organize and deliver by People",
    summary:
      "Group repeat appearances into browsable People, correct the groups, combine them with photo filters, and make person-scoped delivery links.",
    capabilities: [
      "Use face detection and grouping, person covers, photo and event counts, renaming, search aliases, duplicate-group merging, and cover choice while merging.",
      "Open one-person galleries or filter for Any selected, All together, Only them, and Group shots.",
      "Create person and group share links with passcode, expiry, download, and watermark controls.",
      "Use Find Yourself to upload a portrait and open the People attached to the nearest whole-image match.",
    ],
    caveat:
      "People are algorithmic clusters, not verified identities, so missed or duplicate faces may need review. Any means at least one selection; All includes every selection and may include others; Only them requires exactly the selected indexed people; Group means at least two selected people. Find Yourself sends a resized portrait to OpenRouter, picks one nearest whole-image match with no acceptance threshold, then opens the People labeled in that photo. Clothing, background, and the moment can affect the match. Processing depends on an external worker whose model and accuracy are not established here.",
    visual: "people",
  },
  {
    number: "05",
    tier: "Core",
    title: "Review and cull with AI context",
    summary:
      "Bring quality signals, written reasons, alternates, and strong candidates by person into one review workspace. The photographer makes the final call.",
    capabilities: [
      "Read Album-worthy score, Frame clarity, Background quality, Camera gaze, People count, decor and detail tags, written reasons, plus missing-AI and low-signal issues.",
      "Move between All photos, Needs review, Low score, similarity and likely-duplicate groups, Best by person, and event filters.",
      "Compare alternates, persist a cluster best, add temporary Keep or Reject working marks, and review from the keyboard.",
      "Auto-select up to 100 loaded candidates, download selected originals as a ZIP, or create a selection album.",
    ],
    caveat:
      "This is assisted review, not automatic final culling. Keep, Reject, and Auto-select live only in browser memory and disappear on reload. Setting a cluster best and creating a new selection album are durable. Similarity groups are not guaranteed duplicates. The system does not implement blur, blink, closed-eye, composition, exposure, noise, pose, or general photo-type classifiers. Some cluster scores are adapted to Clarity and Background labels and are not the same fields as the separate frame-clarity and background-quality signals.",
    visual: "culling",
  },
  {
    number: "06",
    tier: "Optional",
    title: "Make generative photo edits",
    summary:
      "Combine a short instruction with a preset prompt in the photo viewer, then preview, download, or save the generated still as a separate photo.",
    capabilities: [
      "Write a free-text prompt or choose Remove background, Blur background, Enhance lighting, or Remove object.",
      "Use Add a dog, Studio portrait, Anime-style restyling, Cinematic look, or Remove background people presets.",
      "Preview the result inline and download it.",
      "Add the result to an event as a separate copy when signed in as the owner.",
    ],
    caveat:
      "This optional feature sends a flattened, resized JPEG (normally no more than 1280 px on the long side) to Novita Flux Kontext Max. Results vary; transparent backgrounds, exact removal, original resolution, and pixel-perfect identity are not promised. The anime shortcut still makes one image, not animation or video. There is no later status or history screen after the synchronous polling window. Generation can be available through album, share, or passcode access, but only the owner can add a result to an album.",
    visual: "edits",
  },
] as const;

type CapabilityGroup = (typeof capabilityGroups)[number];

function TierBadge({ tier }: { tier: CapabilityGroup["tier"] }) {
  const color =
    tier === "Core"
      ? "border-orange-700 bg-orange-700 text-stone-50"
      : tier === "Optional"
        ? "border-stone-500 bg-stone-200 text-stone-800"
        : "border-stone-700 bg-stone-950 text-stone-50";

  return (
    <span className={`inline-flex min-h-7 items-center border px-2.5 text-[0.6875rem] font-bold uppercase tracking-widest ${color}`}>
      {tier}
    </span>
  );
}

function IllustrationLabel({ dark = false }: { dark?: boolean }) {
  return (
    <p className={`text-[0.6875rem] font-bold uppercase tracking-widest ${dark ? "text-orange-400" : "text-orange-700"}`}>
      Interface illustration · not a product screenshot
    </p>
  );
}

function VideoIllustration() {
  return (
    <figure className="bg-stone-200 p-4 sm:p-6">
      <IllustrationLabel />
      <div className="mt-4 bg-stone-950 p-4 text-stone-50 sm:p-5">
        <div className="flex flex-wrap gap-2" aria-label="Example video face targets">
          {["Album: Maya", "Selfie: guest", "Unknown faces"].map((target) => (
            <span key={target} className="border border-stone-600 px-3 py-2 text-xs text-stone-200">{target}</span>
          ))}
        </div>
        <div className="mt-8" role="img" aria-label="Illustrative video occurrence timeline with four detected intervals">
          <div className="flex justify-between font-mono text-[0.6875rem] text-stone-400"><span>00:00</span><span>02:14</span><span>04:28</span></div>
          <div className="relative mt-2 h-10 border-y border-stone-700">
            <div className="absolute inset-x-0 top-1/2 h-px bg-stone-500" />
            {["left-[8%]", "left-[31%]", "left-[58%]", "left-[83%]"].map((position) => (
              <span key={position} className={`absolute top-2 h-6 w-1 bg-orange-500 ${position}`} />
            ))}
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-stone-400">Occurrences</dt><dd className="mt-1 font-semibold">4 intervals</dd></div>
          <div><dt className="text-stone-400">Frames</dt><dd className="mt-1 font-semibold">27 matched</dd></div>
          <div><dt className="text-stone-400">Active face</dt><dd className="mt-1 font-semibold">Maya</dd></div>
          <div><dt className="text-stone-400">Action</dt><dd className="mt-1 font-semibold text-orange-400">Seek to 02:37</dd></div>
        </dl>
      </div>
      <figcaption className="mt-3 text-xs leading-5 text-stone-600">A compact model of target selection, occurrence markers, and click-to-seek playback.</figcaption>
    </figure>
  );
}

function ProcessingIllustration() {
  const rows = [
    ["Face worker", "Complete"],
    ["Image-text worker", "Processing"],
    ["Full-photo embeddings", "Failed"],
  ] as const;
  return (
    <figure className="bg-stone-950 p-4 text-stone-50 sm:p-6">
      <IllustrationLabel dark />
      <div className="mt-4 border border-stone-700 bg-stone-900">
        <div className="border-b border-stone-700 px-4 py-3 text-sm font-semibold">Event processing pipeline</div>
        <ul>
          {rows.map(([name, status]) => (
            <li key={name} className="flex min-h-11 items-center justify-between gap-4 border-b border-stone-800 px-4 py-2 last:border-0">
              <span className="text-sm text-stone-200">{name}</span>
              <span className={status === "Failed" ? "text-sm font-semibold text-orange-400" : "text-sm text-stone-400"}>{status}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Illustrative processing controls">
        <button type="button" disabled className="min-h-11 border border-orange-600 px-4 text-sm font-semibold text-orange-300 disabled:cursor-default">Retry failed</button>
        <button type="button" disabled className="min-h-11 border border-stone-600 px-4 text-sm font-semibold text-stone-200 disabled:cursor-default">Check status</button>
        <button type="button" disabled className="min-h-11 px-4 text-sm font-semibold text-stone-300 disabled:cursor-default">Reset and rerun</button>
      </div>
      <figcaption className="mt-3 text-xs leading-5 text-stone-400">Status rows keep the failed stage and its recovery controls together.</figcaption>
    </figure>
  );
}

function SearchVisual() {
  return (
    <div className="grid gap-3">
      <figure className="bg-stone-950 p-3">
        <div className="relative aspect-[16/7] overflow-hidden bg-stone-900">
          <Image src="/ai-guide/saathidesk-ai.png" alt={`${SITE_NAME} natural-language search showing a moment query and matching wedding photographs`} fill sizes="(min-width: 1024px) 46vw, 94vw" className="object-contain" />
        </div>
        <figcaption className="mt-2 text-xs leading-5 text-stone-300">Actual product capture: a moment described in everyday language.</figcaption>
      </figure>
      <figure className="bg-stone-200 p-3">
        <div className="relative aspect-[16/5] overflow-hidden bg-stone-100">
          <Image src="/ai-guide/only-them.png" alt={`${SITE_NAME} People filter set to Only them for an exact selected-person search`} fill sizes="(min-width: 1024px) 46vw, 94vw" className="object-contain" />
        </div>
        <figcaption className="mt-2 text-xs leading-5 text-stone-600">Actual product capture: narrowing a search to exactly the selected People.</figcaption>
      </figure>
    </div>
  );
}

function PeopleVisual() {
  const captures = [
    ["/ai-guide/people-search.png", `${SITE_NAME} People search showing named face groups`, "Browse and select People"],
    ["/ai-guide/group-search.png", `${SITE_NAME} group filter showing photographs with two or more selected People`, "Find selected People in group photographs"],
    ["/ai-guide/find-yourself.png", `${SITE_NAME} Find Yourself panel for uploading a portrait and locating the nearest whole-image match`, "Upload a portrait for Find Yourself"],
  ] as const;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {captures.map(([src, alt, caption], index) => (
        <figure key={src} className={`bg-stone-950 p-3 ${index === 2 ? "sm:col-span-2" : ""}`}>
          <div className={`relative overflow-hidden bg-stone-900 ${index === 2 ? "aspect-[16/5]" : "aspect-[16/9]"}`}>
            <Image src={src} alt={alt} fill sizes={index === 2 ? "(min-width: 1024px) 46vw, 94vw" : "(min-width: 1024px) 23vw, (min-width: 640px) 47vw, 94vw"} className="object-contain" />
          </div>
          <figcaption className="mt-2 text-xs leading-5 text-stone-300">Actual product capture: {caption}.</figcaption>
        </figure>
      ))}
    </div>
  );
}

function CullingIllustration() {
  return (
    <figure className="bg-stone-200 p-4 sm:p-6">
      <IllustrationLabel />
      <div className="mt-4 grid gap-3 bg-stone-50 p-4 sm:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Similarity group 07 · 4 photos</p>
          <dl className="mt-4 space-y-3 text-sm">
            {["Album-worthy score", "Frame clarity", "Background quality", "Camera gaze"].map((name, index) => (
              <div key={name} className="grid grid-cols-[1fr_auto] gap-4 border-b border-stone-200 pb-2"><dt>{name}</dt><dd className="font-mono font-semibold">{[86, 92, 78, 90][index]}</dd></div>
            ))}
          </dl>
        </div>
        <div className="border-l-2 border-orange-700 pl-4">
          <p className="text-sm font-semibold">Working decision</p>
          <div className="mt-3 flex flex-wrap gap-2"><span className="bg-stone-950 px-3 py-2 text-xs font-bold text-stone-50">Keep</span><span className="border border-stone-400 px-3 py-2 text-xs font-bold">Reject</span></div>
          <p className="mt-4 text-xs leading-5 text-stone-600">Temporary state. Reloading clears these marks.</p>
        </div>
      </div>
      <figcaption className="mt-3 text-xs leading-5 text-stone-600">Implemented score names and similarity groups are shown here; the layout is illustrative.</figcaption>
    </figure>
  );
}

function EditsIllustration() {
  return (
    <figure className="bg-stone-950 p-4 text-stone-50 sm:p-6">
      <IllustrationLabel dark />
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="border border-stone-700 bg-stone-900 p-4"><p className="text-xs uppercase tracking-widest text-stone-400">Prompt</p><p className="mt-3 text-sm leading-6">Remove the people in the distant background.</p></div>
        <span aria-hidden="true" className="text-center font-editorial text-3xl text-orange-400">→</span>
        <div className="border border-stone-700 bg-stone-800 p-4"><p className="text-xs uppercase tracking-widest text-stone-400">Result</p><div className="mt-3 flex aspect-[4/3] items-center justify-center bg-stone-700 text-center text-xs leading-5 text-stone-300">Generated preview appears here</div></div>
      </div>
      <figcaption className="mt-3 text-xs leading-5 text-stone-400">Illustrative prompt-and-result flow. This is not a generated before-and-after or proof of output quality.</figcaption>
    </figure>
  );
}

function GroupVisual({ visual }: { visual: CapabilityGroup["visual"] }) {
  if (visual === "video") return <VideoIllustration />;
  if (visual === "processing") return <ProcessingIllustration />;
  if (visual === "search") return <SearchVisual />;
  if (visual === "people") return <PeopleVisual />;
  if (visual === "culling") return <CullingIllustration />;
  return <EditsIllustration />;
}

export function PhotographerBrochure() {
  return (
    <main className="min-h-screen overflow-x-clip bg-stone-100 text-stone-950">
      <header className="border-b border-stone-300">
        <nav aria-label="Primary navigation" className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-12">
          <Link href="/" className={`inline-flex min-h-11 items-center font-editorial text-2xl font-semibold tracking-tight ${focusClass}`}>{SITE_NAME}</Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/how-ai-works" className={`hidden min-h-11 items-center px-3 text-sm font-medium text-stone-700 transition-colors hover:text-stone-950 sm:inline-flex ${focusClass}`}>How AI works</Link>
            <Link href="/docs" className={`hidden min-h-11 items-center px-3 text-sm font-medium text-stone-700 transition-colors hover:text-stone-950 md:inline-flex ${focusClass}`}>Docs</Link>
            <Link href="/login?mode=signup" className={`inline-flex min-h-11 items-center bg-stone-950 px-4 text-sm font-semibold text-stone-50 transition-colors hover:bg-orange-700 ${focusClass}`}>Get started</Link>
          </div>
        </nav>
      </header>

      <section aria-labelledby="brochure-heading" className="border-b border-stone-300 px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
        <div className="mx-auto grid max-w-screen-2xl gap-8 lg:grid-cols-12 lg:items-end lg:gap-6">
          <div className="lg:col-span-8">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-700">Complete AI capabilities guide</p>
            <h1 id="brochure-heading" className="mt-4 max-w-5xl text-balance font-editorial text-5xl font-medium leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">What the AI can do. Where it needs you.</h1>
          </div>
          <div className="lg:col-span-4">
            <p className="max-w-xl text-base leading-7 text-stone-700">A six-part field guide for photographers. Capabilities stay visible; provider requirements and limits open only when you need them.</p>
            <Link href="#capabilities" className={`mt-5 inline-flex min-h-11 items-center border-b-2 border-orange-700 text-sm font-semibold transition-colors hover:text-orange-700 ${focusClass}`}>Read the guide</Link>
          </div>
        </div>
      </section>

      <section id="capabilities" aria-labelledby="capabilities-heading">
        <div className="mx-auto max-w-screen-2xl px-5 pt-10 sm:px-8 sm:pt-12 lg:px-12">
          <div className="grid gap-4 border-b border-stone-400 pb-7 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <p className="text-xs font-bold uppercase tracking-widest text-orange-700">The verified catalog</p>
              <h2 id="capabilities-heading" className="mt-2 font-editorial text-4xl font-medium tracking-tight sm:text-5xl">Six workflows, in working order</h2>
            </div>
            <p className="text-sm leading-6 text-stone-600 lg:col-span-4 lg:self-end">Core covers everyday workflows. Optional needs a configured provider or worker. Operations covers controls rather than an AI result.</p>
          </div>
        </div>

        <ol className="mx-auto max-w-screen-2xl px-5 sm:px-8 lg:px-12">
          {capabilityGroups.map((group, index) => (
            <li key={group.number} className="border-b border-stone-300 py-10 sm:py-12 lg:py-16">
              <article className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
                <div className={`lg:col-span-5 ${index % 2 === 1 ? "lg:order-2" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-stone-500" aria-label={`Section ${group.number}`}>{group.number}</span>
                    <TierBadge tier={group.tier} />
                  </div>
                  <h3 className="mt-4 max-w-xl font-editorial text-3xl font-medium leading-tight tracking-tight sm:text-4xl">{group.title}</h3>
                  <p className="mt-4 max-w-xl text-base leading-7 text-stone-800">{group.summary}</p>
                  <p className="mt-6 text-[0.6875rem] font-bold uppercase tracking-widest text-stone-500">Included</p>
                  <ul className="mt-3 max-w-xl space-y-3" aria-label={`${group.title} capabilities`}>
                    {group.capabilities.map((capability) => (
                      <li key={capability} className="grid grid-cols-[0.75rem_1fr] gap-3 text-sm leading-6 text-stone-700">
                        <span aria-hidden="true" className="mt-[0.65rem] h-1.5 w-1.5 bg-orange-700" />
                        <span>{capability}</span>
                      </li>
                    ))}
                  </ul>
                  <details className="group mt-6 border-y border-stone-300">
                    <summary className={`flex min-h-11 list-none items-center justify-between gap-4 py-3 text-sm font-semibold text-stone-800 marker:content-none [&::-webkit-details-marker]:hidden ${focusClass}`}>
                      Limits and dependencies
                      <span aria-hidden="true" className="text-xl font-normal text-orange-700 group-open:hidden">+</span>
                      <span aria-hidden="true" className="hidden text-xl font-normal text-orange-700 group-open:inline">−</span>
                    </summary>
                    <p className="pb-4 text-sm leading-6 text-stone-600">{group.caveat}</p>
                  </details>
                </div>
                <div className={`lg:col-span-7 lg:pt-2 ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                  <GroupVisual visual={group.visual} />
                </div>
              </article>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="supporting-heading" className="border-b border-stone-800 bg-stone-950 px-5 py-10 text-stone-50 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-screen-2xl gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-400">Supporting workflow, not AI</p>
            <h2 id="supporting-heading" className="mt-2 font-editorial text-4xl font-medium tracking-tight">Useful tools. Different category.</h2>
          </div>
          <div className="lg:col-span-8">
            <ul className="grid gap-4 text-sm leading-6 text-stone-300 sm:grid-cols-2">
              <li><strong className="text-stone-50">Color and finishing:</strong> .cube LUT discovery, previews, intensity, saved presets, batch copies, and CSS or canvas filters.</li>
              <li><strong className="text-stone-50">Collages:</strong> Templates, Auto Fill, Shuffle, crop, zoom, rotation, layout, and JPG or PNG export. Save to Album is currently disabled.</li>
              <li><strong className="text-stone-50">Gallery presentation:</strong> Manual layout, spacing, typography, palette, sorting, template artwork, and live preview.</li>
              <li><strong className="text-stone-50">Media and delivery:</strong> RAW previews, video playback, EXIF time, upload retry, permissions, passcodes, watermarks, and downloads.</li>
            </ul>
            <p className="mt-5 border-l-2 border-orange-400 pl-4 text-sm leading-6 text-stone-400">These are deterministic workflow tools—not AI recommendations, face-aware crops, AI design, or generated output.</p>
          </div>
        </div>
      </section>

      <FullWorkflow />

      <section aria-labelledby="closing-heading" className="px-5 py-10 sm:px-8 sm:py-12 lg:px-12">
        <div className="mx-auto grid max-w-screen-2xl gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-700">Keep the photographer in the loop</p>
            <h2 id="closing-heading" className="mt-3 max-w-4xl font-editorial text-4xl font-medium leading-tight tracking-tight sm:text-6xl">Use the signals. Check the result. Make the call.</h2>
          </div>
          <nav aria-label="Brochure actions" className="flex flex-wrap gap-3 lg:col-span-4 lg:justify-end">
            <Link href="/login?mode=signup" className={`inline-flex min-h-11 items-center bg-orange-700 px-5 text-sm font-semibold text-stone-50 transition-colors hover:bg-orange-800 ${focusClass}`}>Get started</Link>
            <Link href="/docs" className={`inline-flex min-h-11 items-center border border-stone-400 px-5 text-sm font-semibold transition-colors hover:border-stone-950 ${focusClass}`}>Read the docs</Link>
            <Link href="/how-ai-works" className={`inline-flex min-h-11 items-center px-3 text-sm font-medium text-stone-700 transition-colors hover:text-stone-950 ${focusClass}`}>How AI works</Link>
          </nav>
        </div>
      </section>

      <footer className="border-t border-stone-300 px-5 py-6 text-sm text-stone-600 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {SITE_NAME}</p>
          <p>Capabilities depend on the processing and providers configured for a workspace.</p>
        </div>
      </footer>
    </main>
  );
}

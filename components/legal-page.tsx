import Link from "next/link";
import { Camera } from "lucide-react";
import type { ReactNode } from "react";

interface LegalPageProps {
  children: ReactNode;
  description: string;
  title: string;
  updated: string;
}

export function LegalPage({
  children,
  description,
  title,
  updated,
}: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[#fbfaf8] text-stone-950">
      <header className="border-b border-stone-200/70 bg-[#fbfaf8]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md font-serif text-lg tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-950 text-[#fbfaf8]">
              <Camera className="h-4 w-4" strokeWidth={1.75} />
            </span>
            Apsara
          </Link>

          <Link
            href="/"
            className="text-sm font-medium text-stone-600 transition hover:text-stone-950"
          >
            Back to home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
          Legal
        </p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 text-base leading-7 text-stone-600">{description}</p>
        <p className="mt-4 text-sm text-stone-500">Last updated: {updated}</p>

        <div className="mt-10 space-y-10 text-sm leading-7 text-stone-700 [&_a]:font-medium [&_a]:text-stone-950 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:text-stone-950 [&_li]:pl-1 [&_p+p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>
      </article>

      <footer className="border-t border-stone-200/70">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-8 text-xs text-stone-500 sm:px-8">
          <span>© {new Date().getFullYear()} Apsara Gallery</span>
          <Link href="/legal/privacy-policy" className="hover:text-stone-950">
            Privacy Policy
          </Link>
          <Link href="/legal/terms-of-service" className="hover:text-stone-950">
            Terms of Service
          </Link>
          <a href="mailto:hello@apsara.gallery" className="hover:text-stone-950">
            Contact
          </a>
        </div>
      </footer>
    </main>
  );
}

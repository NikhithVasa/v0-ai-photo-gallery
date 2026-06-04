"use client";

import Link from "next/link";
import { Palette, Upload } from "lucide-react";
import { usePathname } from "next/navigation";
import { AuthAvatarMenu } from "@/components/auth-avatar-menu";

export function PresetPageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const links = [
    { href: "/presets", label: "Marketplace" },
    { href: "/presets/my", label: "My Presets" },
  ];

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-[#f8f7f3]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/customers"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white"
              aria-label="Back to galleries"
            >
              <Palette className="h-4 w-4" />
            </Link>
            <Link href="/presets" className="hidden font-serif text-lg sm:block">
              Presets
            </Link>
            <nav className="flex items-center gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                    pathname === link.href
                      ? "bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200"
                      : "text-zinc-500 hover:text-zinc-950"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/presets/upload"
              className="hidden h-9 items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 sm:flex"
            >
              <Upload className="h-4 w-4" />
              Upload Preset
            </Link>
            <AuthAvatarMenu />
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { AuthAvatarMenu } from "@/components/auth-avatar-menu";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 max-w-full overflow-x-clip border-b border-stone-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <Link href="/" className="min-w-0 truncate font-serif text-xl font-bold text-stone-950">
            SaathiDesk
          </Link>

          <div className="flex shrink-0 items-center gap-4">
            {user ? (
              <AuthAvatarMenu />
            ) : (
              <Link href="/login?mode=signup">
                <Button variant="default" className="bg-stone-950 hover:bg-stone-800">
                  Sign Up
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

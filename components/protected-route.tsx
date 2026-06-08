"use client";

import { Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface ProtectedRouteProps {
  children: ReactNode;
  allowShareToken?: boolean;
  allowPublicAlbumPasscode?: boolean;
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] text-zinc-500">
      <Loader2 className="h-6 w-6 animate-spin" />
    </main>
  );
}

function ProtectedRouteInner({
  children,
  allowShareToken = false,
  allowPublicAlbumPasscode = false,
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const shareToken = searchParams.get("share");
  const publicAlbumPasscodeAllowed =
    allowPublicAlbumPasscode &&
    Boolean(pathname && /^\/albums\/[^/]+$/.test(pathname));
  const publicAccessAllowed =
    (allowShareToken && Boolean(shareToken)) || publicAlbumPasscodeAllowed;

  useEffect(() => {
    if (loading || user || publicAccessAllowed) return;

    const next =
      pathname && pathname !== "/login"
        ? `?next=${encodeURIComponent(`${pathname}${window.location.search}`)}`
        : "";
    router.replace(`/login${next}`);
  }, [loading, pathname, publicAccessAllowed, router, user]);

  if (publicAccessAllowed) return <>{children}</>;

  if (!user && !loading) return null;

  if (loading) return <LoadingScreen />;

  return <>{children}</>;
}

export function ProtectedRoute({
  children,
  allowShareToken = false,
  allowPublicAlbumPasscode = false,
}: ProtectedRouteProps) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ProtectedRouteInner
        allowShareToken={allowShareToken}
        allowPublicAlbumPasscode={allowPublicAlbumPasscode}
      >
        {children}
      </ProtectedRouteInner>
    </Suspense>
  );
}

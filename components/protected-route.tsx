"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface ProtectedRouteProps {
  children: ReactNode;
  allowShareToken?: boolean;
}

function publicAccessIsAllowed(allowShareToken: boolean) {
  if (typeof window === "undefined") return false;

  return allowShareToken && new URLSearchParams(window.location.search).has("share");
}

export function ProtectedRoute({
  children,
  allowShareToken = false,
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [publicAccessAllowed, setPublicAccessAllowed] = useState(() =>
    publicAccessIsAllowed(allowShareToken)
  );

  useEffect(() => {
    setPublicAccessAllowed(publicAccessIsAllowed(allowShareToken));
  }, [allowShareToken]);

  useEffect(() => {
    if (loading || user || publicAccessAllowed) return;

    const next =
      pathname && pathname !== "/login"
        ? `?next=${encodeURIComponent(pathname)}`
        : "";
    router.replace(`/login${next}`);
  }, [loading, pathname, publicAccessAllowed, router, user]);

  if (publicAccessAllowed) return <>{children}</>;

  if (!user && !loading) return null;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  return <>{children}</>;
}

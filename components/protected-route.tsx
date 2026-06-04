"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getCustomerSlugFromHost } from "@/lib/customer-host";

interface ProtectedRouteProps {
  children: ReactNode;
  allowPublicCustomerHost?: boolean;
  allowShareToken?: boolean;
}

function publicAccessIsAllowed(
  allowPublicCustomerHost: boolean,
  allowShareToken: boolean
) {
  if (typeof window === "undefined") return false;

  const customerHostAllowed =
    allowPublicCustomerHost &&
    Boolean(getCustomerSlugFromHost(window.location.host));
  const shareTokenAllowed =
    allowShareToken && new URLSearchParams(window.location.search).has("share");

  return customerHostAllowed || shareTokenAllowed;
}

export function ProtectedRoute({
  children,
  allowPublicCustomerHost = false,
  allowShareToken = false,
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [publicAccessAllowed, setPublicAccessAllowed] = useState(() =>
    publicAccessIsAllowed(allowPublicCustomerHost, allowShareToken)
  );

  useEffect(() => {
    setPublicAccessAllowed(
      publicAccessIsAllowed(allowPublicCustomerHost, allowShareToken)
    );
  }, [allowPublicCustomerHost, allowShareToken]);

  useEffect(() => {
    if (loading || user || publicAccessAllowed) return;

    const next =
      pathname && pathname !== "/login"
        ? `?next=${encodeURIComponent(pathname)}`
        : "";
    router.replace(`/login${next}`);
  }, [loading, pathname, publicAccessAllowed, router, user]);

  if (publicAccessAllowed) return <>{children}</>;

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  return <>{children}</>;
}

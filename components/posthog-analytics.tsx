"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

const posthogKey =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ||
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_API_KEY ||
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let isPostHogInitialized = false;
let hasWarnedMissingKey = false;

function initializePostHog() {
  if (isPostHogInitialized) return true;

  if (!posthogKey) {
    if (process.env.NODE_ENV !== "production" && !hasWarnedMissingKey) {
      console.warn(
        "PostHog is disabled. Set NEXT_PUBLIC_POSTHOG_KEY or NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN.",
      );
      hasWarnedMissingKey = true;
    }
    return false;
  }

  posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_pageview: false,
    capture_pageleave: true,
    defaults: "2026-01-30",
    loaded: (client) => {
      if (process.env.NODE_ENV === "development") {
        client.debug();
      }
    },
  });
  isPostHogInitialized = true;
  return true;
}

function PostHogPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    if (!initializePostHog()) return;

    posthog.capture("$pageview", {
      $current_url: window.location.href,
      pathname,
      search,
    });
  }, [pathname, search]);

  return null;
}

export function PostHogAnalytics() {
  return (
    <Suspense fallback={null}>
      <PostHogPageViewTracker />
    </Suspense>
  );
}

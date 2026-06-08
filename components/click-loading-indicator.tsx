"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const CLICK_LOADING_SELECTOR = [
  "a[href]",
  "[data-click-loading-target]",
].join(",");

const MISSING_ARIA_BUSY = "__missing__";
const DEFAULT_VISIBLE_MS = 900;
const NAVIGATION_VISIBLE_MS = 1800;

function isDisabledTarget(element: HTMLElement) {
  return Boolean(
    element.closest(
      ":disabled,[disabled],[aria-disabled='true'],[data-click-loading-skip='true']",
    ),
  );
}

function isNavigationTarget(element: HTMLElement) {
  const anchor = element.closest("a[href]");
  if (anchor) return true;

  const label = element.getAttribute("aria-label")?.toLowerCase() ?? "";
  const text = element.textContent?.trim().toLowerCase() ?? "";
  return label.includes("back") || text === "back" || text.startsWith("back ");
}

export function ClickLoadingIndicator() {
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const pathname = usePathname();

  const clearLoading = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const activeTarget = activeTargetRef.current;
    activeTargetRef.current = null;
    document.body.removeAttribute("data-app-click-loading");

    if (!activeTarget) return;

    const previousAriaBusy = activeTarget.dataset.clickLoadingPreviousAriaBusy;

    activeTarget.removeAttribute("data-click-loading");

    if (previousAriaBusy === MISSING_ARIA_BUSY) {
      activeTarget.removeAttribute("aria-busy");
    } else if (previousAriaBusy) {
      activeTarget.setAttribute("aria-busy", previousAriaBusy);
    }

    delete activeTarget.dataset.clickLoadingPreviousAriaBusy;
  }, []);

  useEffect(() => {
    clearLoading();
  }, [clearLoading, pathname]);

  useEffect(() => {
    const startLoading = (target: HTMLElement) => {
      if (!target || isDisabledTarget(target)) return;

      clearLoading();

      const previousAriaBusy = target.getAttribute("aria-busy");
      target.dataset.clickLoadingPreviousAriaBusy =
        previousAriaBusy ?? MISSING_ARIA_BUSY;
      target.setAttribute("aria-busy", "true");
      target.setAttribute("data-click-loading", "true");
      document.body.setAttribute("data-app-click-loading", "true");
      activeTargetRef.current = target;

      timerRef.current = window.setTimeout(
        clearLoading,
        isNavigationTarget(target) ? NAVIGATION_VISIBLE_MS : DEFAULT_VISIBLE_MS,
      );
    };

    const targetFromEvent = (event: Event) => {
      if (!(event.target instanceof Element)) return null;
      return event.target.closest<HTMLElement>(CLICK_LOADING_SELECTOR);
    };

    const handleClick = (event: MouseEvent) => {
      if (activeTargetRef.current) return;

      const target = targetFromEvent(event);
      if (!target) return;

      startLoading(target);
    };

    document.addEventListener("click", handleClick, {
      capture: true,
    });

    return () => {
      document.removeEventListener("click", handleClick, {
        capture: true,
      });
      clearLoading();
    };
  }, [clearLoading]);

  return null;
}

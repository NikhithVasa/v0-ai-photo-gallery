"use client";

import { useLayoutEffect } from "react";

type BodyScrollSnapshot = {
  bodyLeft: string;
  bodyOverflow: string;
  bodyOverscrollBehavior: string;
  bodyPaddingRight: string;
  bodyPosition: string;
  bodyRight: string;
  bodyTop: string;
  bodyWidth: string;
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
  scrollY: number;
};

let lockCount = 0;
let snapshot: BodyScrollSnapshot | null = null;

export function useBodyScrollLock(isLocked = true) {
  useLayoutEffect(() => {
    if (!isLocked || typeof window === "undefined") return;

    if (lockCount === 0) {
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;

      snapshot = {
        bodyLeft: document.body.style.left,
        bodyOverflow: document.body.style.overflow,
        bodyOverscrollBehavior: document.body.style.overscrollBehavior,
        bodyPaddingRight: document.body.style.paddingRight,
        bodyPosition: document.body.style.position,
        bodyRight: document.body.style.right,
        bodyTop: document.body.style.top,
        bodyWidth: document.body.style.width,
        htmlOverflow: document.documentElement.style.overflow,
        htmlOverscrollBehavior:
          document.documentElement.style.overscrollBehavior,
        scrollY: window.scrollY,
      };

      document.body.style.position = "fixed";
      document.body.style.top = `-${snapshot.scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.overscrollBehavior = "none";

      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount !== 0 || !snapshot) return;

      const scrollY = snapshot.scrollY;

      document.body.style.position = snapshot.bodyPosition;
      document.body.style.top = snapshot.bodyTop;
      document.body.style.left = snapshot.bodyLeft;
      document.body.style.right = snapshot.bodyRight;
      document.body.style.width = snapshot.bodyWidth;
      document.body.style.overflow = snapshot.bodyOverflow;
      document.body.style.overscrollBehavior = snapshot.bodyOverscrollBehavior;
      document.body.style.paddingRight = snapshot.bodyPaddingRight;
      document.documentElement.style.overflow = snapshot.htmlOverflow;
      document.documentElement.style.overscrollBehavior =
        snapshot.htmlOverscrollBehavior;
      snapshot = null;
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}

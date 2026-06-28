"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

const PRE_AUTH_EASE = [0.175, 0.885, 0.32, 1.1] as const;

export function PreAuthMotionBoundary({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="always"
      transition={{ duration: 0, ease: PRE_AUTH_EASE }}
    >
      {children}
    </MotionConfig>
  );
}

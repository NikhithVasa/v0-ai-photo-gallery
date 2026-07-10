"use client";

import { LandingPage, LegacyLandingPage } from "@/components/landing-page";

export function LandingPageExperience({ enabled }: { enabled: boolean }) {
  return enabled ? <LandingPage /> : <LegacyLandingPage />;
}

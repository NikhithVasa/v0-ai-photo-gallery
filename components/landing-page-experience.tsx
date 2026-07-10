"use client";

import { LandingPage, LegacyLandingPage } from "@/components/landing-page";

export function LandingPageExperience({
  enabled,
  vibrant,
}: {
  enabled: boolean;
  vibrant: boolean;
}) {
  return enabled ? <LandingPage vibrant={vibrant} /> : <LegacyLandingPage />;
}

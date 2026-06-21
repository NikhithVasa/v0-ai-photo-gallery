"use client";

import {
  HowAiWorksPageContent,
  MarketingFooter,
  MarketingHeader,
} from "@/components/landing-page";

export function HowAiWorksPage() {
  return (
    <main className="min-h-screen bg-[#F7F5F0] text-[#1C1B18] antialiased">
      <MarketingHeader />
      <HowAiWorksPageContent />
      <MarketingFooter />
    </main>
  );
}

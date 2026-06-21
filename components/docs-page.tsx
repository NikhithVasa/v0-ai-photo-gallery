"use client";

import {
  DocsPageContent,
  MarketingFooter,
  MarketingHeader,
} from "@/components/landing-page";

export function DocsPage() {
  return (
    <main className="min-h-screen bg-[#F7F5F0] text-[#1C1B18] antialiased">
      <MarketingHeader />
      <DocsPageContent />
      <MarketingFooter />
    </main>
  );
}

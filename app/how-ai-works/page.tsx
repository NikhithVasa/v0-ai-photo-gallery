import type { Metadata } from "next";
import { HowAiWorksPage } from "@/components/how-ai-works-page";
import { PreAuthMotionBoundary } from "@/components/pre-auth-motion-boundary";

export const metadata: Metadata = {
  title: "How AI Works",
  description:
    "Learn how SaathiDesk processes photos for people filters, semantic search, culling, and optional AI edits.",
};

export default function HowAiWorksRoute() {
  return (
    <PreAuthMotionBoundary>
      <HowAiWorksPage />
    </PreAuthMotionBoundary>
  );
}

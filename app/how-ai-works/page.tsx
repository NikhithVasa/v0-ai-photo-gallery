import type { Metadata } from "next";
import { HowAiWorksPage } from "@/components/how-ai-works-page";
import { PreAuthMotionBoundary } from "@/components/pre-auth-motion-boundary";
import { createPageMetadata, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "How AI Works",
  description:
    `Learn how ${SITE_NAME} processes photos for people filters, semantic search, culling, and optional AI edits.`,
  path: "/how-ai-works",
});

export default function HowAiWorksRoute() {
  return (
    <PreAuthMotionBoundary>
      <HowAiWorksPage />
    </PreAuthMotionBoundary>
  );
}

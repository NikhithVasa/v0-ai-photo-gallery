import type { Metadata } from "next";
import { DocsPage } from "@/components/docs-page";
import { PreAuthMotionBoundary } from "@/components/pre-auth-motion-boundary";
import { createPageMetadata, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Documentation",
  description:
    `Guides for browsing, preparing, searching, editing, and sharing ${SITE_NAME} photo galleries.`,
  path: "/docs",
});

export default function DocsRoute() {
  return (
    <PreAuthMotionBoundary>
      <DocsPage />
    </PreAuthMotionBoundary>
  );
}

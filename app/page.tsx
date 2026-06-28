import { LandingPage } from "@/components/landing-page";
import { PreAuthMotionBoundary } from "@/components/pre-auth-motion-boundary";
import { getHomeStructuredData } from "@/lib/seo";

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(getHomeStructuredData()),
        }}
      />
      <PreAuthMotionBoundary>
        <LandingPage />
      </PreAuthMotionBoundary>
    </>
  );
}

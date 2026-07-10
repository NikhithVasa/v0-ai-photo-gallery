import { LandingPageExperience } from "@/components/landing-page-experience";
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
        <LandingPageExperience enabled={process.env.NEXT_PUBLIC_FEATURE_PLAYBOOK_LANDING === "true"} />
      </PreAuthMotionBoundary>
    </>
  );
}

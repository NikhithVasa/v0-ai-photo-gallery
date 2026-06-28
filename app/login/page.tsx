import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPage } from "@/components/login-page";
import { PreAuthMotionBoundary } from "@/components/pre-auth-motion-boundary";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Sign in",
  description: "Sign in to access private SaathiDesk galleries and studio tools.",
  path: "/login",
  noIndex: true,
});

export default function Login() {
  return (
    <PreAuthMotionBoundary>
      <Suspense>
        <LoginPage />
      </Suspense>
    </PreAuthMotionBoundary>
  );
}

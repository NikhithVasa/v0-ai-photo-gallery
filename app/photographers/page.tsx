import type { Metadata } from "next";
import { PhotographerBrochure } from "@/components/photographer-brochure";

export const metadata: Metadata = {
  title: "SaathiDesk AI Capabilities Guide for Photographers",
  description:
    "A complete guide to SaathiDesk AI search, People, assisted culling, generative photo edits, video face timelines, and processing controls.",
  alternates: {
    canonical: "/photographers",
  },
  openGraph: {
    title: "SaathiDesk AI Capabilities Guide for Photographers",
    description:
      "See the complete, plain-language guide to SaathiDesk AI capabilities, controls, dependencies, and limits.",
    url: "/photographers",
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "SaathiDesk AI Capabilities Guide for Photographers",
    description:
      "See the complete, plain-language guide to SaathiDesk AI capabilities, controls, dependencies, and limits.",
    images: ["/twitter-image"],
  },
};

export default function PhotographersPage() {
  return <PhotographerBrochure />;
}

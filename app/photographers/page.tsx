import type { Metadata } from "next";
import { PhotographerBrochure } from "@/components/photographer-brochure";

export const metadata: Metadata = {
  title: "SaathiDesk for Wedding Photographers",
  description:
    "A complete guide to how SaathiDesk helps wedding photographers organize, search, review, finish, privately share, and deliver every shoot.",
  alternates: {
    canonical: "/photographers",
  },
  openGraph: {
    title: "SaathiDesk for Wedding Photographers",
    description:
      "From importing a shoot to delivering the final private gallery—see the complete SaathiDesk workflow.",
    url: "/photographers",
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "SaathiDesk for Wedding Photographers",
    description:
      "From importing a shoot to delivering the final private gallery—see the complete SaathiDesk workflow.",
    images: ["/twitter-image"],
  },
};

export default function PhotographersPage() {
  return <PhotographerBrochure />;
}

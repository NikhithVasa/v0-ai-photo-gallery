import type { Metadata } from "next";
import { ContactPage } from "@/components/contact-page";
import { createPageMetadata, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Contact",
  description: `Contact ${SITE_NAME} for product questions and support.`,
  path: "/contact",
});

export default function ContactRoute() {
  return <ContactPage />;
}

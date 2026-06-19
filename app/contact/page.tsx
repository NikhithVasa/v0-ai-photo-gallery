import type { Metadata } from "next";
import { ContactPage } from "@/components/contact-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact SaathiDesk for product questions and support.",
};

export default function ContactRoute() {
  return <ContactPage />;
}

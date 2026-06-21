import type { Metadata } from "next";
import { DocsPage } from "@/components/docs-page";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Guides for browsing, preparing, searching, editing, and sharing SaathiDesk photo galleries.",
};

export default function DocsRoute() {
  return <DocsPage />;
}

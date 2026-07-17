import { FreshHomepage } from "@/components/fresh-homepage";
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
      <FreshHomepage />
    </>
  );
}

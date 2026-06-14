import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/legal/"],
        disallow: [
          "/api/",
          "/auth",
          "/auth/",
          "/debug/",
          "/login",
          "/albums",
          "/albums/",
          "/customers",
          "/customers/",
          "/collage",
          "/presets",
          "/presets/",
          "/settings",
          "/share",
          "/share/",
          "/upload",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}

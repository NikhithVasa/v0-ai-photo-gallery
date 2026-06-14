import type { Metadata } from "next";

export const SITE_NAME = "SaathiDesk";
export const SITE_TITLE = "SaathiDesk - AI Photo Gallery Platform";
export const SITE_DESCRIPTION =
  "SaathiDesk is an AI-powered private photo gallery platform for organizing, searching, editing, and sharing event photos.";
export const SITE_SUPPORT_EMAIL = "support@saathidesk.com";

export const SITE_KEYWORDS = [
  "AI photo gallery",
  "private photo gallery",
  "wedding photo gallery",
  "event photo gallery",
  "client photo gallery",
  "photographer gallery software",
  "photo search",
  "semantic photo search",
  "face search",
  "people filters",
  "AI photo culling",
  "AI photo editing",
  "photo sharing",
  "watermarked photo sharing",
  "photo downloads",
  "collage builder",
  "LUT presets",
  "Google Drive photo import",
  "Google Photos import",
];

export const SITE_FEATURES = [
  "Private client galleries",
  "Event and album organization",
  "Face grouping and people filters",
  "Semantic photo search",
  "AI photo review and culling",
  "AI image edits",
  "LUT preset marketplace",
  "Collage exports",
  "Passcode-protected sharing",
  "Watermarked previews",
  "Controlled downloads",
  "Google Drive and Google Photos imports",
];

function normalizeSiteUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
}

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
    "saathidesk.com",
);

export const NO_INDEX_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
};

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function getHomeStructuredData() {
  const organizationId = `${SITE_URL}/#organization`;
  const websiteId = `${SITE_URL}/#website`;
  const softwareId = `${SITE_URL}/#software`;
  const serviceId = `${SITE_URL}/#service`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": organizationId,
      name: SITE_NAME,
      url: SITE_URL,
      logo: absoluteUrl("/apple-icon.png"),
      email: SITE_SUPPORT_EMAIL,
      contactPoint: {
        "@type": "ContactPoint",
        email: SITE_SUPPORT_EMAIL,
        contactType: "customer support",
        availableLanguage: ["en"],
        areaServed: "Worldwide",
      },
      knowsAbout: SITE_KEYWORDS,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": websiteId,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      publisher: {
        "@id": organizationId,
      },
      inLanguage: "en",
      potentialAction: {
        "@type": "ViewAction",
        target: absoluteUrl("/login"),
        name: "Open a private photo gallery",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": softwareId,
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "MultimediaApplication",
      applicationSubCategory: "Photography software",
      operatingSystem: "Web",
      description: SITE_DESCRIPTION,
      featureList: SITE_FEATURES,
      creator: {
        "@id": organizationId,
      },
      offers: {
        "@type": "Offer",
        availability: "https://schema.org/OnlineOnly",
        areaServed: "Worldwide",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": serviceId,
      name: "AI-powered private photo gallery service",
      alternateName: [
        "AI wedding photo gallery",
        "Private event photo gallery",
        "Photographer client gallery",
      ],
      provider: {
        "@id": organizationId,
      },
      serviceType: "Photo gallery software",
      areaServed: {
        "@type": "Place",
        name: "Worldwide",
      },
      audience: [
        {
          "@type": "Audience",
          audienceType: "Photographers",
        },
        {
          "@type": "Audience",
          audienceType: "Wedding studios",
        },
        {
          "@type": "Audience",
          audienceType: "Event hosts",
        },
        {
          "@type": "Audience",
          audienceType: "Gallery guests",
        },
      ],
      description: SITE_DESCRIPTION,
      termsOfService: absoluteUrl("/legal/terms-of-service"),
    },
  ];
}

export function createPageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const canonical = absoluteUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${title} | ${SITE_NAME}`,
      description,
    },
    robots: noIndex ? NO_INDEX_ROBOTS : undefined,
  };
}

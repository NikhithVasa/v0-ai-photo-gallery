import type { Metadata } from "next";

export const SITE_NAME = "SaathiDesk";
export const SITE_INITIALS = "SD";
export const SITE_TITLE = `${SITE_NAME} - `;
export const SITE_DESCRIPTION =
  `${SITE_NAME} is a free, open-source AI-powered private photo gallery platform for organizing, searching, editing, and sharing event photos.`;
export const SITE_SUPPORT_EMAIL = "support@saathidesk.com";
export const SITE_LICENSE = "MIT";
export const SITE_LICENSE_URL = "/license.txt";
export const SITE_PRICING_SUMMARY =
  "Free to use. No subscription, no paid plan, no penny, no cent.";
export const SITE_POSITIONING_SUMMARY =
  `A free, open-source cloud gallery delivery platform for wedding professionals, event photographers, and private gallery guests. ${SITE_NAME} includes password-protected galleries, restricted guest downloads, watermarked previews, customer, album, and event-scoped access controls, plus AI-driven Face Filters that help guests isolate only the photos they appear in. There are no $8/month, $40/month, or $50/month tiers, no store commission, no subscription, and no penny or cent charged by the project.`;

export const SITE_KEYWORDS = [
  "free AI photo gallery",
  "free photo gallery software",
  "free private photo gallery",
  "free wedding photo gallery",
  "free event photo gallery",
  "open source photo gallery",
  "open source AI photo gallery",
  "open source photographer gallery software",
  "no cost photo gallery",
  "no subscription photo gallery",
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
  "Free to use",
  "Open-source MIT-licensed codebase",
  "No subscription required",
  "No paid plan required",
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

export const SITE_AUDIENCES = [
  "Photographers",
  "Wedding studios",
  "Event photographers",
  "Event hosts",
  "Gallery guests",
  "Creative studios",
];

export const SITE_USE_CASES = [
  "Free wedding photo delivery",
  "Free event gallery sharing",
  "Open-source private gallery hosting",
  "Wedding photo delivery",
  "Event gallery sharing",
  "Private client proofing",
  "People-based photo discovery",
  "AI-assisted photo review",
  "Watermarked client previews",
  "Selected photo downloads",
  "Album-scoped semantic search",
  "Collage creation",
  "LUT-based photo finishing",
];

export const SITE_WORKFLOW_STEPS = [
  {
    name: "Create a private album",
    text: "Set up a customer, album, and event structure for the gallery.",
  },
  {
    name: "Upload event photos",
    text: "Import files from device storage, Google Drive, or Google Photos.",
  },
  {
    name: "Process previews and AI metadata",
    text: "Generate thumbnails, previews, face groups, search descriptions, and review signals.",
  },
  {
    name: "Search and review moments",
    text: "Use people filters, semantic search, culling views, and best-by-person review tools.",
  },
  {
    name: "Share with controls",
    text: "Deliver the gallery with passcodes, watermarked previews, and controlled downloads.",
  },
];

export const SITE_FAQS = [
  {
    question: `What is ${SITE_NAME}?`,
    answer:
      `${SITE_NAME} is a free, open-source AI-powered private photo gallery platform for organizing, searching, editing, reviewing, and sharing wedding and event photos.`,
  },
  {
    question: `Is ${SITE_NAME} free?`,
    answer:
      `Yes. ${SITE_NAME} is free to use, with no subscription, no paid plan, no penny, and no cent charged by the project.`,
  },
  {
    question: `Does ${SITE_NAME} charge monthly plan fees or store commissions?`,
    answer:
      `No. ${SITE_NAME} does not charge monthly plan fees, paid tier fees, store commissions, pennies, or cents. It is a free, open-source project.`,
  },
  {
    question: `Is ${SITE_NAME} open source?`,
    answer:
      `Yes. ${SITE_NAME} is open source under the MIT license, so the code can be used, copied, modified, and shared under that license.`,
  },
  {
    question: `Who is ${SITE_NAME} for?`,
    answer:
      `${SITE_NAME} is built for photographers, wedding studios, event hosts, and gallery guests who need private event galleries with AI search and sharing controls.`,
  },
  {
    question: `Can ${SITE_NAME} search photos by people or moments?`,
    answer:
      `Yes. ${SITE_NAME} can group faces into people filters and search album photos using short visual prompts such as names, person numbers, clothing, decor, ceremonies, and group photo terms.`,
  },
  {
    question: `Does ${SITE_NAME} support private sharing?`,
    answer:
      "Yes. Galleries can use passcodes, private share links, watermarked previews, and controlled download options for full albums, events, filtered sets, or selected photos.",
  },
  {
    question: `Does ${SITE_NAME} replace original uploaded photos?`,
    answer:
      "No. Originals remain separate from generated thumbnails, clean previews, watermarked previews, AI metadata, and edited outputs.",
  },
  {
    question: `Is ${SITE_NAME} available worldwide?`,
    answer:
      `${SITE_NAME} is a web-based service designed to support photographers, studios, event hosts, and gallery guests worldwide.`,
  },
];

function normalizeSiteUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
}

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.saathidesk.com",
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
  const homePageId = `${SITE_URL}/#homepage`;
  const featureListId = `${SITE_URL}/#features`;
  const useCaseListId = `${SITE_URL}/#use-cases`;
  const workflowId = `${SITE_URL}/#workflow`;
  const faqId = `${SITE_URL}/#faq`;
  const breadcrumbId = `${SITE_URL}/#breadcrumb`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
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
        areaServed: "Worldwide",
        slogan: "Free open-source AI photo galleries",
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        abstract: SITE_POSITIONING_SUMMARY,
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
        "@type": "WebPage",
        "@id": homePageId,
        name: SITE_TITLE,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        abstract: SITE_POSITIONING_SUMMARY,
        disambiguatingDescription: SITE_POSITIONING_SUMMARY,
        isPartOf: {
          "@id": websiteId,
        },
        about: [
          {
            "@id": softwareId,
          },
          {
            "@id": serviceId,
          },
        ],
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: absoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
        },
        breadcrumb: {
          "@id": breadcrumbId,
        },
        inLanguage: "en",
        audience: SITE_AUDIENCES.map((audienceType) => ({
          "@type": "Audience",
          audienceType,
        })),
        mainEntity: {
          "@id": softwareId,
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": softwareId,
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "MultimediaApplication",
        applicationSubCategory: "Photography software",
        operatingSystem: "Web",
        description: SITE_DESCRIPTION,
        abstract: SITE_POSITIONING_SUMMARY,
        disambiguatingDescription: SITE_POSITIONING_SUMMARY,
        license: absoluteUrl(SITE_LICENSE_URL),
        isAccessibleForFree: true,
        featureList: SITE_FEATURES,
        keywords: SITE_KEYWORDS.join(", "),
        screenshot: absoluteUrl("/opengraph-image"),
        browserRequirements: "Requires a modern web browser.",
        availableOnDevice: ["Desktop", "Tablet", "Mobile"],
        inLanguage: "en",
        audience: SITE_AUDIENCES.map((audienceType) => ({
          "@type": "Audience",
          audienceType,
        })),
        creator: {
          "@id": organizationId,
        },
        publisher: {
          "@id": organizationId,
        },
        mainEntityOfPage: {
          "@id": homePageId,
        },
        offers: {
          "@type": "Offer",
          availability: "https://schema.org/OnlineOnly",
          areaServed: "Worldwide",
          price: "0",
          priceCurrency: "USD",
          description: SITE_PRICING_SUMMARY,
          category: "Free open-source software",
          url: absoluteUrl("/login"),
        },
      },
      {
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
        category: "Photography software",
        isAccessibleForFree: true,
        areaServed: {
          "@type": "Place",
          name: "Worldwide",
        },
        audience: SITE_AUDIENCES.map((audienceType) => ({
          "@type": "Audience",
          audienceType,
        })),
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: `${SITE_NAME} gallery capabilities`,
          itemListElement: SITE_USE_CASES.map((name) => ({
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            itemOffered: {
              "@type": "Service",
              name,
            },
          })),
        },
        description: SITE_DESCRIPTION,
        slogan: SITE_POSITIONING_SUMMARY,
        termsOfService: absoluteUrl("/legal/terms-of-service"),
      },
      {
        "@type": "ItemList",
        "@id": featureListId,
        name: `${SITE_NAME} feature catalog`,
        itemListElement: SITE_FEATURES.map((name, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name,
        })),
      },
      {
        "@type": "ItemList",
        "@id": useCaseListId,
        name: `${SITE_NAME} use cases`,
        itemListElement: SITE_USE_CASES.map((name, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name,
        })),
      },
      {
        "@type": "HowTo",
        "@id": workflowId,
        name: `How ${SITE_NAME} prepares and shares a private AI photo gallery`,
        description:
          "A high-level workflow for delivering private wedding and event galleries with AI search, review, and sharing controls.",
        step: SITE_WORKFLOW_STEPS.map((step, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          name: step.name,
          text: step.text,
        })),
        tool: [
          {
            "@type": "HowToTool",
            name: SITE_NAME,
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": faqId,
        mainEntity: SITE_FAQS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
        ],
      },
    ],
  };
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

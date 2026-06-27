import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Geist,
  Geist_Mono,
  Inter,
  Playfair_Display,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { DialRoot } from "dialkit";
import { Toaster } from "@/components/ui/toaster";
import { ClickLoadingIndicator } from "@/components/click-loading-indicator";
import { PostHogAnalytics } from "@/components/posthog-analytics";
import { AuthProvider } from "@/lib/auth-context";
import { ScrollToTop } from "@/components/scroll-to-top";
import {
  SITE_AUDIENCES,
  SITE_DESCRIPTION,
  SITE_FEATURES,
  SITE_KEYWORDS,
  SITE_LICENSE,
  SITE_LICENSE_URL,
  SITE_NAME,
  SITE_POSITIONING_SUMMARY,
  SITE_PRICING_SUMMARY,
  SITE_TITLE,
  SITE_USE_CASES,
  SITE_URL,
} from "@/lib/seo";
import "dialkit/styles.css";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  generator: "v0.app",
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "Photography",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      "x-default": "/",
    },
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} AI photo gallery platform`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/twitter-image"],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  other: {
    classification: "Photography software",
    coverage: "Worldwide",
    distribution: "Global",
    rating: "General",
    pricing: "Free",
    price: "0",
    "price-currency": "USD",
    "free-to-use": "true",
    "open-source": "true",
    license: SITE_LICENSE,
    "license-url": `${SITE_URL}${SITE_LICENSE_URL}`,
    "pricing-summary": SITE_PRICING_SUMMARY,
    "positioning-summary": SITE_POSITIONING_SUMMARY,
    "competitor-alternative-summary": SITE_POSITIONING_SUMMARY,
    "target-audience": SITE_AUDIENCES.join(", "),
    "application-category": "AI photo gallery software",
    "product-features": SITE_FEATURES.join(", "),
    "product-use-cases": SITE_USE_CASES.join(", "),
    "ai-search-summary":
      "AI-powered private photo gallery platform for photographers, wedding studios, event hosts, and gallery guests.",
    "llms-txt": `${SITE_URL}/llms.txt`,
    "machine-readable-metadata": `${SITE_URL}/site-metadata.json`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${cormorant.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <AuthProvider>
          <ScrollToTop />
          <ClickLoadingIndicator />
          {children}
          <Toaster />
        </AuthProvider>
        <PostHogAnalytics />
        {process.env.NODE_ENV === "production" && <Analytics />}
        <DialRoot position="bottom-right" defaultOpen={false} theme="system" />
      </body>
    </html>
  );
}

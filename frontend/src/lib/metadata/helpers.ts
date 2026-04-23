import { type Metadata } from "next";
import { siteConfig, isStaging, getCanonicalUrl } from "./config";

/**
 * Generate base metadata for the application
 * This is used in the root layout and can be extended by individual pages
 */
export function generateBaseMetadata(overrides?: Partial<Metadata>): Metadata {
  const isStagingEnv = isStaging();
  const canonicalUrl = getCanonicalUrl();

  const baseMetadata: Metadata = {
    // Metadata base for resolving social images
    metadataBase: new URL(siteConfig.url),

    // Basic metadata
    title: {
      default: siteConfig.name,
      template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,

    // Application metadata
    applicationName: siteConfig.name,
    generator: "Next.js",
    themeColor: siteConfig.themeColor,

    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: siteConfig.name,
    },

    // Author and creator
    authors: [
      {
        name: siteConfig.creator,
        url: siteConfig.url,
      },
    ],

    // Keywords
    keywords: siteConfig.keywords.join(", "),

    // Creator
    creator: siteConfig.creator,

    // Publisher
    publisher: siteConfig.creator,

    // Format detection
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },

    // Manifest
    manifest: "/manifest.json",

    // Icons
    icons: {
      icon: [
        {
          url: "/metadata/favicon.ico",
          sizes: "any",
        },
        {
          url: "/metadata/favicon-16x16.png",
          sizes: "16x16",
          type: "image/png",
        },
        {
          url: "/metadata/favicon-32x32.png",
          sizes: "32x32",
          type: "image/png",
        },
      ],
      apple: "/metadata/apple-touch-icon.png",
    },

    // Open Graph metadata
    openGraph: {
      type: "website",
      locale: "en_US",
      url: canonicalUrl,
      siteName: siteConfig.name,
      title: {
        default: siteConfig.name,
        template: `%s | ${siteConfig.name}`,
      },
      description: siteConfig.description,
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: siteConfig.name,
        },
      ],
    },

    // Twitter card metadata
    twitter: {
      card: siteConfig.twitter.cardType,
      site: siteConfig.twitter.site,
      creator: siteConfig.twitter.handle,
      title: {
        default: siteConfig.name,
        template: `%s | ${siteConfig.name}`,
      },
      description: siteConfig.description,
      images: [siteConfig.ogImage],
    },

    // Robots - conditionally set noindex for staging
    robots: {
      index: !isStagingEnv,
      follow: !isStagingEnv,
      googleBot: {
        index: !isStagingEnv,
        follow: !isStagingEnv,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },

    // Verification (add your verification codes here)
    // verification: {
    //   google: 'your-google-verification-code',
    //   yandex: 'your-yandex-verification-code',
    // },

    ...overrides,
  };

  return baseMetadata;
}

/**
 * Generate page-specific metadata
 * @param options - Page metadata configuration
 * @returns Next.js Metadata object
 */
export function generatePageMetadata(options: {
  title: string;
  description: string;
  canonicalPath?: string;
  ogImage?: string;
  keywords?: string[];
  overrides?: Partial<Metadata>;
}): Metadata {
  const { title, description, canonicalPath, ogImage, keywords, overrides } =
    options;
  const isStagingEnv = isStaging();
  const canonicalUrl = getCanonicalUrl(canonicalPath);

  return {
    title,
    description,
    keywords: keywords?.join(", "),
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      images: ogImage
        ? [{ url: ogImage, width: 1200, height: 630, alt: title }]
        : undefined,
    },
    twitter: {
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: !isStagingEnv,
      follow: !isStagingEnv,
    },
    ...overrides,
  };
}

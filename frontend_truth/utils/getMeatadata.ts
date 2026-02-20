import type { Metadata } from "next";

const isProduction = process.env.NODE_ENV === "production";
const baseUrl = isProduction
  ? "https://blockopoly.vercel.app/"
  : `http://localhost:${process.env.PORT || 3000}`;

const titleTemplate = "%s | Decentralized Monopoly Game";

/**
 * Generates metadata for a given page.
 *
 * @param {Object} options
 * @param {string} options.title Page title
 * @param {string} options.description Page description
 * @param {string} [options.imageRelativePath="/thumbnail.png"] Relative path to the image for the page
 * @returns {Metadata} The generated metadata
 */
export const getMetadata = ({
  title,
  description,
  imageRelativePath = "/thumbnail.png",
}: {
  title: string;
  description: string;
  imageRelativePath?: string;
  other: {};
}): Metadata => {
  const imageUrl = `${baseUrl}${imageRelativePath}`;

  return {
    generator: "Blockopoly",
    applicationName: "Blockopoly",
    referrer: "origin-when-cross-origin",
    keywords: [
      "blockopoly",
      "monopoly",
      "onchain game",
      "starknet",
      "dojo",
      "cairo",
      "zk-rollups",
      "decentralized gaming",
      "blockchain games",
      "digital properties",
      "trustless gaming experience",
      "buy sell trade properties",
      "onchain monopoly game",
    ],
    creator: "Blockopoly Team",
    publisher: "SignorDev",
    metadataBase: new URL(baseUrl),
    manifest: `${baseUrl}/manifest.json`,
    alternates: {
      canonical: baseUrl,
    },
    robots: {
      index: false,
      follow: true,
      nocache: true,
      googleBot: {
        index: true,
        follow: false,
        noimageindex: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    title: {
      default: title,
      template: titleTemplate,
    },
    description: description,
    openGraph: {
      title: {
        default: title,
        template: titleTemplate,
      },
      description:
        "Blockopoly is a fully on-chain, decentralized version of the classic Monopoly game, built on Starknet using Dojo. This version leverages ZK-Rollups for scalability and Cairo smart contracts to ensure a seamless, trustless gaming experience. Players can buy, sell, and trade digital properties securely, with game logic enforced entirely on-chain.",
      images: [
        {
          url: imageUrl,
          alt: "Blockopoly - Monopoly Game Onchain",
        },
      ],
      type: "website",
      siteName: "Blockopoly",
      locale: "en_US",
      url: "https://blockopoly.vercel.app/",
    },
    twitter: {
      card: "summary_large_image", // Ensures Twitter uses a large image for the preview
      title: {
        default: title,
        template: titleTemplate,
      },
      description:
        "Blockopoly is a fully on-chain, decentralized version of the classic Monopoly game, built on Starknet using Dojo. This version leverages ZK-Rollups for scalability and Cairo smart contracts to ensure a seamless, trustless gaming experience. Players can buy, sell, and trade digital properties securely, with game logic enforced entirely on-chain. #Starknet #Dojo #Blockopoly #OnchainGames #Cartridge",
      creator: "@Blockopoly",
      images: [
        {
          url: imageUrl,
          alt: "Blockopoly - Monopoly Game Onchain",
        },
      ],
    },
    icons: {
      icon: [
        {
          url: `/metadata/favicon-32x32.png`, // Standard favicon for browsers
          sizes: "32x32",
          type: "image/png",
        },
        {
          url: `/metadata/favicon-16x16.png`, // Smaller favicon for some contexts
          sizes: "16x16",
          type: "image/png",
        },
        {
          url: `/metadata/android-chrome-192x192.png`, // Icon for mobile devices and apps
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: `/metadata/android-chrome-512x512.png`, // High-resolution icon for apps/PWAs
          sizes: "512x512",
          type: "image/png",
        },
      ],
      apple: [
        {
          url: `/metadata/apple-touch-icon.png`, // Apple touch icon for iOS devices
          sizes: "180x180",
          type: "image/png",
        },
      ],
      shortcut: [
        {
          url: `/metadata/favicon.ico`, // ICO format for legacy browsers
          sizes: "48x48",
          type: "image/x-icon",
        },
      ],
      other: [
        {
          url: `/metadata/android-chrome-192x192.png`, // Manifest icon for web app manifest
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: `/metadata/android-chrome-512x512.png`, // Larger manifest icon
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
  };
};

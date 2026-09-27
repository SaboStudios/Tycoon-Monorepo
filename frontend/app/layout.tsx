import type { Metadata } from "next";
import "./globals.css";

const SITE_NAME = "Tycoon";
const SITE_DESCRIPTION =
  "Tycoon — play, trade, and manage your board game empire.";

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-black focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-black"
        >
          Skip to main content
        </a>
        <header role="banner" aria-label="Site header" />
        <main id="main-content" role="main" tabIndex={-1}>
          {children}
        </main>
        <footer role="contentinfo" aria-label="Site footer" />
      </body>
    </html>
  );
}

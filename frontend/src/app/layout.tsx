import type { Metadata } from "next";
import type React from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { kronaOne, orbitron, dmSans } from "@/lib/fonts";
import { AnalyticsProvider } from "@/components/providers/analytics-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import { ScrollToTopBtn } from "@/components/ui/scroll-to-top-btn";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { generateBaseMetadata } from "@/lib/metadata";
import { AuthProvider } from "@/components/providers/auth-provider";
import { NearWalletProvider } from "@/components/providers/near-wallet-provider";
import { PWAProvider } from "@/components/providers/pwa-provider";
import { RouteFocusProvider } from "@/components/providers/route-focus-provider";
import "./globals.css";
import NavbarMobile from "@/components/shared/NavbarMobile";
import Navbar from "@/components/shared/Navbar";
import { MSWProvider } from "@/components/providers/msw-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = generateBaseMetadata();

export const isDev = process.env.NODE_ENV === "development";

export default function RootLayout({
  children,
}: Readonly<{
  children?: React.ReactNode | null;
}>): React.JSX.Element {
  const content = children ?? null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${kronaOne.variable} ${orbitron.variable} ${dmSans.variable} antialiased`}
      >
        <AuthProvider>
          <NearWalletProvider>
            <ThemeProvider>
              <MSWProvider />
              <AnalyticsProvider />
              <ErrorBoundary showTechnical={isDev}>
                <Navbar />
                <RouteFocusProvider>{children}</RouteFocusProvider>
                <NavbarMobile />
              </ErrorBoundary>
              <ToastProvider />
              <PWAProvider />
              <ScrollToTopBtn />
            </ThemeProvider>
          </NearWalletProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

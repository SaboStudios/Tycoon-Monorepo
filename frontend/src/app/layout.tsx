import type { Metadata } from "next";
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
import "./globals.css";
import NavbarMobile from "@/components/shared/NavbarMobile";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${kronaOne.variable} ${orbitron.variable} ${dmSans.variable} antialiased`}
      >
        <AnalyticsProvider />
        {children}
        <NavbarMobile />
<AuthProvider>
          <NearWalletProvider>
            <MSWProvider />
            <ErrorBoundary showTechnical={process.env.NODE_ENV === "development"}>
              <Navbar />
              {children}
              <NavbarMobile />
            </ErrorBoundary>
            <ToastProvider />
            <ScrollToTopBtn />
          </NearWalletProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

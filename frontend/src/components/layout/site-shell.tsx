"use client";

import type { ReactNode } from "react";
import Footer from "@/components/shared/Footer";
import Navbar from "@/components/shared/Navbar";
import NavbarMobile from "@/components/shared/NavbarMobile";

type SiteShellProps = {
  children: ReactNode;
};

/**
 * App shell: sticky header (see Navbar), primary main landmark, global footer, mobile nav.
 * Sticky header keeps wayfinding on-screen; Navbar uses a fixed h-16 so skip-link scroll-mt matches.
 */
export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--tycoon-bg)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:m-4 focus:rounded-md focus:bg-[var(--tycoon-card-bg)] focus:px-4 focus:py-2 focus:text-sm focus:font-dm-sans focus:text-[var(--tycoon-text)] focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-[var(--tycoon-accent)]"
      >
        Skip to content
      </a>
      <Navbar />
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 scroll-mt-16 outline-none pb-24 md:pb-8"
      >
        {children}
      </main>
      <Footer />
      <NavbarMobile />
    </div>
  );
}

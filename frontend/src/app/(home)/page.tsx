// app/(home)/page.tsx
// Server component that renders the main home page
import type { ReactNode } from "react";
import HomeClient from "@/clients/HomeClient";
import { generatePageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = generatePageMetadata({
  title: "Home",
  description:
    "Experience the ultimate tycoon gaming platform with immersive gameplay, AI-powered opponents, and real-time multiplayer action.",
  canonicalPath: "/",
  keywords: [
    "tycoon",
    "board game",
    "multiplayer",
    "strategy game",
    "gaming platform",
  ],
});

export default function Home(): React.ReactElement {
  return (
    <main
      aria-label="Tycoon home page"
      className="relative min-h-screen w-full bg-[#010F10]"
    >
      <a
        href="#home-page-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[#00F0FF] focus:px-4 focus:py-2 focus:text-[#010F10] focus:outline-none focus:ring-2 focus:ring-[#00F0FF] focus:ring-offset-2 focus:ring-offset-[#010F10]"
      >
        Skip to home content
      </a>

      <section
        id="home-page-content"
        aria-label="Home page content"
        className="[&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-cyan-400 [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-offset-[#010F10]"
      >
        <HomeClient />
      </section>
    </main>
  );
}

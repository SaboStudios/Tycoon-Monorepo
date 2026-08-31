import PlayWithAISettingsClient from "@/clients/PlayWithAISettingsClient";
import { generatePageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = generatePageMetadata({
  title: "Play with AI",
  description:
    "Challenge AI opponents in Tycoon. Test your strategy against intelligent AI players in single-player mode.",
  canonicalPath: "/play-ai",
  keywords: [
    "AI game",
    "single player",
    "AI opponents",
    "tycoon AI",
    "strategy game",
  ],
});

export default function PlayWithAISettingsPage(): JSX.Element {
  return (
    <main
      aria-label="Play with AI"
      className="relative min-h-screen w-full bg-gray-50/50 dark:bg-neutral-950"
    >
      <a
        href="#play-ai-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
      >
        Skip to play with AI
      </a>

      <h1 className="sr-only">Play with AI</h1>

      <div
        id="play-ai-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <section
        id="play-ai-content"
        aria-label="Play with AI settings"
        className="[&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-indigo-600 [&_*:focus-visible]:ring-offset-2"
      >
        <PlayWithAISettingsClient />
      </section>
    </main>
  );
}

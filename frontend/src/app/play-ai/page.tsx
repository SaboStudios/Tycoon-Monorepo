import PlayWithAISettingsClient from "@/clients/PlayWithAISettingsClient";
import { generatePageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";

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

export default function PlayWithAISettingsPage() {
  return <PlayWithAISettingsClient />;
}

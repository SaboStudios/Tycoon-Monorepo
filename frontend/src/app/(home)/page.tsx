// app/page.tsx
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

export default function Home() {
  return <HomeClient />;
}

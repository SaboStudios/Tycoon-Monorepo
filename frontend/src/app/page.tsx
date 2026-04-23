// Note: This is a legacy page. The actual home page is at app/(home)/page.tsx
// This file is kept as a fallback and will redirect to the main home page.

import { redirect } from "next/navigation";
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

export default function HomeRedirect() {
  redirect("/");
}

// Trade Demo Page
// Note: This page wraps the client component to allow metadata export

import { notFound } from "next/navigation";
import TradeDemoClient from "@/clients/TradeDemoClient";
import { generatePageMetadata } from "@/lib/metadata";
import { isTradeDemoEnabled } from "@/lib/flags";
import type { Metadata } from "next";

export const metadata: Metadata = generatePageMetadata({
  title: "Trade Demo",
  description:
    "Interactive demo of the trading system. Experience real-time property trading with other players in the Tycoon game.",
  canonicalPath: "/trade-demo",
  keywords: ["trading", "property trading", "game demo", "multiplayer trading"],
});

export default function TradeDemoPage() {
  // The demo runs entirely on hard-coded fake players. Gate it behind an
  // explicit opt-in flag so production deployments 404 instead of presenting
  // simulated balances and trades as if they were real.
  if (!isTradeDemoEnabled()) {
    notFound();
  }

  return <TradeDemoClient />;
}

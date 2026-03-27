// Trade Demo Page
// Note: This page wraps the client component to allow metadata export

import TradeDemoClient from "@/clients/TradeDemoClient";
import { generatePageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = generatePageMetadata({
  title: "Trade Demo",
  description:
    "Interactive demo of the trading system. Experience real-time property trading with other players in the Tycoon game.",
  canonicalPath: "/trade-demo",
  keywords: ["trading", "property trading", "game demo", "multiplayer trading"],
});

export default function TradeDemoPage() {
  return <TradeDemoClient />;
}

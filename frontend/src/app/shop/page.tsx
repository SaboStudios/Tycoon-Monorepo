"use client";

import type { Metadata } from "next";
import React, { useState, useCallback } from "react";
import { generatePageMetadata } from "@/lib/metadata";
import { track } from "@/lib/analytics";

// ─── SEO Metadata ────────────────────────────────────────────────────────────
// Exported for Next.js App Router to pick up at the segment level.
// Co-locating with "use client" is intentional: tests import this module
// directly in jsdom where Next.js server-component rules don't apply.
export const metadata: Metadata = generatePageMetadata({
  title: "Analytics Taxonomy Staging Route",
  description:
    "Browse the Tycoon in-game shop. Buy cosmetics, power-ups, and exclusive items for your matches.",
  canonicalPath: "/shop",
  keywords: ["shop", "tycoon", "items", "cosmetics", "power-ups"],
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PreviewItem {
  id: string;
  name: string;
  category: string;
  price: number;
  currency?: string;
}

// ─── Guard ───────────────────────────────────────────────────────────────────
// Validates a value before it is handed to analytics. NaN and non-finite
// prices are rejected so bad data never reaches the event stream.

export function isPurchasablePreviewItem(value: unknown): value is PreviewItem {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.category === "string" &&
    typeof v.price === "number" &&
    Number.isFinite(v.price)
  );
}

// ─── Static preview catalog ──────────────────────────────────────────────────
// Real catalog will be fetched client-side in a future iteration.

const PREVIEW_ITEMS: PreviewItem[] = [
  {
    id: "starter-pack",
    name: "Starter Pack",
    category: "bundle",
    price: 20,
    currency: "USD",
  },
  {
    id: "founder-badge",
    name: "Founder Badge",
    category: "cosmetic",
    price: 5,
    currency: "USD",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShopPage(): React.JSX.Element {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleTrack = useCallback((item: PreviewItem): void => {
    try {
      track("purchase_click", {
        route: "/shop",
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        currency: item.currency ?? "USD",
        value: item.price,
      });
      setStatusMessage("Purchase tracking event recorded.");
    } catch {
      setStatusMessage("Purchase tracking is temporarily unavailable.");
    }
  }, []);

  return (
    <main
      aria-labelledby="shop-page-title"
      className="relative min-h-screen bg-[#010F10] px-6 py-16 text-[#F0F7F7]"
    >
      {/* Skip link — visually hidden until focused, then revealed */}
      <a
        href="#shop-preview-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[#00F0FF] focus:px-4 focus:py-2 focus:text-[#010F10] focus:outline-none focus:ring-2 focus:ring-[#00F0FF] focus:ring-offset-2 focus:ring-offset-[#010F10]"
      >
        Skip to shop items
      </a>

      {/* Polite live region — announces tracking outcomes to screen readers */}
      <div
        id="shop-status-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMessage ?? ""}
      </div>

      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="space-y-4">
          <p className="font-orbitron text-sm uppercase tracking-[0.3em] text-[#00F0FF]">
            In-Game Shop
          </p>
          <h1
            id="shop-page-title"
            className="font-orbitron text-4xl font-[800] uppercase text-[#F0F7F7]"
          >
            Analytics Taxonomy Staging Route
          </h1>
          <p className="max-w-2xl font-dmSans text-base text-[#F0F7F7]/75">
            Browse and purchase items to use in your Tycoon games.
          </p>
        </header>

        <section
          id="shop-preview-content"
          aria-label="Shop preview catalog"
          tabIndex={-1}
          className="focus:outline-none"
        >
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PREVIEW_ITEMS.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-4 rounded-lg border border-[#00F0FF]/20 bg-[#0A1F20] p-6"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-orbitron text-xs uppercase tracking-widest text-[#00F0FF]">
                    {item.category}
                  </span>
                  <span className="font-orbitron text-lg font-bold text-[#F0F7F7]">
                    {item.name}
                  </span>
                  <span className="font-dmSans text-sm text-[#F0F7F7]/60">
                    {item.currency ?? "USD"} {item.price.toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={`Track purchase for ${item.name}`}
                  onClick={() => handleTrack(item)}
                  className="mt-auto rounded bg-[#00F0FF] px-4 py-2 font-orbitron text-sm font-bold text-[#010F10] transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] focus:ring-offset-2 focus:ring-offset-[#0A1F20]"
                >
                  Track Purchase
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

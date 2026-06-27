"use client";

import { useCallback, useState } from "react";
import { track } from "@/lib/analytics";

type PreviewItem = Readonly<{
  id: string;
  name: string;
  category: "bundle" | "cosmetic";
  price: number;
}>;

type PurchaseTrackingStatus = "idle" | "tracked" | "unavailable";

const previewItems: readonly PreviewItem[] = [
  {
    id: "starter-pack",
    name: "Starter Pack",
    category: "bundle",
    price: 20,
  },
  {
    id: "founder-badge",
    name: "Founder Badge",
    category: "cosmetic",
    price: 8,
  },
];

export function isPurchasablePreviewItem(
  item: PreviewItem | null | undefined,
): item is PreviewItem {
  return (
    item !== null &&
    item !== undefined &&
    item.id.trim().length > 0 &&
    item.name.trim().length > 0 &&
    Number.isFinite(item.price) &&
    item.price >= 0
  );
}

export default function ShopPage(): React.JSX.Element {
  const [purchaseTrackingStatus, setPurchaseTrackingStatus] =
    useState<PurchaseTrackingStatus>("idle");

  const handlePurchaseClick = useCallback(
    (item: PreviewItem | null | undefined): void => {
      if (!isPurchasablePreviewItem(item)) {
        setPurchaseTrackingStatus("unavailable");
        return;
      }

      try {
        track("purchase_click", {
          route: "/shop",
          item_id: item.id,
          item_name: item.name,
          item_category: item.category,
          currency: "USD",
          value: item.price,
        });
        setPurchaseTrackingStatus("tracked");
      } catch {
        // Analytics must never make the preview's keyboard controls unusable.
        setPurchaseTrackingStatus("unavailable");
      }
    },
    [],
  );

  const purchaseStatusMessage: string =
    purchaseTrackingStatus === "tracked"
      ? "Purchase tracking event recorded."
      : purchaseTrackingStatus === "unavailable"
        ? "Purchase tracking is temporarily unavailable."
        : "";

  return (
    <main
      aria-labelledby="shop-page-title"
      className="relative min-h-screen bg-[#010F10] px-6 py-16 text-[#F0F7F7]"
    >
      <a
        href="#shop-preview-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[#00F0FF] focus:px-4 focus:py-2 focus:text-[#010F10] focus:outline-none focus:ring-2 focus:ring-[#00F0FF] focus:ring-offset-2 focus:ring-offset-[#010F10]"
      >
        Skip to shop items
      </a>

      <div
        id="shop-status-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Shop tracking status"
        className="sr-only"
      >
        {purchaseStatusMessage}
      </div>

      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="space-y-4">
          <p className="font-orbitron text-sm uppercase tracking-[0.3em] text-[#00F0FF]">
            Shop Preview
          </p>
          <h1
            id="shop-page-title"
            className="font-orbitron text-4xl font-[800] uppercase text-[#F0F7F7]"
          >
            Analytics Taxonomy Staging Route
          </h1>
          <p className="max-w-2xl font-dmSans text-base text-[#F0F7F7]/75">
            Visiting this route emits <code>view_shop</code>. Clicking a purchase button emits{" "}
            <code>purchase_click</code> with a PII-safe payload so staging dashboards can verify the
            provider wiring without a full checkout flow.
          </p>
        </header>

        <section
          id="shop-preview-content"
          aria-label="Shop preview items"
          tabIndex={-1}
          className="grid gap-6 rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#010F10] md:grid-cols-2 [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-[#00F0FF] [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-offset-[#010F10]"
        >
          {previewItems.map((item) => (
            <article
              key={item.id}
              aria-labelledby={`shop-item-${item.id}-title`}
              className="rounded-3xl border border-[#00F0FF]/20 bg-[#0A1F21] p-6 shadow-[0_0_30px_rgba(0,240,255,0.08)]"
            >
              <p className="font-dmSans text-sm uppercase tracking-[0.2em] text-[#00F0FF]/80">
                {item.category}
              </p>
              <h2
                id={`shop-item-${item.id}-title`}
                className="mt-3 font-orbitron text-2xl font-[700] text-[#F0F7F7]"
              >
                {item.name}
              </h2>
              <p className="mt-2 font-dmSans text-sm text-[#F0F7F7]/65">
                Minimal preview item used to validate provider forwarding and taxonomy naming.
              </p>
              <div className="mt-6 flex items-center justify-between">
                <data
                  value={item.price}
                  className="font-orbitron text-xl text-[#00F0FF]"
                >
                  ${item.price}
                </data>
                <button
                  type="button"
                  onClick={() => handlePurchaseClick(item)}
                  aria-label={`Track purchase for ${item.name}`}
                  className="rounded-full bg-[#00F0FF] px-5 py-3 font-orbitron text-sm font-[700] uppercase tracking-[0.15em] text-[#010F10] transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#010F10]"
                >
                  Track Purchase
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

"use client";

import { track } from "@/lib/analytics";

const previewItems = [
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

export default function ShopPage() {
  function handlePurchaseClick(item: (typeof previewItems)[number]) {
    track("purchase_click", {
      route: "/shop",
      item_id: item.id,
      item_name: item.name,
      item_category: item.category,
      currency: "USD",
      value: item.price,
    });
  }

  return (
    <div className="min-h-screen bg-[#010F10] px-6 py-16 text-[#F0F7F7]">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="space-y-4">
          <p className="font-orbitron text-sm uppercase tracking-[0.3em] text-[#00F0FF]">
            Shop Preview
          </p>
          <h1 className="font-orbitron text-4xl font-[800] uppercase text-[#F0F7F7]">
            Analytics Taxonomy Staging Route
          </h1>
          <p className="max-w-2xl font-dmSans text-base text-[#F0F7F7]/75">
            Visiting this route emits <code>view_shop</code>. Clicking a purchase button emits{" "}
            <code>purchase_click</code> with a PII-safe payload so staging dashboards can verify the
            provider wiring without a full checkout flow.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {previewItems.map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-[#00F0FF]/20 bg-[#0A1F21] p-6 shadow-[0_0_30px_rgba(0,240,255,0.08)]"
            >
              <p className="font-dmSans text-sm uppercase tracking-[0.2em] text-[#00F0FF]/80">
                {item.category}
              </p>
              <h2 className="mt-3 font-orbitron text-2xl font-[700] text-[#F0F7F7]">
                {item.name}
              </h2>
              <p className="mt-2 font-dmSans text-sm text-[#F0F7F7]/65">
                Minimal preview item used to validate provider forwarding and taxonomy naming.
              </p>
              <div className="mt-6 flex items-center justify-between">
                <span className="font-orbitron text-xl text-[#00F0FF]">${item.price}</span>
                <button
                  type="button"
                  onClick={() => handlePurchaseClick(item)}
                  className="rounded-full bg-[#00F0FF] px-5 py-3 font-orbitron text-sm font-[700] uppercase tracking-[0.15em] text-[#010F10] transition-transform hover:scale-[1.02]"
                >
                  Track Purchase
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";

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

type PreviewItem = (typeof previewItems)[number];

type PurchaseStatus =
  | { state: "idle" }
  | { state: "pending"; itemId: string }
  | { state: "success"; itemId: string }
  | { state: "conflict"; itemId: string; message: string }
  | { state: "error"; itemId: string; message: string };

const SHOP_PURCHASE_ENDPOINT = "/api/shop/purchases";

/**
 * Builds a stable idempotency key for a purchase intent. The key is derived
 * from the payload (SKU + quantity) so retries/reconnects of the same intent
 * reuse the key, while a changed payload produces a fresh key.
 */
function buildIdempotencyKey(itemId: string, quantity: number): string {
  const payload = `${itemId}:${quantity}`;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${payload}:${crypto.randomUUID()}`;
  }
  return `${payload}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export default function ShopPage() {
  const [status, setStatus] = useState<PurchaseStatus>({ state: "idle" });
  // Cache the idempotency key per payload signature so retries reuse it.
  const idempotencyKeys = useRef<Map<string, string>>(new Map());

  const getOrCreateIdempotencyKey = useCallback((itemId: string, quantity: number) => {
    const signature = `${itemId}:${quantity}`;
    const existing = idempotencyKeys.current.get(signature);
    if (existing) {
      return existing;
    }
    const key = buildIdempotencyKey(itemId, quantity);
    idempotencyKeys.current.set(signature, key);
    return key;
  }, []);

  const handlePurchaseClick = useCallback(
    async (item: PreviewItem) => {
      const quantity = 1;
      const idempotencyKey = getOrCreateIdempotencyKey(item.id, quantity);

      track("purchase_click", {
        route: "/shop",
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        currency: "USD",
        value: item.price,
      });

      setStatus({ state: "pending", itemId: item.id });

      try {
        const response = await fetch(SHOP_PURCHASE_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({ sku: item.id, quantity }),
        });

        if (response.status === 409) {
          // Payload conflict: the key was already used with a different body.
          // Drop the cached key so the next attempt starts a new intent.
          idempotencyKeys.current.delete(`${item.id}:${quantity}`);
          setStatus({
            state: "conflict",
            itemId: item.id,
            message: "This purchase conflicts with a previous request. Please try again.",
          });
          return;
        }

        if (!response.ok) {
          setStatus({
            state: "error",
            itemId: item.id,
            message: "Purchase could not be completed. Please try again.",
          });
          return;
        }

        setStatus({ state: "success", itemId: item.id });
      } catch {
        // Network failure: keep the cached key so a retry reuses the same intent.
        setStatus({
          state: "error",
          itemId: item.id,
          message: "Network error. Retrying will reuse the same purchase intent.",
        });
      }
    },
    [getOrCreateIdempotencyKey],
  );

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
          {previewItems.map((item) => {
            const isPending = status.state === "pending" && status.itemId === item.id;
            const isConflict = status.state === "conflict" && status.itemId === item.id;
            const isError = status.state === "error" && status.itemId === item.id;
            const isSuccess = status.state === "success" && status.itemId === item.id;

            return (
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
                    disabled={isPending}
                    className="rounded-full bg-[#00F0FF] px-5 py-3 font-orbitron text-sm font-[700] uppercase tracking-[0.15em] text-[#010F10] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Processing…" : "Track Purchase"}
                  </button>
                </div>
                {isConflict && (
                  <p
                    role="alert"
                    className="mt-4 rounded-2xl border border-[#FFB020]/40 bg-[#FFB020]/10 px-4 py-3 font-dmSans text-sm text-[#FFB020]"
                  >
                    {status.message}
                  </p>
                )}
                {isError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-2xl border border-[#FF4D4D]/40 bg-[#FF4D4D]/10 px-4 py-3 font-dmSans text-sm text-[#FF4D4D]"
                  >
                    {status.message}
                  </p>
                )}
                {isSuccess && (
                  <p className="mt-4 rounded-2xl border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-4 py-3 font-dmSans text-sm text-[#00F0FF]">
                    Purchase recorded.
                  </p>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}

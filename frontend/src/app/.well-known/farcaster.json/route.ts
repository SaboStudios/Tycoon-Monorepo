import { buildFarcasterManifest } from "@/lib/farcaster/manifest";

/**
 * GET /.well-known/farcaster.json — Farcaster mini app manifest (#1760).
 *
 * Deny-by-default: responds 404 unless a complete account association for
 * this exact host is configured. See frontend/docs/SW-FE-1760-farcaster-manifest.md.
 * Only GET is exported, so Next.js answers other methods with 405.
 */

// Reads server-only env at request time; never prerender a build-time value.
export const dynamic = "force-dynamic";

const BASE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
} as const;

let warnedReason: string | null = null;

export function GET(): Response {
  const result = buildFarcasterManifest({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    FARCASTER_ACCOUNT_ASSOCIATION_HEADER: process.env.FARCASTER_ACCOUNT_ASSOCIATION_HEADER,
    FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD: process.env.FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD,
    FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE: process.env.FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE,
  });

  if (!result.ok) {
    // Log the fixed reason code once per change — never env values.
    if (result.reason !== "association_missing" && warnedReason !== result.reason) {
      warnedReason = result.reason;
      console.warn(`[farcaster] manifest not served: ${result.reason}`);
    }
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { ...BASE_HEADERS, "Cache-Control": "no-store" },
    });
  }

  return new Response(JSON.stringify(result.manifest), {
    status: 200,
    headers: {
      ...BASE_HEADERS,
      // Short TTL so a rotated account association propagates quickly.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

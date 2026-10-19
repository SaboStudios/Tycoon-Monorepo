import { test, expect } from "@playwright/test";

/**
 * #1760 — /.well-known/farcaster.json against the running app.
 *
 * Unconfigured deployments (the CI default) must answer 404 with no-store.
 * Configured deployments must serve a manifest whose every URL is https and
 * same-origin as homeUrl, bound to the serving host, with no webhook.
 */

const PATH = "/.well-known/farcaster.json";

test.describe("Farcaster manifest (#1760)", () => {
  test("fails closed or serves a same-origin manifest", async ({ request }) => {
    const response = await request.get(PATH);
    expect([200, 404]).toContain(response.status());
    expect(response.headers()["content-type"]).toMatch(/application\/json/);

    if (response.status() === 404) {
      expect(response.headers()["cache-control"]).toBe("no-store");
      expect(await response.json()).toEqual({ error: "not_found" });
      return;
    }

    const body = (await response.json()) as {
      accountAssociation: { header: string; payload: string; signature: string };
      miniapp: Record<string, unknown>;
    };
    const home = new URL(String(body.miniapp.homeUrl));
    expect(home.protocol).toBe("https:");
    expect(body.miniapp).not.toHaveProperty("webhookUrl");

    const payload = JSON.parse(
      Buffer.from(body.accountAssociation.payload, "base64url").toString("utf8"),
    ) as { domain: string };
    expect(payload.domain).toBe(home.host);

    for (const [key, value] of Object.entries(body.miniapp)) {
      const urls = Array.isArray(value) ? value : [value];
      for (const candidate of urls) {
        if (typeof candidate === "string" && /Url$|Urls$/.test(key)) {
          expect(new URL(candidate).origin, key).toBe(home.origin);
        }
      }
    }
  });

  test("rejects non-GET methods", async ({ request }) => {
    const response = await request.post(PATH, { data: {} });
    expect(response.status()).toBe(405);
  });
});

// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildFarcasterManifest,
  parseAppOrigin,
  validateFarcasterManifest,
  type FarcasterManifestEnv,
} from "@/lib/farcaster/manifest";
import { scanContents } from "../scripts/check-deny-list.mjs";

const HOST = "play.tycoon.example";
const ORIGIN = `https://${HOST}`;

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function validEnv(overrides: Partial<FarcasterManifestEnv> = {}): FarcasterManifestEnv {
  return {
    NEXT_PUBLIC_APP_URL: ORIGIN,
    NEXT_PUBLIC_APP_ENV: "production",
    FARCASTER_ACCOUNT_ASSOCIATION_HEADER: b64url({ fid: 4242, type: "custody", key: "0x1234abcd" }),
    FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD: b64url({ domain: HOST }),
    FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE: Buffer.from("signature-bytes").toString("base64url"),
    ...overrides,
  };
}

describe("parseAppOrigin (#1760)", () => {
  it("accepts a bare https origin", () => {
    expect(parseAppOrigin(`${ORIGIN}/`)).toEqual({ ok: true, origin: ORIGIN, host: HOST });
  });

  it.each([
    [undefined, "app_url_missing"],
    ["not a url", "app_url_invalid"],
    [`http://${HOST}`, "app_url_not_https"],
    [`${ORIGIN}/app`, "app_url_not_origin"],
    [`${ORIGIN}/?next=https://evil.example`, "app_url_not_origin"],
    [`https://user:pass@${HOST}`, "app_url_not_origin"],
    ["https://localhost:3000", "app_url_local"],
    ["https://127.0.0.1", "app_url_local"],
    ["https://192.168.1.20", "app_url_local"],
  ])("rejects %s as %s", (input, reason) => {
    expect(parseAppOrigin(input)).toEqual({ ok: false, reason });
  });
});

describe("buildFarcasterManifest (#1760)", () => {
  it("is deny-by-default: no association configured means no manifest", () => {
    expect(buildFarcasterManifest({ NEXT_PUBLIC_APP_URL: ORIGIN })).toEqual({
      ok: false,
      reason: "association_missing",
    });
  });

  it("refuses a partially configured association", () => {
    expect(
      buildFarcasterManifest(validEnv({ FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE: "" })),
    ).toEqual({ ok: false, reason: "association_incomplete" });
  });

  it("builds a same-origin manifest bound to this host", () => {
    const result = buildFarcasterManifest(validEnv());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { miniapp } = result.manifest;
    expect(miniapp.version).toBe("1");
    expect(miniapp.homeUrl).toBe(`${ORIGIN}/`);
    expect(miniapp.iconUrl).toBe(`${ORIGIN}/blue-icon.png`);
    expect(miniapp.noindex).toBe(false);
    expect(result.manifest).not.toHaveProperty("miniapp.webhookUrl");
    for (const url of [miniapp.iconUrl, miniapp.splashImageUrl, miniapp.heroImageUrl, ...miniapp.screenshotUrls]) {
      expect(new URL(url).origin).toBe(ORIGIN);
    }
  });

  it("marks non-production deployments noindex", () => {
    const result = buildFarcasterManifest(validEnv({ NEXT_PUBLIC_APP_ENV: "staging" }));
    expect(result.ok && result.manifest.miniapp.noindex).toBe(true);
  });

  it("rejects an association signed for a different domain (spoof / copy-paste)", () => {
    expect(
      buildFarcasterManifest(
        validEnv({ FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD: b64url({ domain: "base-monopoly.vercel.app" }) }),
      ),
    ).toEqual({ ok: false, reason: "association_domain_mismatch" });
  });

  it("rejects a parent-domain association for a subdomain deployment", () => {
    expect(
      buildFarcasterManifest(
        validEnv({ FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD: b64url({ domain: "tycoon.example" }) }),
      ),
    ).toEqual({ ok: false, reason: "association_domain_mismatch" });
  });

  it.each([
    ["non-base64url characters", { FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE: "abc$<script>" }, "association_malformed"],
    ["oversized parts", { FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE: "a".repeat(5000) }, "association_malformed"],
    ["header that is not JSON", { FARCASTER_ACCOUNT_ASSOCIATION_HEADER: "bm90LWpzb24" }, "association_header_invalid"],
    [
      "header with a non-positive fid",
      { FARCASTER_ACCOUNT_ASSOCIATION_HEADER: b64url({ fid: 0, type: "custody", key: "0x1" }) },
      "association_header_invalid",
    ],
    [
      "header with an unknown key type",
      { FARCASTER_ACCOUNT_ASSOCIATION_HEADER: b64url({ fid: 1, type: "admin", key: "0x1" }) },
      "association_header_invalid",
    ],
    ["payload without a domain", { FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD: b64url({ host: HOST }) }, "association_payload_invalid"],
  ])("rejects %s", (_label, overrides, reason) => {
    expect(buildFarcasterManifest(validEnv(overrides))).toEqual({ ok: false, reason });
  });

  it("re-validation catches third-party URLs and oversized copy", () => {
    const result = buildFarcasterManifest(validEnv());
    if (!result.ok) throw new Error("expected a manifest");

    const thirdParty = structuredClone(result.manifest);
    thirdParty.miniapp.iconUrl = "https://evil.example/icon.png";
    expect(validateFarcasterManifest(thirdParty, ORIGIN)).toBe("manifest_url_not_same_origin");

    const insecure = structuredClone(result.manifest);
    insecure.miniapp.homeUrl = `http://${HOST}/`;
    expect(validateFarcasterManifest(insecure, ORIGIN)).toBe("manifest_url_not_same_origin");

    const longName = structuredClone(result.manifest);
    longName.miniapp.name = "x".repeat(33);
    expect(validateFarcasterManifest(longName, ORIGIN)).toBe("manifest_field_invalid");

    const markup = structuredClone(result.manifest);
    markup.miniapp.subtitle = "<img src=x onerror=alert(1)>";
    expect(validateFarcasterManifest(markup, ORIGIN)).toBe("manifest_field_invalid");
  });

  it("player-facing manifest copy passes the chain deny-list (ADR-003)", () => {
    const result = buildFarcasterManifest(validEnv());
    if (!result.ok) throw new Error("expected a manifest");
    const json = JSON.stringify(result.manifest.miniapp, null, 2);
    expect(scanContents(json, "farcaster.json")).toEqual([]);
  });
});

describe("GET /.well-known/farcaster.json (#1760)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  async function loadRoute(env: FarcasterManifestEnv) {
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value ?? "");
    }
    vi.resetModules();
    return import("@/app/.well-known/farcaster.json/route");
  }

  it("returns 404 JSON with no-store when not configured", async () => {
    const { GET } = await loadRoute({ NEXT_PUBLIC_APP_URL: ORIGIN });
    const response = GET();
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("serves the manifest with a short public cache when valid", async () => {
    const { GET } = await loadRoute(validEnv());
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300, s-maxage=300");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const body = (await response.json()) as { miniapp: { homeUrl: string } };
    expect(body.miniapp.homeUrl).toBe(`${ORIGIN}/`);
  });

  it("logs only a reason code (never env values) and only once per reason", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const signature = Buffer.from("do-not-log-me").toString("base64url");
    const { GET } = await loadRoute(
      validEnv({
        FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD: b64url({ domain: "other.example" }),
        FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE: signature,
      }),
    );

    expect(GET().status).toBe(404);
    expect(GET().status).toBe(404);

    expect(warn).toHaveBeenCalledTimes(1);
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("association_domain_mismatch");
    expect(logged).not.toContain(signature);
    expect(logged).not.toContain("other.example");
  });

  it("exports only GET (other methods get 405 from Next)", async () => {
    const route = await loadRoute(validEnv());
    expect(Object.keys(route).filter((key) => key !== "dynamic").sort()).toEqual(["GET"]);
  });
});

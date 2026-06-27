import { describe, expect, it } from "vitest";
import { generateBaseMetadata, generatePageMetadata } from "../helpers";
import { getCanonicalUrl } from "../config";

describe("@/lib/metadata helpers", () => {
  it("normalizes canonical paths with and without a leading slash", () => {
    expect(getCanonicalUrl("page")).toBe("http://localhost:3000/page");
    expect(getCanonicalUrl("/page")).toBe("http://localhost:3000/page");
  });

  it("returns the base URL for empty or whitespace paths", () => {
    expect(getCanonicalUrl("")).toBe("http://localhost:3000");
    expect(getCanonicalUrl("   ")).toBe("http://localhost:3000");
  });

  it("generateBaseMetadata includes default keywords and Open Graph/Twitter images", () => {
    const baseMetadata = generateBaseMetadata();

    expect(baseMetadata.keywords).toContain("tycoon");
    expect(baseMetadata.openGraph?.images?.[0]?.url).toBe("/metadata/og-image.png");
    expect(baseMetadata.twitter?.images?.[0]).toBe("/metadata/og-image.png");
  });

  it("generatePageMetadata uses default keywords and default Open Graph/Twitter image when omitted", () => {
    const pageMetadata = generatePageMetadata({
      title: "Test Page",
      description: "Test description",
      canonicalPath: "test-page",
    });

    expect(pageMetadata.keywords).toContain("tycoon");
    expect(pageMetadata.openGraph?.images?.[0]?.url).toBe("/metadata/og-image.png");
    expect(pageMetadata.twitter?.images?.[0]).toBe("/metadata/og-image.png");
    expect(pageMetadata.alternates?.canonical).toBe("http://localhost:3000/test-page");
  });

  it("generatePageMetadata preserves explicit keywords and ogImage values", () => {
    const pageMetadata = generatePageMetadata({
      title: "Test Page",
      description: "Test description",
      canonicalPath: "/test/page",
      ogImage: "https://example.com/custom.png",
      keywords: ["alpha", "beta"],
    });

    expect(pageMetadata.keywords).toBe("alpha, beta");
    expect(pageMetadata.openGraph?.images?.[0]?.url).toBe("https://example.com/custom.png");
    expect(pageMetadata.twitter?.images?.[0]).toBe("https://example.com/custom.png");
  });
});

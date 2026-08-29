import { afterEach, describe, expect, it, vi } from "vitest";

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/clients/TradeDemoClient", () => ({
  default: () => null,
}));
vi.mock("@/lib/metadata", () => ({
  generatePageMetadata: () => ({}),
}));

const ORIGINAL = process.env.NEXT_PUBLIC_TRADE_DEMO;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_TRADE_DEMO;
  else process.env.NEXT_PUBLIC_TRADE_DEMO = ORIGINAL;
  notFound.mockClear();
  vi.resetModules();
});

async function loadPage() {
  return (await import("./page")).default;
}

describe("TradeDemoPage gating", () => {
  it("calls notFound() when the flag is off", async () => {
    delete process.env.NEXT_PUBLIC_TRADE_DEMO;
    const Page = await loadPage();
    expect(() => Page()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("renders the client when the flag is on", async () => {
    process.env.NEXT_PUBLIC_TRADE_DEMO = "true";
    const Page = await loadPage();
    expect(() => Page()).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { isTradeDemoEnabled } from "./flags";

const ORIGINAL = process.env.NEXT_PUBLIC_TRADE_DEMO;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.NEXT_PUBLIC_TRADE_DEMO;
  } else {
    process.env.NEXT_PUBLIC_TRADE_DEMO = ORIGINAL;
  }
  vi.unstubAllEnvs();
});

describe("isTradeDemoEnabled", () => {
  it("is off when the flag is unset", () => {
    delete process.env.NEXT_PUBLIC_TRADE_DEMO;
    expect(isTradeDemoEnabled()).toBe(false);
  });

  it.each(["true", "TRUE", "1", "on", "enabled", " true "])(
    "is on for %j",
    (value) => {
      process.env.NEXT_PUBLIC_TRADE_DEMO = value;
      expect(isTradeDemoEnabled()).toBe(true);
    },
  );

  it.each(["false", "0", "off", "", "no", "yes-ish"])(
    "is off for %j",
    (value) => {
      process.env.NEXT_PUBLIC_TRADE_DEMO = value;
      expect(isTradeDemoEnabled()).toBe(false);
    },
  );
});

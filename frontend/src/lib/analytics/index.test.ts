import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as analytics from "./index";

describe("@/lib/analytics strict exports", () => {
  it("exposes a deliberate runtime API from the barrel", () => {
    expect(Object.keys(analytics).sort()).toEqual([
      "getAnalyticsErrorType",
      "getViewEventForPath",
      "registerAnalyticsDebugHandle",
      "track",
    ]);
  });

  it("uses explicit named exports so bundlers can tree-shake unused utilities", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/analytics/index.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/export\s+\*/);
    expect(source).not.toMatch(/export\s+type\s+\*/);
  });

  it("does not leak internal helpers like sanitizeAnalyticsPayload or analyticsEventSchema", () => {
    expect(analytics).not.toHaveProperty("sanitizeAnalyticsPayload");
    expect(analytics).not.toHaveProperty("analyticsEventSchema");
  });
});

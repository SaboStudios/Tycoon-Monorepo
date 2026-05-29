import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as errors from ".";

const dirname = fileURLToPath(new URL(".", import.meta.url));

describe("@/lib/errors strict exports", () => {
  it("exposes a deliberate runtime API from the barrel", () => {
    expect(Object.keys(errors).sort()).toEqual([
      "API_ERROR_CATEGORY",
      "ERROR_MESSAGES",
      "ErrorCategory",
      "categorizeError",
      "getApiErrorCategory",
      "getApiErrorCategoryFromUnknown",
      "getHttpStatusErrorCategory",
      "isNetworkError",
      "isRecoverableError",
      "isServerError",
      "sanitizeError",
    ]);
  });

  it("uses explicit named exports so bundlers can tree-shake unused utilities", () => {
    const source = readFileSync(resolve(dirname, "index.ts"), "utf8");

    expect(source).not.toMatch(/export\s+\*/);
    expect(source).not.toMatch(/export\s+type\s+\*/);
  });
});

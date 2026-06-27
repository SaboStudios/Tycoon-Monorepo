import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as apiFacade from "../../src/lib/api";
import * as apiBarrel from "../../src/lib/api/index";

describe("@/lib/api strict exports", () => {
  it("exposes only the runtime public API from the barrel", () => {
    expect(Object.keys(apiBarrel).sort()).toEqual([
      "TycoonApiError",
      "apiClient",
      "isApiError",
      "isUnauthorized",
      "isValidationError",
    ]);
  });

  it("uses explicit named exports instead of wildcard exports", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/api/index.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/export\s+\*/);
    expect(source).not.toMatch(/export\s+type\s+\*/);
    expect(source).toContain("export type {");
  });

  it("keeps the legacy @/lib/api facade compatible with the strict barrel", () => {
    expect(Object.keys(apiFacade).sort()).toEqual([
      "TycoonApiError",
      "apiClient",
      "apiRequest",
      "isApiError",
      "isUnauthorized",
      "isValidationError",
    ]);
  });
});

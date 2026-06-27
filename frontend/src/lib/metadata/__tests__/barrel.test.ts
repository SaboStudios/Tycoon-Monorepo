/**
 * Barrel completeness: every named export from each sub-module must be
 * re-exported by index.ts. This prevents accidental omissions when a
 * sub-module gains a new export.
 *
 * Type-only exports are excluded because they are erased at runtime and
 * cannot be detected via Object.keys().
 */
import { describe, it, expect } from "vitest";
import * as barrel from "../index";
import * as config from "../config";
import * as helpers from "../helpers";

const subModules: Record<string, Record<string, unknown>> = {
  config,
  helpers,
};

describe("@/lib/metadata barrel completeness", () => {
  for (const [name, mod] of Object.entries(subModules)) {
    for (const key of Object.keys(mod)) {
      it(`re-exports "${key}" from ${name}`, () => {
        expect(barrel).toHaveProperty(key);
      });
    }
  }
});

/**
 * Barrel completeness: every named export from each sub-module must be
 * re-exported by index.ts. This prevents accidental omissions when a
 * sub-module gains a new export.
 */
import { describe, it, expect } from "vitest";
import * as barrel from "../index";
import * as config from "../config";
import * as errors from "../errors";
import * as execution from "../execution";
import * as explorer from "../explorer";
import * as security from "../security";
import * as telemetry from "../telemetry";

const subModules: Record<string, Record<string, unknown>> = {
  config,
  errors,
  execution,
  explorer,
  security,
  telemetry,
};

describe("@/lib/near barrel completeness", () => {
  for (const [name, mod] of Object.entries(subModules)) {
    for (const key of Object.keys(mod)) {
      it(`re-exports "${key}" from ${name}`, () => {
        expect(barrel).toHaveProperty(key);
      });
    }
  }
});

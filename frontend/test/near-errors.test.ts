import { describe, expect, it } from "vitest";
import {
  isLikelyUserRejectedError,
  NEAR_SIGNATURE_REJECTED_MESSAGE,
  nearErrorMessage,
} from "@/lib/near/errors";

describe("near/errors", () => {
  it("detects common user-rejection phrases", () => {
    expect(isLikelyUserRejectedError(new Error("User rejected the request"))).toBe(
      true,
    );
    expect(isLikelyUserRejectedError(new Error("Request cancelled"))).toBe(true);
    expect(isLikelyUserRejectedError(new Error("RPC timeout"))).toBe(false);
  });

  it("returns friendly copy for rejection", () => {
    expect(nearErrorMessage(new Error("User denied transaction"))).toBe(
      NEAR_SIGNATURE_REJECTED_MESSAGE,
    );
  });

  it("passes through other error messages", () => {
    expect(nearErrorMessage(new Error("insufficient gas"))).toBe(
      "insufficient gas",
    );
  });
});

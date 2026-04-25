import { describe, expect, it } from "vitest";
import {
  isLikelyUserRejectedError,
  nearErrorMessage,
  NEAR_SIGNATURE_REJECTED_MESSAGE,
} from "@/lib/near/errors";

describe("isLikelyUserRejectedError", () => {
  it.each([
    "User rejected the request",
    "Request cancelled",
    "user closed",
    "dismissed",
    "denied",
    "user cancelled",
  ])("returns true for '%s'", (msg) => {
    expect(isLikelyUserRejectedError(new Error(msg))).toBe(true);
  });

  it("returns false for unrelated error", () => {
    expect(isLikelyUserRejectedError(new Error("RPC timeout"))).toBe(false);
  });

  it("accepts a plain string", () => {
    expect(isLikelyUserRejectedError("user rejected")).toBe(true);
    expect(isLikelyUserRejectedError("network error")).toBe(false);
  });

  it("returns false for non-string non-Error values", () => {
    expect(isLikelyUserRejectedError(null)).toBe(false);
    expect(isLikelyUserRejectedError(42)).toBe(false);
    expect(isLikelyUserRejectedError({})).toBe(false);
  });
});

describe("nearErrorMessage", () => {
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

  it("returns fallback for Error with empty message", () => {
    expect(nearErrorMessage(new Error(""))).toBe(
      "Something went wrong with the NEAR wallet request.",
    );
  });

  it("returns fallback for unknown non-Error value", () => {
    expect(nearErrorMessage(null)).toBe(
      "Something went wrong with the NEAR wallet request.",
    );
    expect(nearErrorMessage(42)).toBe(
      "Something went wrong with the NEAR wallet request.",
    );
  });
});

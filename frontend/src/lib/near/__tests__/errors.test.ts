import { describe, it, expect } from "vitest";
import {
  isLikelyUserRejectedError,
  nearErrorMessage,
  NEAR_SIGNATURE_REJECTED_MESSAGE,
} from "../errors";

describe("isLikelyUserRejectedError", () => {
  it("returns true for 'User rejected' Error", () => {
    expect(isLikelyUserRejectedError(new Error("User rejected the request"))).toBe(true);
  });

  it("returns true for 'rejected' string", () => {
    expect(isLikelyUserRejectedError("Transaction rejected")).toBe(true);
  });

  it("returns true for 'denied'", () => {
    expect(isLikelyUserRejectedError(new Error("Access denied by user"))).toBe(true);
  });

  it("returns true for 'cancel'", () => {
    expect(isLikelyUserRejectedError(new Error("User cancelled the action"))).toBe(true);
  });

  it("returns true for 'closed'", () => {
    expect(isLikelyUserRejectedError(new Error("Modal closed"))).toBe(true);
  });

  it("returns true for 'user closed'", () => {
    expect(isLikelyUserRejectedError(new Error("user closed the wallet"))).toBe(true);
  });

  it("returns true for 'dismiss'", () => {
    expect(isLikelyUserRejectedError(new Error("User dismissed the popup"))).toBe(true);
  });

  it("returns true for 'user cancelled' (substring)", () => {
    expect(isLikelyUserRejectedError(new Error("user cancelled"))).toBe(true);
  });

  it("returns false for a generic network error", () => {
    expect(isLikelyUserRejectedError(new Error("Network timeout"))).toBe(false);
  });

  it("returns false for null", () => {
    expect(isLikelyUserRejectedError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isLikelyUserRejectedError(undefined)).toBe(false);
  });

  it("returns true for error objects with a nested message", () => {
    expect(
      isLikelyUserRejectedError({ message: { cause: "User rejected the request" } }),
    ).toBe(true);
  });

  it("returns false for a plain object", () => {
    expect(isLikelyUserRejectedError({ code: 4001 })).toBe(false);
  });
});

describe("nearErrorMessage", () => {
  it("returns the rejection message for a user-rejected error", () => {
    expect(nearErrorMessage(new Error("User rejected"))).toBe(
      NEAR_SIGNATURE_REJECTED_MESSAGE,
    );
  });

  it("returns the error message for a non-rejection Error", () => {
    expect(nearErrorMessage(new Error("Something exploded"))).toBe(
      "Something exploded",
    );
  });

  it("returns a friendly message for nested error objects", () => {
    expect(
      nearErrorMessage({
        message: { cause: new Error("Wallet is not connected") },
      }),
    ).toBe("Connect your NEAR wallet to continue.");
  });

  it("returns a friendly message for network failures", () => {
    expect(nearErrorMessage(new Error("Failed to fetch"))).toBe(
      "Unable to reach the NEAR network. Check your internet connection.",
    );
  });

  it("returns a friendly message for invalid account errors", () => {
    expect(nearErrorMessage(new Error("Invalid account id"))).toBe(
      "The NEAR account or contract ID is invalid.",
    );
  });

  it("returns the fallback message for null", () => {
    expect(nearErrorMessage(null)).toBe(
      "Something went wrong with the NEAR wallet request.",
    );
  });

  it("returns the fallback message for an empty Error", () => {
    const e = new Error("");
    expect(nearErrorMessage(e)).toBe(
      "Something went wrong with the NEAR wallet request.",
    );
  });

  it("returns the fallback message for a plain object", () => {
    expect(nearErrorMessage({ code: 500 })).toBe(
      "Something went wrong with the NEAR wallet request.",
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the analytics client so no real providers are called.
vi.mock("@/lib/analytics/client", () => ({
  track: vi.fn(),
}));

import { track } from "@/lib/analytics/client";
import {
  trackNearWalletConnected,
  trackNearWalletDisconnected,
  trackNearTxSubmitted,
  trackNearTxConfirmed,
  trackNearTxFailed,
} from "@/lib/near/telemetry";

const mockTrack = vi.mocked(track);

beforeEach(() => {
  mockTrack.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("trackNearWalletConnected", () => {
  it("calls track with near_wallet_connected and network_id", () => {
    trackNearWalletConnected("testnet");
    expect(mockTrack).toHaveBeenCalledOnce();
    expect(mockTrack).toHaveBeenCalledWith("near_wallet_connected", {
      network_id: "testnet",
    });
  });

  it("passes mainnet network_id correctly", () => {
    trackNearWalletConnected("mainnet");
    expect(mockTrack).toHaveBeenCalledWith("near_wallet_connected", {
      network_id: "mainnet",
    });
  });
});

describe("trackNearWalletDisconnected", () => {
  it("calls track with near_wallet_disconnected and network_id", () => {
    trackNearWalletDisconnected("testnet");
    expect(mockTrack).toHaveBeenCalledOnce();
    expect(mockTrack).toHaveBeenCalledWith("near_wallet_disconnected", {
      network_id: "testnet",
    });
  });
});

describe("trackNearTxSubmitted", () => {
  it("calls track with near_tx_submitted, network_id and method_name", () => {
    trackNearTxSubmitted("testnet", "addMessage");
    expect(mockTrack).toHaveBeenCalledWith("near_tx_submitted", {
      network_id: "testnet",
      method_name: "addMessage",
    });
  });
});

describe("trackNearTxConfirmed", () => {
  it("calls track with near_tx_confirmed, network_id and method_name", () => {
    trackNearTxConfirmed("testnet", "mintNFT");
    expect(mockTrack).toHaveBeenCalledWith("near_tx_confirmed", {
      network_id: "testnet",
      method_name: "mintNFT",
    });
  });
});

describe("trackNearTxFailed", () => {
  it.each([
    ["rejected", "rejected"],
    ["no_outcome", "no_outcome"],
    ["on_chain", "on_chain"],
  ] as const)("calls track with error_type=%s", (errorType) => {
    trackNearTxFailed("testnet", "addMessage", errorType);
    expect(mockTrack).toHaveBeenCalledWith("near_tx_failed", {
      network_id: "testnet",
      method_name: "addMessage",
      error_type: errorType,
    });
  });
});

describe("PII safety — taxonomy schema for NEAR events", () => {
  it("near_wallet_connected schema contains no PII fields", async () => {
    const { analyticsEventSchema } = await import("@/lib/analytics/taxonomy");
    const fields = analyticsEventSchema.near_wallet_connected as readonly string[];
    const pii = ["account_id", "wallet_address", "email", "token", "hash"];
    pii.forEach((f) => expect(fields).not.toContain(f));
  });

  it("near_tx_failed schema contains no PII fields", async () => {
    const { analyticsEventSchema } = await import("@/lib/analytics/taxonomy");
    const fields = analyticsEventSchema.near_tx_failed as readonly string[];
    const pii = ["account_id", "wallet_address", "hash", "token"];
    pii.forEach((f) => expect(fields).not.toContain(f));
  });

  it("sanitizeAnalyticsPayload strips account_id even if passed", async () => {
    const { sanitizeAnalyticsPayload } = await import("@/lib/analytics/taxonomy");
    const result = sanitizeAnalyticsPayload("near_wallet_connected", {
      network_id: "testnet",
      account_id: "alice.testnet",
    });
    expect(result).not.toHaveProperty("account_id");
    expect(result).toHaveProperty("network_id", "testnet");
  });

  it("sanitizeAnalyticsPayload strips tx hash from near_tx_confirmed", async () => {
    const { sanitizeAnalyticsPayload } = await import("@/lib/analytics/taxonomy");
    const result = sanitizeAnalyticsPayload("near_tx_confirmed", {
      network_id: "testnet",
      method_name: "addMessage",
      hash: "ABC123",
    });
    expect(result).not.toHaveProperty("hash");
  });
});

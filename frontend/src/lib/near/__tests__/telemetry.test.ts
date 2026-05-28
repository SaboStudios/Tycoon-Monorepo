import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the analytics client before importing telemetry so the module
// picks up the mock at import time.
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
} from "../telemetry";

const mockTrack = vi.mocked(track);

beforeEach(() => {
  mockTrack.mockClear();
});

describe("trackNearWalletConnected", () => {
  it("calls track with near_wallet_connected and network_id", () => {
    trackNearWalletConnected("testnet");
    expect(mockTrack).toHaveBeenCalledOnce();
    expect(mockTrack).toHaveBeenCalledWith("near_wallet_connected", {
      network_id: "testnet",
    });
  });

  it("passes mainnet network_id", () => {
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
  it("calls track with near_tx_submitted, network_id, and method_name", () => {
    trackNearTxSubmitted("testnet", "buy_item");
    expect(mockTrack).toHaveBeenCalledOnce();
    expect(mockTrack).toHaveBeenCalledWith("near_tx_submitted", {
      network_id: "testnet",
      method_name: "buy_item",
    });
  });
});

describe("trackNearTxConfirmed", () => {
  it("calls track with near_tx_confirmed, network_id, and method_name", () => {
    trackNearTxConfirmed("mainnet", "transfer");
    expect(mockTrack).toHaveBeenCalledOnce();
    expect(mockTrack).toHaveBeenCalledWith("near_tx_confirmed", {
      network_id: "mainnet",
      method_name: "transfer",
    });
  });
});

describe("trackNearTxFailed", () => {
  it("calls track with near_tx_failed and error_type=rejected", () => {
    trackNearTxFailed("testnet", "buy_item", "rejected");
    expect(mockTrack).toHaveBeenCalledWith("near_tx_failed", {
      network_id: "testnet",
      method_name: "buy_item",
      error_type: "rejected",
    });
  });

  it("calls track with error_type=no_outcome", () => {
    trackNearTxFailed("testnet", "buy_item", "no_outcome");
    expect(mockTrack).toHaveBeenCalledWith("near_tx_failed", {
      network_id: "testnet",
      method_name: "buy_item",
      error_type: "no_outcome",
    });
  });

  it("calls track with error_type=on_chain", () => {
    trackNearTxFailed("mainnet", "transfer", "on_chain");
    expect(mockTrack).toHaveBeenCalledWith("near_tx_failed", {
      network_id: "mainnet",
      method_name: "transfer",
      error_type: "on_chain",
    });
  });
});

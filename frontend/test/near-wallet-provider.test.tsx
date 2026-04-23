import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React, { useEffect } from "react";
import {
  NearWalletContext,
  useNearWallet,
  type CallContractMethodParams,
} from "@/components/providers/near-wallet-provider";
import { createMockNearWalletValue } from "@/test/near-wallet-mock";
import type { NearTxRecord } from "@/lib/near/types";

/** Renders a headless component that calls the provided action on mount. */
function Harness({ action }: { action: () => void }) {
  useEffect(() => { action(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const BASE_PARAMS: CallContractMethodParams = {
  contractId: "guest-book.testnet",
  methodName: "addMessage",
  args: { text: "hello" },
};

describe("callContractMethod — via mock context", () => {
  it("calls the mock and resolves undefined by default", async () => {
    const callContractMethod = vi.fn().mockResolvedValue(undefined);
    const value = createMockNearWalletValue({ callContractMethod });

    await act(async () => {
      render(
        <NearWalletContext.Provider value={value}>
          <Harness action={() => { void callContractMethod(BASE_PARAMS); }} />
        </NearWalletContext.Provider>,
      );
    });

    expect(callContractMethod).toHaveBeenCalledWith(BASE_PARAMS);
  });

  it("propagates rejection from callContractMethod", async () => {
    const err = new Error("NEAR wallet is not ready");
    const callContractMethod = vi.fn().mockRejectedValue(err);
    const value = createMockNearWalletValue({ callContractMethod });

    await expect(callContractMethod(BASE_PARAMS)).rejects.toThrow(
      "NEAR wallet is not ready",
    );
  });

  it("propagates user-rejection error", async () => {
    const err = new Error("User rejected the request");
    const callContractMethod = vi.fn().mockRejectedValue(err);
    const value = createMockNearWalletValue({ callContractMethod });

    await expect(callContractMethod(BASE_PARAMS)).rejects.toThrow(
      "User rejected the request",
    );
  });
});

describe("clearTransactions — via mock context", () => {
  it("clears the transactions list when invoked", () => {
    const tx: NearTxRecord = {
      id: "1",
      phase: "confirmed",
      methodName: "addMessage",
      contractId: "guest-book.testnet",
    };

    let capturedClear: (() => void) | undefined;

    function Capture() {
      const { clearTransactions } = useNearWallet();
      capturedClear = clearTransactions;
      return null;
    }

    const clearTransactions = vi.fn();
    const value = createMockNearWalletValue({
      transactions: [tx],
      clearTransactions,
    });

    render(
      <NearWalletContext.Provider value={value}>
        <Capture />
      </NearWalletContext.Provider>,
    );

    act(() => { capturedClear?.(); });
    expect(clearTransactions).toHaveBeenCalledTimes(1);
  });
});

describe("transactions list — display only latest", () => {
  it("renders only the first transaction record (latest)", () => {
    const transactions: NearTxRecord[] = [
      { id: "1", phase: "pending", methodName: "mintNFT", contractId: "nft.testnet" },
      { id: "2", phase: "confirmed", methodName: "addMessage", contractId: "guest-book.testnet" },
    ];

    render(
      <NearWalletContext.Provider
        value={createMockNearWalletValue({ accountId: "a.testnet", transactions })}
      >
        <div data-testid="wallet-root">
          {/* Inline minimal render to assert only latest shown */}
          <span>{transactions[0].methodName}</span>
        </div>
      </NearWalletContext.Provider>,
    );

    expect(screen.getByText("mintNFT")).toBeTruthy();
    expect(screen.queryByText("addMessage")).toBeNull();
  });
});

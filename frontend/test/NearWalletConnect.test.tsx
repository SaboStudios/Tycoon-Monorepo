import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NearWalletContext } from "@/components/providers/near-wallet-provider";
import { NearWalletConnect } from "@/components/wallet/NearWalletConnect";
import { createMockNearWalletValue } from "@/test/near-wallet-mock";

function renderWithMock(value = createMockNearWalletValue()) {
  return render(
    <NearWalletContext.Provider value={value}>
      <NearWalletConnect />
    </NearWalletContext.Provider>,
  );
}

describe("NearWalletConnect", () => {
  it("shows connect when no NEAR account", () => {
    renderWithMock(
      createMockNearWalletValue({ accountId: null, ready: true }),
    );
    expect(screen.getByRole("button", { name: /connect near/i })).toBeTruthy();
  });

  it("shows truncated account and disconnect when connected", () => {
    renderWithMock(
      createMockNearWalletValue({
        accountId: "very-long-account.testnet",
        accounts: ["very-long-account.testnet"],
      }),
    );
    expect(
      screen.getByTitle("very-long-account.testnet"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /disconnect near/i }),
    ).toBeTruthy();
  });

  it("shows pending state for in-flight transaction", () => {
    renderWithMock(
      createMockNearWalletValue({
        accountId: "a.testnet",
        transactions: [
          {
            id: "1",
            phase: "pending",
            methodName: "addMessage",
            contractId: "guest-book.testnet",
          },
        ],
      }),
    );
    expect(screen.getByText(/transaction pending/i)).toBeTruthy();
    expect(screen.getByText(/addMessage/)).toBeTruthy();
  });

  it("links to explorer when hash is present", () => {
    renderWithMock(
      createMockNearWalletValue({
        accountId: "a.testnet",
        transactions: [
          {
            id: "1",
            phase: "confirmed",
            methodName: "addMessage",
            contractId: "guest-book.testnet",
            hash: "ABC123",
            explorerUrl:
              "https://explorer.testnet.near.org/transactions/ABC123",
          },
        ],
      }),
    );
    const link = screen.getByRole("link", { name: /view on explorer/i });
    expect(link.getAttribute("href")).toContain("explorer.testnet.near.org");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("invokes connect when clicking Connect NEAR", async () => {
    const connect = vi.fn();
    renderWithMock(createMockNearWalletValue({ connect }));
    screen.getByRole("button", { name: /connect near/i }).click();
    expect(connect).toHaveBeenCalledTimes(1);
  });
});

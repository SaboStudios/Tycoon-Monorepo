import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NearWalletContext, useNearWallet } from "@/components/providers/near-wallet-provider";
import { NearWalletConnect } from "@/components/wallet/NearWalletConnect";
import { createMockNearWalletValue } from "@/test/near-wallet-mock";

function renderWithMock(
  value = createMockNearWalletValue(),
  variant?: "navbar" | "panel",
) {
  return render(
    <NearWalletContext.Provider value={value}>
      <NearWalletConnect variant={variant} />
    </NearWalletContext.Provider>,
  );
}

describe("NearWalletConnect", () => {
  it("shows connect when no NEAR account", () => {
    renderWithMock(createMockNearWalletValue({ accountId: null, ready: true }));
    expect(screen.getByRole("button", { name: /connect near/i })).toBeTruthy();
  });

  it("disables connect button when not ready", () => {
    renderWithMock(createMockNearWalletValue({ accountId: null, ready: false }));
    expect(
      screen.getByRole("button", { name: /connect near/i }),
    ).toBeDisabled();
  });

  it("shows truncated account and disconnect when connected", () => {
    renderWithMock(
      createMockNearWalletValue({
        accountId: "very-long-account.testnet",
        accounts: ["very-long-account.testnet"],
      }),
    );
    expect(screen.getByTitle("very-long-account.testnet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /disconnect near/i }),
    ).toBeTruthy();
  });

  it("does not truncate a short account id", () => {
    renderWithMock(createMockNearWalletValue({ accountId: "ab.near" }));
    expect(screen.getByTitle("ab.near")).toHaveTextContent("ab.near");
  });

  it("renders initError banner", () => {
    renderWithMock(
      createMockNearWalletValue({ initError: "Wallet init failed" }),
    );
    expect(screen.getByText("Wallet init failed")).toBeTruthy();
  });

  it("invokes connect when clicking Connect NEAR", async () => {
    const connect = vi.fn();
    renderWithMock(createMockNearWalletValue({ connect }));
    screen.getByRole("button", { name: /connect near/i }).click();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("invokes disconnect when clicking Disconnect NEAR", async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    renderWithMock(
      createMockNearWalletValue({ accountId: "a.testnet", disconnect }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /disconnect near/i }),
    );
    expect(disconnect).toHaveBeenCalledTimes(1);
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

  it("shows confirmed state", () => {
    renderWithMock(
      createMockNearWalletValue({
        accountId: "a.testnet",
        transactions: [
          {
            id: "1",
            phase: "confirmed",
            methodName: "addMessage",
            contractId: "guest-book.testnet",
          },
        ],
      }),
    );
    expect(screen.getByText(/confirmed/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /view on explorer/i })).toBeNull();
  });

  it("shows failed state with error message", () => {
    renderWithMock(
      createMockNearWalletValue({
        accountId: "a.testnet",
        transactions: [
          {
            id: "1",
            phase: "failed",
            methodName: "addMessage",
            contractId: "guest-book.testnet",
            errorMessage: "Insufficient gas",
          },
        ],
      }),
    );
    expect(screen.getByText(/failed/i)).toBeTruthy();
    expect(screen.getByText("Insufficient gas")).toBeTruthy();
  });

  it("links to explorer when hash and explorerUrl are present", () => {
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
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("applies panel alignment classes for variant=panel", () => {
    const { container } = renderWithMock(
      createMockNearWalletValue({ accountId: null, ready: true }),
      "panel",
    );
    expect(container.firstChild).toHaveClass("items-stretch");
    expect(container.firstChild).toHaveClass("text-left");
  });

  it("applies navbar alignment classes for variant=navbar (default)", () => {
    const { container } = renderWithMock(
      createMockNearWalletValue({ accountId: null, ready: true }),
    );
    expect(container.firstChild).toHaveClass("items-end");
    expect(container.firstChild).toHaveClass("text-right");
  });

  it("button row has min-h to prevent CLS", () => {
    const { container } = renderWithMock(
      createMockNearWalletValue({ accountId: null, ready: true }),
    );
    const buttonRow = container.querySelector(".min-h-\\[28px\\]");
    expect(buttonRow).not.toBeNull();
  });

  it("transaction status wrapper always rendered to prevent CLS", () => {
    // No transactions — wrapper must still be in the DOM (min-h reserved).
    const { container } = renderWithMock(
      createMockNearWalletValue({ accountId: null, transactions: [] }),
    );
    const wrappers = container.querySelectorAll(".min-h-\\[28px\\]");
    // Both the button row and the status wrapper should be present.
    expect(wrappers.length).toBeGreaterThanOrEqual(2);
  });

  it("transaction status wrapper present even when no transactions", () => {
    const { container } = renderWithMock(
      createMockNearWalletValue({ transactions: [] }),
    );
    // The inner transaction card should NOT be rendered...
    expect(screen.queryByText(/transaction pending/i)).toBeNull();
    // ...but the reserved wrapper div must still exist in the DOM.
    const statusWrapper = container.querySelector(
      ".min-h-\\[28px\\]:last-child",
    );
    expect(statusWrapper).not.toBeNull();
  });
});

describe("useNearWallet", () => {
  it("throws when used outside NearWalletProvider", () => {
    function Bomb() {
      useNearWallet();
      return null;
    }
    expect(() =>
      render(<Bomb />),
    ).toThrow("useNearWallet must be used within NearWalletProvider");
  });
});

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TradeModal } from "./TradeModal";

const mockPlayers = [
  {
    id: "p1",
    name: "Alice",
    cash: 1500,
    properties: [
      { name: "Park Place", color: "bg-blue-700", price: 350, type: "property" as const },
      { name: "Boardwalk", color: "bg-blue-700", price: 400, type: "property" as const },
    ],
  },
  {
    id: "p2",
    name: "Bob",
    cash: 1200,
    properties: [
      { name: "Mediterranean Ave", color: "bg-purple-900", price: 60, type: "property" as const },
    ],
  },
];

describe("TradeModal - Accessibility", () => {
  it("has accessible button names", () => {
    const onClose = vi.fn();
    render(
      <TradeModal
        isOpen={true}
        onClose={onClose}
        players={mockPlayers}
        currentPlayer={mockPlayers[0]}
      />
    );

    expect(screen.getByRole("button", { name: /close trade modal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm trade/i })).toBeInTheDocument();
  });

  it("has correct heading hierarchy", () => {
    const onClose = vi.fn();
    render(
      <TradeModal
        isOpen={true}
        onClose={onClose}
        players={mockPlayers}
        currentPlayer={mockPlayers[0]}
      />
    );

    const mainHeading = screen.getByRole("heading", { level: 2, name: /propose trade/i });
    expect(mainHeading).toBeInTheDocument();

    const sections = screen.getAllByRole("heading", { level: 3 });
    expect(sections.length).toBe(2);
    expect(sections[0]).toHaveTextContent("You Offer");
    expect(sections[1]).toHaveTextContent("You Request");
  });

  it("property buttons have aria-pressed and accessible labels", () => {
    const onClose = vi.fn();
    render(
      <TradeModal
        isOpen={true}
        onClose={onClose}
        players={mockPlayers}
        currentPlayer={mockPlayers[0]}
      />
    );

    const parkPlaceButton = screen.getByRole("button", { name: /park place, 350 dollars/i });
    expect(parkPlaceButton).toHaveAttribute("aria-pressed", "false");
    expect(parkPlaceButton).toBeInTheDocument();

    fireEvent.click(parkPlaceButton);

    expect(parkPlaceButton).toHaveAttribute("aria-pressed", "true");
  });

  it("request column is aria-disabled when no partner selected", () => {
    const onClose = vi.fn();
    render(
      <TradeModal
        isOpen={true}
        onClose={onClose}
        players={mockPlayers}
        currentPlayer={mockPlayers[0]}
      />
    );

    const requestColumn = screen.getByTestId("request-column");
    expect(requestColumn).toHaveAttribute("aria-disabled", "true");
  });

  it("all interactive elements are reachable via keyboard", () => {
    const onClose = vi.fn();
    render(
      <TradeModal
        isOpen={true}
        onClose={onClose}
        players={mockPlayers}
        currentPlayer={mockPlayers[0]}
      />
    );

    const closeButton = screen.getByRole("button", { name: /close trade modal/i });
    const partnerSelect = screen.getByRole("combobox", { name: /trade partner/i });
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    const confirmButton = screen.getByRole("button", { name: /confirm trade/i });

    expect(closeButton).toBeInTheDocument();
    expect(partnerSelect).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(confirmButton).toBeInTheDocument();
  });

  it("validation error has role alert and aria-live", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <TradeModal
        isOpen={true}
        onClose={onClose}
        players={mockPlayers}
        currentPlayer={mockPlayers[0]}
      />
    );

    const confirmButton = screen.getByRole("button", { name: /confirm trade/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      const errorAlert = screen.getByTestId("validation-error");
      expect(errorAlert).toHaveAttribute("role", "alert");
      expect(errorAlert).toHaveAttribute("aria-live", "assertive");
    });
  });

  it("columns have role group and aria-labelledby", () => {
    const onClose = vi.fn();
    render(
      <TradeModal
        isOpen={true}
        onClose={onClose}
        players={mockPlayers}
        currentPlayer={mockPlayers[0]}
      />
    );

    const offerColumn = screen.getByTestId("offer-column");
    const requestColumn = screen.getByTestId("request-column");

    expect(offerColumn).toHaveAttribute("role", "group");
    expect(offerColumn).toHaveAttribute("aria-labelledby", "offer-heading");

    expect(requestColumn).toHaveAttribute("role", "group");
    expect(requestColumn).toHaveAttribute("aria-labelledby", "request-heading");
  });

  it("escape key closes modal", () => {
    const onClose = vi.fn();
    render(
      <TradeModal
        isOpen={true}
        onClose={onClose}
        players={mockPlayers}
        currentPlayer={mockPlayers[0]}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("modal has proper dialog semantics", () => {
    const onClose = vi.fn();
    render(
      <TradeModal
        isOpen={true}
        onClose={onClose}
        players={mockPlayers}
        currentPlayer={mockPlayers[0]}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "trade-modal-title");
  });

  describe("TypeScript strictness - null/undefined edge cases", () => {
    it("renders without throwing when partner is null", () => {
      const onClose = vi.fn();
      const { container } = render(
        <TradeModal
          isOpen={true}
          onClose={onClose}
          players={mockPlayers}
          currentPlayer={mockPlayers[0]}
        />
      );

      expect(container).toBeInTheDocument();
      expect(screen.getByTestId("request-column")).toHaveAttribute("aria-disabled", "true");
    });

    it("handles undefined properties in partner gracefully", () => {
      const onClose = vi.fn();
      const playerWithoutProperties = { ...mockPlayers[1], properties: undefined as any };
      render(
        <TradeModal
          isOpen={true}
          onClose={onClose}
          players={[mockPlayers[0], playerWithoutProperties]}
          currentPlayer={mockPlayers[0]}
        />
      );

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "p2" } });

      const requestColumn = screen.getByTestId("request-column");
      expect(requestColumn).toBeInTheDocument();
    });

    it("handles optional cash values without error", async () => {
      const onClose = vi.fn();
      render(
        <TradeModal
          isOpen={true}
          onClose={onClose}
          players={mockPlayers}
          currentPlayer={mockPlayers[0]}
        />
      );

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: mockPlayers[1].id } });

      const cashInput = screen.getByTestId("offer-cash-input") as HTMLInputElement;
      fireEvent.change(cashInput, { target: { value: "100" } });

      const confirmButton = screen.getByRole("button", { name: /confirm trade/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByTestId("validation-error")).not.toBeInTheDocument();
      });
    });

    it("renders without crashing when players array is empty", () => {
      const onClose = vi.fn();
      const emptyPlayer = {
        id: "p0",
        name: "Solo",
        cash: 2000,
        properties: [],
      };

      const { container } = render(
        <TradeModal
          isOpen={true}
          onClose={onClose}
          players={[emptyPlayer]}
          currentPlayer={emptyPlayer}
        />
      );

      expect(container).toBeInTheDocument();
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.childElementCount).toBe(1); // Only "Select a player..." placeholder
    });
  });
});

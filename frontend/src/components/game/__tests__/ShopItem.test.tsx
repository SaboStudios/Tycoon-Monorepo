import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, describe, vi } from "vitest";
import { ShopItem, ShopItemData } from "../ShopItem";

describe("ShopItem", () => {
  const baseItem: ShopItemData = {
    id: 1,
    name: "Test Item",
    description: "A test item description",
    price: "100.00",
    type: "skin",
    currency: "USD",
    icon: "🎁",
    rarity: "rare",
  };

  describe("Rendering", () => {
    test("renders item name and description", () => {
      render(<ShopItem {...baseItem} />);
      expect(screen.getByText("Test Item")).toBeInTheDocument();
      expect(screen.getByText("A test item description")).toBeInTheDocument();
    });

    test("renders the icon", () => {
      render(<ShopItem {...baseItem} />);
      const icon = screen.getByText("🎁");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });

    test("renders formatted price with $ prefix", () => {
      render(<ShopItem {...baseItem} />);
      // Price is displayed with aria-hidden
      const priceEl = screen.getByText("$100.00");
      expect(priceEl).toBeInTheDocument();
    });

    test("renders rarity badge for non-common rarities", () => {
      render(<ShopItem {...baseItem} rarity="rare" />);
      expect(screen.getByText("rare")).toBeInTheDocument();
    });

    test("does not render rarity badge for common rarity", () => {
      render(<ShopItem {...baseItem} rarity="common" />);
      expect(screen.queryByText("common")).not.toBeInTheDocument();
    });

    test("renders buy button with accessible label", () => {
      render(<ShopItem {...baseItem} />);
      const button = screen.getByRole("button", { name: /buy test item/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe("Item Interactions", () => {
    test("calls onPurchase with item id when buy button is clicked", () => {
      const onPurchase = vi.fn();
      render(<ShopItem {...baseItem} onPurchase={onPurchase} />);
      fireEvent.click(screen.getByTestId("shop-item-buy-1"));
      expect(onPurchase).toHaveBeenCalledWith("1");
    });

    test("buy button is disabled when disabled prop is true", () => {
      render(<ShopItem {...baseItem} disabled={true} />);
      const button = screen.getByTestId("shop-item-buy-1");
      expect(button).toBeDisabled();
    });

    test("does not call onPurchase when disabled button is clicked", () => {
      const onPurchase = vi.fn();
      render(<ShopItem {...baseItem} disabled={true} onPurchase={onPurchase} />);
      fireEvent.click(screen.getByTestId("shop-item-buy-1"));
      expect(onPurchase).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    test("card has accessible label with name, rarity, and price", () => {
      render(<ShopItem {...baseItem} />);
      expect(
        screen.getByLabelText(/test item.*rare.*100\.00/i),
      ).toBeInTheDocument();
    });

    test("card has correct test id", () => {
      render(<ShopItem {...baseItem} />);
      expect(screen.getByTestId("shop-item-1")).toBeInTheDocument();
    });

    test("card is focusable with correct tabIndex", () => {
      render(<ShopItem {...baseItem} tabIndex={0} />);
      const card = screen.getByTestId("shop-item-1");
      expect(card).toHaveAttribute("tabindex", "0");
    });

    test("card supports ref forwarding", () => {
      const ref = { current: null as HTMLDivElement | null };
      render(
        <ShopItem
          {...baseItem}
          itemRef={(el) => {
            ref.current = el;
          }}
        />,
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("Price Formats", () => {
    test("renders price from string", () => {
      render(<ShopItem {...baseItem} price="50.50" />);
      expect(screen.getByText("$50.50")).toBeInTheDocument();
    });

    test("renders price from number", () => {
      render(<ShopItem {...baseItem} price={75.99} />);
      expect(screen.getByText("$75.99")).toBeInTheDocument();
    });

    test("formats integer price to two decimals", () => {
      render(<ShopItem {...baseItem} price={10} />);
      expect(screen.getByText("$10.00")).toBeInTheDocument();
    });

    test("handles NaN price gracefully", () => {
      render(<ShopItem {...baseItem} price={NaN} />);
      expect(screen.getByText("$0.00")).toBeInTheDocument();
    });

    test("handles invalid string price gracefully", () => {
      render(<ShopItem {...baseItem} price="not-a-number" />);
      expect(screen.getByText("$0.00")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    test("renders with null description", () => {
      render(<ShopItem {...baseItem} description={null} />);
      // The card should still render without the description text
      expect(screen.getByTestId("shop-item-1")).toBeInTheDocument();
    });

    test("uses default icon when none provided", () => {
      render(<ShopItem {...baseItem} icon={undefined} />);
      const icon = screen.getByText("🎁");
      expect(icon).toBeInTheDocument();
    });

    test("defaults to common rarity when not provided", () => {
      const { container } = render(
        <ShopItem {...baseItem} rarity={undefined} />,
      );
      const card = container.querySelector("[data-testid='shop-item-1']");
      expect(card).toBeInTheDocument();
    });
  });
});

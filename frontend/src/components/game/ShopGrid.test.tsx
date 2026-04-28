import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, describe, vi, beforeEach } from "vitest";
import { ShopGrid } from "./ShopGrid";
import { ShopItemData } from "./ShopItem";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

import { track } from "@/lib/analytics";
const mockTrack = vi.mocked(track);

beforeEach(() => mockTrack.mockClear());

describe("ShopGrid", () => {
  const mockItems: ShopItemData[] = [
    {
      id: 1,
      name: "Golden House",
      description: "Upgrade your property",
      price: "100.00",
      type: "skin",
      currency: "USD",
      active: true,
      icon: "🏠",
      rarity: "rare",
    },
    {
      id: 2,
      name: "Lucky Dice",
      description: "Increase your luck",
      price: "50.00",
      type: "dice",
      currency: "USD",
      active: true,
      icon: "🎲",
      rarity: "common",
    },
    {
      id: 3,
      name: "Legendary Card",
      description: "Rare collectible",
      price: "500.00",
      type: "card",
      currency: "USD",
      active: true,
      icon: "🎴",
      rarity: "legendary",
    },
  ];

  describe("Loading State", () => {
    test("renders skeleton grid when isLoading is true", () => {
      render(<ShopGrid isLoading={true} />);
      expect(screen.getByTestId("shop-grid-loading")).toBeInTheDocument();
      expect(screen.getAllByTestId("shop-grid-skeleton-card").length).toBeGreaterThan(0);
    });

    test("does not render items when loading", () => {
      render(<ShopGrid items={mockItems} isLoading={true} />);
      expect(screen.queryByTestId("shop-grid-items")).not.toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    test("renders error message when error prop is provided", () => {
      const errorMessage = "Failed to fetch items from server";
      render(<ShopGrid error={errorMessage} />);

      expect(screen.getByTestId("shop-grid-error")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Failed to load shop")).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    test("renders retry button when onRetry is provided", () => {
      const onRetry = vi.fn();
      render(<ShopGrid error="Network error" onRetry={onRetry} />);

      const retryButton = screen.getByTestId("shop-grid-retry-button");
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalledOnce();
    });

    test("does not render retry button when onRetry is not provided", () => {
      render(<ShopGrid error="Network error" />);
      expect(screen.queryByTestId("shop-grid-retry-button")).not.toBeInTheDocument();
    });

    test("does not render items when error is present", () => {
      render(<ShopGrid items={mockItems} error="Error occurred" />);
      expect(screen.queryByTestId("shop-grid-items")).not.toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    test("renders empty state when items array is empty", () => {
      render(<ShopGrid items={[]} />);

      expect(screen.getByTestId("shop-grid-empty")).toBeInTheDocument();
      expect(screen.getByText("No items available")).toBeInTheDocument();
      expect(
        screen.getByText("Check back later for new shop items.")
      ).toBeInTheDocument();
    });

    test("renders empty state when items prop is not provided", () => {
      render(<ShopGrid />);
      expect(screen.getByTestId("shop-grid-empty")).toBeInTheDocument();
    });

    test("does not render items when array is empty", () => {
      render(<ShopGrid items={[]} />);
      expect(screen.queryByTestId("shop-grid-items")).not.toBeInTheDocument();
    });
  });

  describe("Items Grid", () => {
    test("renders all items when data is provided", () => {
      render(<ShopGrid items={mockItems} />);

      expect(screen.getByTestId("shop-grid-items")).toBeInTheDocument();
      mockItems.forEach((item) => {
        expect(screen.getByTestId(`shop-item-${item.id}`)).toBeInTheDocument();
        expect(screen.getByText(item.name)).toBeInTheDocument();
      });
    });

    test("renders correct number of items", () => {
      render(<ShopGrid items={mockItems} />);
      const items = screen.getAllByTestId(/^shop-item-\d+$/);
      expect(items).toHaveLength(mockItems.length);
    });

    test("calls onPurchase when buy button is clicked", () => {
      const onPurchase = vi.fn();
      render(<ShopGrid items={mockItems} onPurchase={onPurchase} />);

      const buyButton = screen.getByTestId("shop-item-buy-1");
      fireEvent.click(buyButton);

      expect(onPurchase).toHaveBeenCalledWith("1");
    });

    test("calls onPurchase for each item independently", () => {
      const onPurchase = vi.fn();
      render(<ShopGrid items={mockItems} onPurchase={onPurchase} />);

      fireEvent.click(screen.getByTestId("shop-item-buy-1"));
      fireEvent.click(screen.getByTestId("shop-item-buy-2"));

      expect(onPurchase).toHaveBeenCalledTimes(2);
      expect(onPurchase).toHaveBeenNthCalledWith(1, "1");
      expect(onPurchase).toHaveBeenNthCalledWith(2, "2");
    });
  });

  describe("Grid Columns", () => {
    test("applies correct grid class for 2 columns", () => {
      const { container } = render(
        <ShopGrid items={mockItems} columns={2} />
      );
      const grid = container.querySelector("[data-testid='shop-grid-items']");
      expect(grid).toHaveClass("grid-cols-1", "sm:grid-cols-2");
    });

    test("applies correct grid class for 3 columns (default)", () => {
      const { container } = render(
        <ShopGrid items={mockItems} columns={3} />
      );
      const grid = container.querySelector("[data-testid='shop-grid-items']");
      expect(grid).toHaveClass(
        "grid-cols-1",
        "sm:grid-cols-2",
        "lg:grid-cols-3"
      );
    });

    test("applies correct grid class for 4 columns", () => {
      const { container } = render(
        <ShopGrid items={mockItems} columns={4} />
      );
      const grid = container.querySelector("[data-testid='shop-grid-items']");
      expect(grid).toHaveClass(
        "grid-cols-1",
        "sm:grid-cols-2",
        "lg:grid-cols-3",
        "xl:grid-cols-4"
      );
    });
  });

  describe("State Priority", () => {
    test("shows loading state over items", () => {
      render(<ShopGrid items={mockItems} isLoading={true} />);
      expect(screen.getByTestId("shop-grid-loading")).toBeInTheDocument();
      expect(screen.queryByTestId("shop-grid-items")).not.toBeInTheDocument();
    });

    test("shows error state over items", () => {
      render(<ShopGrid items={mockItems} error="Error" />);
      expect(screen.getByTestId("shop-grid-error")).toBeInTheDocument();
      expect(screen.queryByTestId("shop-grid-items")).not.toBeInTheDocument();
    });

    test("shows error state over loading state", () => {
      render(<ShopGrid isLoading={true} error="Error" />);
      expect(screen.getByTestId("shop-grid-error")).toBeInTheDocument();
      expect(screen.queryByTestId("shop-grid-loading")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    test("grid has list role and accessible label", () => {
      render(<ShopGrid items={mockItems} />);
      const list = screen.getByRole("list", { name: /shop items/i });
      expect(list).toBeInTheDocument();
    });

    test("each item is wrapped in a listitem", () => {
      render(<ShopGrid items={mockItems} />);
      const listitems = screen.getAllByRole("listitem");
      expect(listitems).toHaveLength(mockItems.length);
    });

    test("each shop item card has an accessible label including name, rarity, and price", () => {
      render(<ShopGrid items={mockItems} />);
      // Golden House — rare — $100.00
      expect(
        screen.getByLabelText(/golden house.*rare.*100\.00/i)
      ).toBeInTheDocument();
      // Lucky Dice — common — $50.00
      expect(
        screen.getByLabelText(/lucky dice.*common.*50\.00/i)
      ).toBeInTheDocument();
    });

    test("buy button has accessible label including item name", () => {
      render(<ShopGrid items={mockItems} />);
      expect(screen.getByRole("button", { name: /buy golden house/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /buy lucky dice/i })).toBeInTheDocument();
    });

    test("error state has alert role", () => {
      render(<ShopGrid error="Error occurred" />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    test("loading state has aria-busy and aria-label", () => {
      render(<ShopGrid isLoading={true} />);
      const loading = screen.getByTestId("shop-grid-loading");
      expect(loading).toHaveAttribute("aria-busy", "true");
      expect(loading).toHaveAttribute("aria-label", "Loading shop items");
    });

    test("live region is present in all states", () => {
      const { rerender } = render(<ShopGrid isLoading={true} />);
      expect(screen.getByTestId("shop-grid-live-region")).toBeInTheDocument();

      rerender(<ShopGrid error="oops" />);
      expect(screen.getByTestId("shop-grid-live-region")).toBeInTheDocument();

      rerender(<ShopGrid items={[]} />);
      expect(screen.getByTestId("shop-grid-live-region")).toBeInTheDocument();

      rerender(<ShopGrid items={mockItems} />);
      expect(screen.getByTestId("shop-grid-live-region")).toBeInTheDocument();
    });

    test("live region announces loading state", () => {
      render(<ShopGrid isLoading={true} />);
      expect(screen.getByTestId("shop-grid-live-region")).toHaveTextContent(
        "Loading shop items…"
      );
    });

    test("live region announces error state", () => {
      render(<ShopGrid error="Network failure" />);
      expect(screen.getByTestId("shop-grid-live-region")).toHaveTextContent(
        /error loading shop.*network failure/i
      );
    });

    test("live region announces empty state", () => {
      render(<ShopGrid items={[]} />);
      expect(screen.getByTestId("shop-grid-live-region")).toHaveTextContent(
        "No shop items available."
      );
    });

    test("live region announces item count when items load", () => {
      render(<ShopGrid items={mockItems} />);
      expect(screen.getByTestId("shop-grid-live-region")).toHaveTextContent(
        `${mockItems.length} shop items loaded.`
      );
    });

    test("live region has role=status and aria-live=polite", () => {
      render(<ShopGrid items={mockItems} />);
      const region = screen.getByTestId("shop-grid-live-region");
      expect(region).toHaveAttribute("role", "status");
      expect(region).toHaveAttribute("aria-live", "polite");
      expect(region).toHaveAttribute("aria-atomic", "true");
    });
  });

  describe("Keyboard Navigation", () => {
    test("first item has tabIndex=0, others have tabIndex=-1", () => {
      render(<ShopGrid items={mockItems} />);
      const cards = screen.getAllByTestId(/^shop-item-\d+$/);
      expect(cards[0]).toHaveAttribute("tabindex", "0");
      expect(cards[1]).toHaveAttribute("tabindex", "-1");
      expect(cards[2]).toHaveAttribute("tabindex", "-1");
    });

    test("ArrowRight moves focus to next item", () => {
      render(<ShopGrid items={mockItems} columns={3} />);
      const list = screen.getByRole("list", { name: /shop items/i });
      const cards = screen.getAllByTestId(/^shop-item-\d+$/);

      // Focus the first card so the event target is meaningful
      cards[0].focus();
      fireEvent.keyDown(list, { key: "ArrowRight" });

      expect(cards[1]).toHaveAttribute("tabindex", "0");
      expect(cards[0]).toHaveAttribute("tabindex", "-1");
    });

    test("ArrowLeft moves focus to previous item", () => {
      render(<ShopGrid items={mockItems} columns={3} />);
      const list = screen.getByRole("list", { name: /shop items/i });
      const cards = screen.getAllByTestId(/^shop-item-\d+$/);

      // Move to index 1 first
      cards[0].focus();
      fireEvent.keyDown(list, { key: "ArrowRight" });
      // Now move back
      fireEvent.keyDown(list, { key: "ArrowLeft" });

      expect(cards[0]).toHaveAttribute("tabindex", "0");
    });

    test("ArrowDown moves focus down by column count", () => {
      // 3 items in a 3-column grid: ArrowDown from index 0 would go to index 3 (clamped to 2)
      render(<ShopGrid items={mockItems} columns={3} />);
      const list = screen.getByRole("list", { name: /shop items/i });
      const cards = screen.getAllByTestId(/^shop-item-\d+$/);

      cards[0].focus();
      fireEvent.keyDown(list, { key: "ArrowDown" });

      // 0 + 3 = 3, clamped to 2 (last item)
      expect(cards[2]).toHaveAttribute("tabindex", "0");
    });

    test("ArrowUp moves focus up by column count", () => {
      render(<ShopGrid items={mockItems} columns={3} />);
      const list = screen.getByRole("list", { name: /shop items/i });
      const cards = screen.getAllByTestId(/^shop-item-\d+$/);

      // Move to last item first
      cards[0].focus();
      fireEvent.keyDown(list, { key: "End" });
      // Now move up
      fireEvent.keyDown(list, { key: "ArrowUp" });

      // 2 - 3 = -1, clamped to 0
      expect(cards[0]).toHaveAttribute("tabindex", "0");
    });

    test("Home key moves focus to first item", () => {
      render(<ShopGrid items={mockItems} columns={3} />);
      const list = screen.getByRole("list", { name: /shop items/i });
      const cards = screen.getAllByTestId(/^shop-item-\d+$/);

      cards[0].focus();
      fireEvent.keyDown(list, { key: "ArrowRight" });
      fireEvent.keyDown(list, { key: "Home" });

      expect(cards[0]).toHaveAttribute("tabindex", "0");
    });

    test("End key moves focus to last item", () => {
      render(<ShopGrid items={mockItems} columns={3} />);
      const list = screen.getByRole("list", { name: /shop items/i });
      const cards = screen.getAllByTestId(/^shop-item-\d+$/);

      cards[0].focus();
      fireEvent.keyDown(list, { key: "End" });

      expect(cards[cards.length - 1]).toHaveAttribute("tabindex", "0");
    });

    test("ArrowRight does not go past last item", () => {
      render(<ShopGrid items={mockItems} columns={3} />);
      const list = screen.getByRole("list", { name: /shop items/i });
      const cards = screen.getAllByTestId(/^shop-item-\d+$/);

      cards[0].focus();
      // Press ArrowRight many times
      for (let i = 0; i < 10; i++) {
        fireEvent.keyDown(list, { key: "ArrowRight" });
      }

      expect(cards[cards.length - 1]).toHaveAttribute("tabindex", "0");
    });

    test("ArrowLeft does not go before first item", () => {
      render(<ShopGrid items={mockItems} columns={3} />);
      const list = screen.getByRole("list", { name: /shop items/i });
      const cards = screen.getAllByTestId(/^shop-item-\d+$/);

      cards[0].focus();
      for (let i = 0; i < 10; i++) {
        fireEvent.keyDown(list, { key: "ArrowLeft" });
      }

      expect(cards[0]).toHaveAttribute("tabindex", "0");
    });
  });

  describe("Custom Styling", () => {
    test("applies custom className", () => {
      const { container } = render(
        <ShopGrid items={mockItems} className="custom-class" />
      );
      const grid = container.querySelector("[data-testid='shop-grid-items']");
      expect(grid).toHaveClass("custom-class");
    });
  });

  describe("Telemetry", () => {
    test("fires shop_grid_viewed when items render", () => {
      render(<ShopGrid items={mockItems} />);
      expect(mockTrack).toHaveBeenCalledWith("shop_grid_viewed", {
        route: "/shop",
        item_count: mockItems.length,
        source: "shop_page",
      });
    });

    test("fires shop_grid_viewed with custom telemetrySource", () => {
      render(<ShopGrid items={mockItems} telemetrySource="game_overlay" />);
      expect(mockTrack).toHaveBeenCalledWith("shop_grid_viewed", expect.objectContaining({ source: "game_overlay" }));
    });

    test("does not fire shop_grid_viewed while loading", () => {
      render(<ShopGrid items={mockItems} isLoading={true} />);
      expect(mockTrack).not.toHaveBeenCalledWith("shop_grid_viewed", expect.anything());
    });

    test("does not fire shop_grid_viewed on error", () => {
      render(<ShopGrid items={mockItems} error="oops" />);
      expect(mockTrack).not.toHaveBeenCalledWith("shop_grid_viewed", expect.anything());
    });

    test("fires shop_purchase_initiated with item data on buy click", () => {
      const onPurchase = vi.fn();
      render(<ShopGrid items={mockItems} onPurchase={onPurchase} />);
      mockTrack.mockClear();
      fireEvent.click(screen.getByTestId("shop-item-buy-1"));
      expect(mockTrack).toHaveBeenCalledWith("shop_purchase_initiated", {
        route: "/shop",
        item_id: "1",
        item_name: mockItems[0].name,
        item_category: mockItems[0].type,
        item_rarity: mockItems[0].rarity,
        currency: mockItems[0].currency,
        value: mockItems[0].price,
      });
    });

    test("still calls onPurchase after telemetry fires", () => {
      const onPurchase = vi.fn();
      render(<ShopGrid items={mockItems} onPurchase={onPurchase} />);
      fireEvent.click(screen.getByTestId("shop-item-buy-1"));
      expect(onPurchase).toHaveBeenCalledWith("1");
    });
  });
});

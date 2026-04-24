import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, describe, vi } from "vitest";
import { ShopGrid } from "./ShopGrid";
import { ShopItemData } from "./ShopItem";

describe("ShopGrid", () => {
  const mockItems: ShopItemData[] = [
    {
      id: "item-1",
      name: "Golden House",
      description: "Upgrade your property",
      price: 100,
      icon: "🏠",
      rarity: "rare",
    },
    {
      id: "item-2",
      name: "Lucky Dice",
      description: "Increase your luck",
      price: 50,
      icon: "🎲",
      rarity: "common",
    },
    {
      id: "item-3",
      name: "Legendary Card",
      description: "Rare collectible",
      price: 500,
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
      const items = screen.getAllByTestId(/^shop-item-item-/);
      expect(items).toHaveLength(mockItems.length);
    });

    test("calls onPurchase when buy button is clicked", () => {
      const onPurchase = vi.fn();
      render(<ShopGrid items={mockItems} onPurchase={onPurchase} />);

      const buyButton = screen.getByTestId("shop-item-buy-item-1");
      fireEvent.click(buyButton);

      expect(onPurchase).toHaveBeenCalledWith("item-1");
    });

    test("calls onPurchase for each item independently", () => {
      const onPurchase = vi.fn();
      render(<ShopGrid items={mockItems} onPurchase={onPurchase} />);

      fireEvent.click(screen.getByTestId("shop-item-buy-item-1"));
      fireEvent.click(screen.getByTestId("shop-item-buy-item-2"));

      expect(onPurchase).toHaveBeenCalledTimes(2);
      expect(onPurchase).toHaveBeenNthCalledWith(1, "item-1");
      expect(onPurchase).toHaveBeenNthCalledWith(2, "item-2");
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
    test("has proper ARIA labels and roles", () => {
      render(<ShopGrid items={mockItems} />);
      const grid = screen.getByRole("region", { name: /shop items/i });
      expect(grid).toBeInTheDocument();
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

  describe("CLS / LCP regression (SW-FE-020)", () => {
    test("skeleton grid uses same column classes as real grid to prevent layout shift", () => {
      const { container: loadingContainer } = render(
        <ShopGrid isLoading={true} columns={3} />
      );
      const { container: itemsContainer } = render(
        <ShopGrid items={mockItems} columns={3} />
      );

      const skeletonGrid = loadingContainer.querySelector("[data-testid='shop-grid-loading']");
      const itemsGrid = itemsContainer.querySelector("[data-testid='shop-grid-items']");

      // Both grids must share the same responsive column classes so the
      // transition from skeleton → real content causes zero layout shift.
      expect(skeletonGrid).toHaveClass("grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-3");
      expect(itemsGrid).toHaveClass("grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-3");
    });

    test("skeleton cards have min-h-[160px] to reserve vertical space", () => {
      const { container } = render(<ShopGrid isLoading={true} columns={2} />);
      const cards = container.querySelectorAll("[data-testid='shop-grid-skeleton-card']");
      expect(cards.length).toBeGreaterThan(0);
      cards.forEach((card) => {
        expect(card).toHaveClass("min-h-[160px]");
      });
    });

    test("skeleton card count matches columns × 2 rows", () => {
      const { container: c2 } = render(<ShopGrid isLoading={true} columns={2} />);
      const { container: c3 } = render(<ShopGrid isLoading={true} columns={3} />);
      const { container: c4 } = render(<ShopGrid isLoading={true} columns={4} />);

      expect(c2.querySelectorAll("[data-testid='shop-grid-skeleton-card']")).toHaveLength(4);
      expect(c3.querySelectorAll("[data-testid='shop-grid-skeleton-card']")).toHaveLength(6);
      expect(c4.querySelectorAll("[data-testid='shop-grid-skeleton-card']")).toHaveLength(8);
    });

    test("ShopItem card has min-h-[160px] to prevent CLS from image-less cards", () => {
      const { container } = render(<ShopGrid items={mockItems} />);
      const cards = container.querySelectorAll("[data-testid^='shop-item-']");
      expect(cards.length).toBeGreaterThan(0);
      cards.forEach((card) => {
        expect(card).toHaveClass("min-h-[160px]");
      });
    });
  });
});

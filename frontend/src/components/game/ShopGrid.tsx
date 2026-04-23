"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { AlertCircle, Package } from "lucide-react";
import { ShopItem, ShopItemData } from "./ShopItem";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useShopTelemetry } from "@/hooks/useShopTelemetry";

export interface ShopGridProps {
  items?: ShopItemData[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onPurchase?: (itemId: string) => void;
  className?: string;
  columns?: 2 | 3 | 4;
  /** Passed to telemetry `source` field — e.g. "shop_page", "game_overlay" */
  telemetrySource?: string;
}

/**
 * ShopGrid component with error and empty states.
 * Displays shop items in a responsive grid with loading, error, and empty state handling.
 * Follows Tycoon design patterns and accessibility standards.
 */
export const ShopGrid: React.FC<ShopGridProps> = ({
  items = [],
  isLoading = false,
  error = null,
  onRetry,
  onPurchase,
  className,
  columns = 3,
  telemetrySource = "shop_page",
}) => {
  const gridColsClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  const { trackGridViewed, trackItemImpression, trackPurchaseInitiated } =
    useShopTelemetry();

  // Fire shop_grid_viewed once when items become visible (not during loading/error).
  const trackedCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isLoading && !error && items.length > 0 && trackedCountRef.current !== items.length) {
      trackedCountRef.current = items.length;
      trackGridViewed(items.length, telemetrySource);
    }
  }, [isLoading, error, items, telemetrySource, trackGridViewed]);

  const handlePurchase = useCallback(
    (itemId: string) => {
      const item = items.find((i) => String(i.id) === itemId);
      if (item) {
        trackPurchaseInitiated({
          itemId,
          itemName: item.name,
          itemCategory: item.type,
          itemRarity: item.rarity,
          currency: item.currency,
          value: item.price,
        });
      }
      onPurchase?.(itemId);
    },
    [items, onPurchase, trackPurchaseInitiated],
  );

  // Error state (check first to take priority)
  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 gap-4 px-4"
        data-testid="shop-grid-error"
        role="alert"
      >
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-8 h-8 flex-shrink-0" aria-hidden />
          <div>
            <h3 className="font-semibold text-lg">Failed to load shop</h3>
            <p className="text-sm text-red-500 dark:text-red-300 mt-1">
              {error}
            </p>
          </div>
        </div>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="mt-4"
            data-testid="shop-grid-retry-button"
          >
            Try Again
          </Button>
        )}
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 gap-4"
        data-testid="shop-grid-loading"
      >
        <Spinner size="lg" />
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Loading shop items...
        </p>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 gap-4 px-4"
        data-testid="shop-grid-empty"
      >
        <Package className="w-12 h-12 text-gray-400 dark:text-gray-600" aria-hidden />
        <div className="text-center">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
            No items available
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Check back later for new shop items.
          </p>
        </div>
      </div>
    );
  }

  // Grid with items
  return (
    <div
      className={cn(
        "grid gap-4",
        gridColsClass[columns],
        className
      )}
      data-testid="shop-grid-items"
      role="region"
      aria-label="Shop items"
    >
      {items.map((item) => (
        <ShopItem
          key={item.id}
          {...item}
          onPurchase={handlePurchase}
        />
      ))}
    </div>
  );
};

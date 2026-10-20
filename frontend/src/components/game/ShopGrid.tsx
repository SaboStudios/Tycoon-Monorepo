"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { AlertCircle, Package } from "lucide-react";
import { ShopItem, ShopItemData } from "./ShopItem";
import { Skeleton } from "@/components/ui/skeleton";
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
  const gridColsClass = React.useMemo(() => ({
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  }), []);

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

  // Loading state — skeleton grid reserves the same dimensions as real cards (prevents CLS)
  if (isLoading) {
    return (
      <div
        className={cn("grid gap-4", gridColsClass[columns], className)}
        data-testid="shop-grid-loading"
        aria-busy="true"
        aria-label="Loading shop items"
      >
        {Array.from({ length: columns * 2 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 min-h-[160px] gap-3"
            data-testid="shop-grid-skeleton-card"
          >
            <div className="flex items-start justify-between">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-5 w-16 rounded" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <div className="mt-auto flex items-center justify-between">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          </div>
        ))}
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

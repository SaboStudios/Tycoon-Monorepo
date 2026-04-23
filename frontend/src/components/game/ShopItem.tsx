"use client";

import React from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ShopItemData {
  id: number | string;
  name: string;
  description: string | null;
  price: number | string;
  type?: string;
  currency?: string;
  active?: boolean;
  icon?: string;
  rarity?: string;
  onPurchase?: (itemId: string) => void;
  disabled?: boolean;
}

const rarityColors: Record<string, string> = {
  common: "border-gray-400 bg-gray-50 dark:bg-gray-900",
  rare: "border-blue-400 bg-blue-50 dark:bg-blue-900/20",
  epic: "border-purple-400 bg-purple-50 dark:bg-purple-900/20",
  legendary: "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20",
};

const rarityBadgeColors: Record<string, string> = {
  common: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
  rare: "bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-100",
  epic: "bg-purple-200 text-purple-800 dark:bg-purple-700 dark:text-purple-100",
  legendary: "bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100",
};

export const ShopItem: React.FC<ShopItemData> = ({
  id,
  name,
  description,
  price,
  icon = "🎁",
  rarity = "common",
  onPurchase,
  disabled = false,
}) => {
  const itemId = String(id);
  const displayPrice =
    typeof price === "string" ? parseFloat(price).toFixed(2) : price;

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border-2 p-4 transition-all duration-200",
        rarityColors[rarity] ?? rarityColors.common,
        disabled && "opacity-50 cursor-not-allowed"
      )}
      data-testid={`shop-item-${itemId}`}
    >
      {/* Icon and Rarity Badge */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl" aria-hidden>
          {icon}
        </span>
        {rarity && rarity !== "common" && (
          <span
            className={cn(
              "text-xs font-semibold px-2 py-1 rounded capitalize",
              rarityBadgeColors[rarity] ?? ""
            )}
          >
            {rarity}
          </span>
        )}
      </div>

      {/* Item Name */}
      <h3 className="font-bold text-sm mb-1 line-clamp-2">{name}</h3>

      {/* Description */}
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
        {description ?? ""}
      </p>

      {/* Price and Button */}
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="font-bold text-lg text-gray-900 dark:text-white">
          ${displayPrice}
        </span>
        <Button
          size="sm"
          variant={disabled ? "outline" : "default"}
          onClick={() => onPurchase?.(itemId)}
          disabled={disabled}
          className="gap-1"
          data-testid={`shop-item-buy-${itemId}`}
        >
          <ShoppingCart className="w-3 h-3" />
          <span className="hidden sm:inline">Buy</span>
        </Button>
      </div>
    </div>
  );
};

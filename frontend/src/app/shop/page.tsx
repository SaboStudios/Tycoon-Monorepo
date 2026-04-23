"use client";

import React, { useState, useCallback } from "react";
import { ShopGrid } from "@/components/game/ShopGrid";
import { ShopItemData } from "@/components/game/ShopItem";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";

const MOCK_SHOP_ITEMS: ShopItemData[] = [
  {
    id: "golden-house",
    name: "Golden House",
    description: "Upgrade your property with luxury",
    price: 250,
    icon: "🏠",
    rarity: "rare",
  },
  {
    id: "lucky-dice",
    name: "Lucky Dice",
    description: "Increase your chances of winning",
    price: 50,
    icon: "🎲",
    rarity: "common",
  },
  {
    id: "legendary-card",
    name: "Legendary Card",
    description: "Rare collectible with special powers",
    price: 500,
    icon: "🎴",
    rarity: "legendary",
  },
  {
    id: "mystery-box",
    name: "Mystery Box",
    description: "Contains random valuable items",
    price: 100,
    icon: "📦",
    rarity: "epic",
  },
  {
    id: "speed-boost",
    name: "Speed Boost",
    description: "Move faster around the board",
    price: 75,
    icon: "⚡",
    rarity: "rare",
  },
  {
    id: "fortune-wheel",
    name: "Fortune Wheel",
    description: "Spin for extra rewards",
    price: 150,
    icon: "🎡",
    rarity: "epic",
  },
];

export default function ShopPage(): React.JSX.Element {
  const [items, setItems] = useState<ShopItemData[]>(MOCK_SHOP_ITEMS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gridColumns, setGridColumns] = useState<2 | 3 | 4>(3);

  const handlePurchase = useCallback((itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item) {
      toast.success(`Purchased ${item.name} for $${item.price}!`);
    }
  }, [items]);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      setItems(MOCK_SHOP_ITEMS);
      setIsLoading(false);
      toast.success("Shop items loaded successfully!");
    }, 1500);
  }, []);

  const handleSimulateError = useCallback(() => {
    setError("Failed to connect to shop server. Please try again.");
    setItems([]);
  }, []);

  const handleSimulateEmpty = useCallback(() => {
    setError(null);
    setItems([]);
    toast.info("Shop is currently empty");
  }, []);

  const handleSimulateLoading = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      setItems(MOCK_SHOP_ITEMS);
      setIsLoading(false);
    }, 2000);
  }, []);

  const handleReset = useCallback(() => {
    setError(null);
    setIsLoading(false);
    setItems(MOCK_SHOP_ITEMS);
    toast.info("Shop reset to default state");
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010F10] to-[#0E1415] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold font-orbitron mb-2 text-[#00F0FF]">
            Tycoon Shop
          </h1>
          <p className="text-gray-400">
            Browse and purchase exclusive items to enhance your game
          </p>
        </div>

        {/* Demo Controls */}
        <div className="bg-[#0E1415] border border-[#003B3E] rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-[#00F0FF]">
            Demo Controls
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Button
              onClick={handleReset}
              variant="default"
              className="w-full"
              data-testid="demo-reset"
            >
              Show Items
            </Button>
            <Button
              onClick={handleSimulateLoading}
              variant="outline"
              className="w-full"
              data-testid="demo-loading"
            >
              Simulate Loading
            </Button>
            <Button
              onClick={handleSimulateError}
              variant="destructive"
              className="w-full"
              data-testid="demo-error"
            >
              Simulate Error
            </Button>
            <Button
              onClick={handleSimulateEmpty}
              variant="outline"
              className="w-full"
              data-testid="demo-empty"
            >
              Simulate Empty
            </Button>
          </div>

          {/* Grid Columns Control */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Grid Columns:</span>
            <div className="flex gap-2">
              {[2, 3, 4].map((cols) => (
                <Button
                  key={cols}
                  onClick={() => setGridColumns(cols as 2 | 3 | 4)}
                  variant={gridColumns === cols ? "default" : "outline"}
                  size="sm"
                  data-testid={`grid-cols-${cols}`}
                >
                  {cols}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Shop Grid */}
        <div className="bg-[#0E1415] border border-[#003B3E] rounded-lg p-6">
          <ShopGrid
            items={items}
            isLoading={isLoading}
            error={error}
            onRetry={handleRetry}
            onPurchase={handlePurchase}
            columns={gridColumns}
          />
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-[#0E1415] border border-[#003B3E] rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3 text-[#00F0FF]">
            Component Features
          </h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li>✓ Loading state with spinner</li>
            <li>✓ Error state with retry button</li>
            <li>✓ Empty state with helpful message</li>
            <li>✓ Responsive grid (2, 3, or 4 columns)</li>
            <li>✓ Item rarity levels (common, rare, epic, legendary)</li>
            <li>✓ Accessible with ARIA labels and roles</li>
            <li>✓ Fully tested with Vitest + React Testing Library</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

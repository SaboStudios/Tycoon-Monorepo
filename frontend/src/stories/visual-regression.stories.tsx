import React from 'react';
import WhatIsTycoon from '@/components/guest/WhatIsTycoon';
import { BoardSquare } from '@/components/game/BoardSquare';
import { ShopGrid } from '@/components/game/ShopGrid';
import { ShopItem } from '@/components/game/ShopItem';
import type { ShopItemData } from '@/components/game/ShopItem';
import { Skeleton } from '@/components/ui/skeleton';

export default {
  title: 'Visual Regression/Baseline',
};

const sampleItems: ShopItemData[] = [
  { id: 1, name: "Golden House", description: "Upgrade your property.", price: "100.00", type: "skin", currency: "USD", icon: "🏠", rarity: "rare" },
  { id: 2, name: "Lucky Dice", description: "Increase luck.", price: "50.00", type: "dice", currency: "USD", icon: "🎲", rarity: "common" },
  { id: 3, name: "Legendary Card", description: "Rare collectible.", price: "500.00", type: "card", currency: "USD", icon: "🎴", rarity: "legendary" },
  { id: 4, name: "Speed Boost", description: "Move 2 spaces.", price: "75.00", type: "dice", currency: "USD", icon: "⚡", rarity: "epic" },
];

export const MarketingLanding = () => (
  <div className="min-h-screen bg-[#010F10] p-8 text-white">
    <WhatIsTycoon />
  </div>
);

MarketingLanding.storyName = 'Marketing Landing (stable state)';

export const HUDBoardSquares = () => (
  <div className="min-h-screen bg-[#010F10] p-8 text-white">
    <h2 className="mb-4 text-2xl font-bold">HUD: Board Squares</h2>
    <div className="grid grid-cols-4 gap-4">
      <BoardSquare name="GO" type="go" position={0} color="bg-transparent" />
      <BoardSquare name="Income Tax" type="tax" position={4} color="bg-transparent" />
      <BoardSquare name="Community" type="community" position={2} color="bg-transparent" />
      <BoardSquare name="Jail" type="jail" position={10} color="bg-transparent" />
      <BoardSquare name="Park Place" type="property" position={37} color="bg-[#00008B]" />
    </div>
  </div>
);

HUDBoardSquares.storyName = 'HUD board squares (stable)';

// ─── Shop Grid Stories ─────────────────────────────────────────────────────────

export const ShopGridLoading = () => (
  <div className="min-h-screen bg-[#010F10] p-8 text-white">
    <h2 className="mb-4 text-xl font-bold">Shop Grid — Loading State</h2>
    <p className="mb-4 text-sm text-gray-400">
      Skeleton cards use min-h-[160px] to prevent CLS. Grid maintains same dimensions as populated grid.
    </p>
    <ShopGrid isLoading={true} columns={3} />
  </div>
);

ShopGridLoading.storyName = 'Shop Grid — Loading (CLS prevention)';

export const ShopGridError = () => (
  <div className="min-h-screen bg-[#010F10] p-8 text-white">
    <h2 className="mb-4 text-xl font-bold">Shop Grid — Error State</h2>
    <ShopGrid error="Failed to connect to shop server. Please try again." onRetry={() => {}} />
  </div>
);

ShopGridError.storyName = 'Shop Grid — Error State';

export const ShopGridEmpty = () => (
  <div className="min-h-screen bg-[#010F10] p-8 text-white">
    <h2 className="mb-4 text-xl font-bold">Shop Grid — Empty State</h2>
    <ShopGrid items={[]} />
  </div>
);

ShopGridEmpty.storyName = 'Shop Grid — Empty State';

export const ShopGridPopulated = () => (
  <div className="min-h-screen bg-[#010F10] p-8 text-white">
    <h2 className="mb-4 text-xl font-bold">Shop Grid — Populated</h2>
    <ShopGrid items={sampleItems} columns={3} onPurchase={(id) => console.log(id)} />
  </div>
);

ShopGridPopulated.storyName = 'Shop Grid — Populated';

export const ShopItemVariants = () => (
  <div className="min-h-screen bg-[#010F10] p-8 text-white">
    <h2 className="mb-4 text-xl font-bold">Shop Item — Rarity Variants</h2>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <ShopItem id="common" name="Wooden Token" description="Simple token." price="10" icon="🪵" rarity="common" />
      <ShopItem id="rare" name="Silver Badge" description="Shiny badge." price="100" icon="🥈" rarity="rare" />
      <ShopItem id="epic" name="Golden Trophy" description="Gleaming trophy." price="500" icon="🏆" rarity="epic" />
      <ShopItem id="legendary" name="Diamond Crown" description="Diamond crown." price="9999" icon="👑" rarity="legendary" />
    </div>
    <h2 className="mb-4 mt-8 text-xl font-bold">Shop Item — Disabled & No Description</h2>
    <div className="grid grid-cols-2 gap-4">
      <ShopItem id="disabled" name="Locked Item" description="Unavailable." price="0" icon="🔒" rarity="common" disabled />
      <ShopItem id="nodesc" name="Mystery Box" description={null} price="25" icon="📦" rarity="rare" />
    </div>
  </div>
);

ShopItemVariants.storyName = 'Shop Item — All Variants';

export const SkeletonCardDemo = () => (
  <div className="min-h-screen bg-[#010F10] p-8 text-white">
    <h2 className="mb-4 text-xl font-bold">Skeleton Card (CLS Prevention)</h2>
    <p className="mb-4 text-sm text-gray-400">
      The min-h-[160px] class ensures the skeleton reserves the same vertical space as a real card,
      preventing cumulative layout shift (CLS) when items load.
    </p>
    <div className="w-72">
      <div className="flex flex-col rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 min-h-[160px] gap-3">
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
    </div>
  </div>
);

SkeletonCardDemo.storyName = 'Skeleton Card — CLS Prevention';

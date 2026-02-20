"use client";

import GameShop from "@/components/shop/shop";
import GameShopMobile from "@/components/shop/shop-mobile";
import { useMediaQuery } from "@/components/useMediaQuery";


export default function ShopClient() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <main className="w-full">
      {isMobile ? <GameShopMobile /> : <GameShop />}
    </main>
  );
}
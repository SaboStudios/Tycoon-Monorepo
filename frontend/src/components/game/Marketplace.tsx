'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PurchaseModal } from '@/components/ui/purchase-modal';
import { toast } from 'react-toastify';
import { Spinner } from '@/components/ui/spinner';

interface ShopItem {
  id: number;
  name: string;
  description: string;
  type: 'skin' | 'board' | 'dice' | 'symbol' | 'theme' | 'card';
  price: string;
  currency: string;
  rarity: string;
  image_url?: string;
  is_owned?: boolean;
  stock_quantity?: number;
}

export function Marketplace() {
  const { t } = useTranslation('common');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    try {
      const typeParam = filter !== 'all' ? `&type=${filter}` : '';
      const response = await fetch(`/api/shop/items?page=1&limit=20${typeParam}`);
      if (!response.ok) throw new Error('Failed to fetch items');
      const result = await response.json();
      setItems(result.data);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Could not load marketplace items');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handlePurchaseClick = (item: ShopItem) => {
    if (item.is_owned) return;
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedItem) return;

    // Generate a unique idempotency key for this purchase attempt
    const idempotencyKey = crypto.randomUUID();
    
    // Capture previous state for rollback
    const previousItems = [...items];
    
    // Optimistically update the UI
    setItems(items.map(item => 
      item.id === selectedItem.id ? { ...item, is_owned: true } : item
    ));
    setIsModalOpen(false);

    try {
      const response = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          shop_item_id: selectedItem.id, 
          quantity: 1,
          idempotency_key: idempotencyKey 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Purchase failed');
      }

      toast.success(`${selectedItem.name} purchased successfully!`);
      // No need to fetchItems() here if we trust the optimistic update,
      // but we do it anyway to ensure full reconciliation with any server-side changes
      fetchItems(); 
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      // Rollback on failure
      setItems(previousItems);
      toast.error(message);
      // Re-open modal or handle as needed - here we just show the error toast
    }
  };

  const filters = [
    { id: 'all', label: t('shop.filter_all') },
    { id: 'skin', label: t('shop.filter_skins') },
    { id: 'board', label: t('shop.filter_boards') },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
        <h1 className="text-3xl font-bold tracking-tight text-white">{t('shop.title')}</h1>
        <div className="flex gap-2">
          {filters.map((f) => (
            <Button
              key={f.id}
              variant={filter === f.id ? 'default' : 'outline'}
              aria-current={filter === f.id ? 'page' : undefined}
              onClick={() => setFilter(f.id)}
              className={filter === f.id ? 'bg-cyan-500 text-black' : 'border-neutral-800 text-neutral-400'}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-neutral-500">
          No items found in this category.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <Card key={item.id} className="group overflow-hidden border-neutral-800 bg-neutral-900 transition-all hover:border-cyan-500/50 hover:shadow-[0_0_20px_-5px_rgba(0,240,255,0.3)]">
              <CardHeader className="p-0">
                <div 
                  className="aspect-square w-full bg-neutral-800/50 flex items-center justify-center relative overflow-hidden"
                  role="img"
                  aria-label={item.name}
                >
                   {/* Placeholder for item image */}
                   <div className="text-neutral-700 font-bold text-4xl uppercase tracking-widest group-hover:scale-110 transition-transform duration-500" aria-hidden="true">
                     {item.name.charAt(0)}
                   </div>
                   {item.is_owned && (
                     <div className="absolute top-2 right-2 bg-green-500/90 text-black text-xs font-bold px-2 py-1 rounded shadow-lg backdrop-blur-sm">
                       {t('shop.owned')}
                     </div>
                   )}
                   <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                     <span className="text-xs font-medium text-cyan-400 uppercase tracking-tighter">{item.rarity}</span>
                   </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <CardTitle className="text-lg text-white mb-1">{item.name}</CardTitle>
                <p className="text-sm text-neutral-400 line-clamp-2 min-h-[40px]">{item.description}</p>
              </CardContent>
              <CardFooter className="p-4 pt-0 flex items-center justify-between gap-4">
                <div className="text-xl font-bold text-cyan-400">
                  {item.price} {item.currency}
                </div>
                <Button
                  disabled={item.is_owned || (item.stock_quantity !== undefined && item.stock_quantity <= 0)}
                  onClick={() => handlePurchaseClick(item)}
                  aria-label={`${t('shop.purchase')} ${item.name}`}
                  className={`${item.is_owned ? 'bg-neutral-800 text-neutral-500' : 'bg-cyan-500 text-black hover:bg-cyan-400'} min-w-[100px]`}
                >
                  {item.is_owned ? t('shop.owned') : (item.stock_quantity !== undefined && item.stock_quantity <= 0 ? t('shop.out_of_stock') : t('shop.purchase'))}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {selectedItem && (
        <PurchaseModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmPurchase}
          itemName={selectedItem.name}
          itemPrice={selectedItem.price}
          itemCurrency={selectedItem.currency}
        />
      )}
    </div>
  );
}

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Package, ShieldCheck } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Spinner } from '@/components/ui/spinner';

interface InventoryItem {
  id: number;
  shop_item: {
    id: number;
    name: string;
    description: string;
    rarity: string;
    type: string;
  };
  quantity: number;
  acquired_at: string;
}

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InventoryModal({ isOpen, onClose }: InventoryModalProps) {
  const { t } = useTranslation('common');
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusTrap(containerRef, isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      fetchInventory();
    }
  }, [isOpen]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/shop/inventory');
      if (!response.ok) throw new Error('Failed to fetch inventory');
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-modal-title"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        ref={containerRef}
        className="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <div className="flex items-center gap-2 text-cyan-400">
            <Package size={20} />
            <h2 id="inventory-modal-title" className="text-xl font-bold text-white">
              {t('inventory.title', 'Your Inventory')}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close inventory"
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center text-neutral-500">
              <Package className="mx-auto mb-4 opacity-20" size={48} />
              <p>Your inventory is empty. Visit the shop to acquire items!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((item) => (
                <div 
                  key={item.id} 
                  className="p-4 rounded-lg bg-neutral-800/50 border border-neutral-700/50 hover:border-cyan-500/30 transition-all group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-cyan-500/80">
                      {item.shop_item.type}
                    </span>
                    <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20">
                      {item.shop_item.rarity}
                    </span>
                  </div>
                  <h3 className="font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                    {item.shop_item.name}
                  </h3>
                  <p className="text-xs text-neutral-400 line-clamp-2 mb-3">
                    {item.shop_item.description}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-neutral-700/30 text-[10px] text-neutral-500">
                    <div className="flex items-center gap-1">
                      <ShieldCheck size={12} className="text-green-500/70" />
                      <span>Owned</span>
                    </div>
                    <span>Qty: {item.quantity}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

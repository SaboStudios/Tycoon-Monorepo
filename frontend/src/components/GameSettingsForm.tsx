'use client';

import React, { useState, useCallback } from 'react';
import { z } from 'zod';

const GameSettingsSchema = z.object({
  gameName: z.string().min(3).max(50),
  maxPlayers: z.number().min(2).max(8),
  startingCash: z.number().min(500).max(10000).step(500),
  stakeAmount: z.number().min(0).max(1000000),
  currency: z.enum(['XLM', 'USDC', 'BTC']),
  timePerTurn: z.number().min(30).max(300),
  allowTrading: z.boolean(),
  enableAuctions: z.boolean(),
});

type GameSettings = z.infer<typeof GameSettingsSchema>;

interface GameSettingsFormProps {
  onSubmit: (settings: GameSettings) => void;
  isLoading?: boolean;
}

export function GameSettingsForm({ onSubmit, isLoading = false }: GameSettingsFormProps) {
  const [settings, setSettings] = useState<Partial<GameSettings>>({
    gameName: '',
    maxPlayers: 4,
    startingCash: 1500,
    stakeAmount: 0,
    currency: 'XLM',
    timePerTurn: 60,
    allowTrading: true,
    enableAuctions: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback(
    (field: keyof GameSettings, value: any) => {
      setSettings((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors]
  );

  const validate = useCallback(() => {
    const result = GameSettingsSchema.safeParse(settings);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      return false;
    }
    return true;
  }, [settings]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setIsSubmitting(true);
      try {
        onSubmit(settings as GameSettings);
      } finally {
        setIsSubmitting(false);
      }
    },
    [settings, validate, onSubmit]
  );

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'XLM' ? 'USD' : currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold text-gray-900">Create Game Settings</h2>

      <div>
        <label htmlFor="gameName" className="block text-sm font-medium text-gray-700">
          Game Name
        </label>
        <input
          id="gameName"
          type="text"
          value={settings.gameName || ''}
          onChange={(e) => handleChange('gameName', e.target.value)}
          className={`mt-1 block w-full rounded-md border ${errors.gameName ? 'border-red-500' : 'border-gray-300'} px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
          aria-invalid={!!errors.gameName}
          aria-describedby={errors.gameName ? 'gameName-error' : undefined}
        />
        {errors.gameName && (
          <p id="gameName-error" className="mt-1 text-sm text-red-600">{errors.gameName}</p>
        )}
      </div>

      <div>
        <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700">
          Max Players
        </label>
        <select
          id="maxPlayers"
          value={settings.maxPlayers || 4}
          onChange={(e) => handleChange('maxPlayers', parseInt(e.target.value))}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>{n} Players</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="startingCash" className="block text-sm font-medium text-gray-700">
          Starting Cash
        </label>
        <input
          id="startingCash"
          type="number"
          value={settings.startingCash || 1500}
          onChange={(e) => handleChange('startingCash', parseInt(e.target.value))}
          min={500}
          max={10000}
          step={500}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-sm text-gray-500">
          {formatCurrency(settings.startingCash || 1500, settings.currency || 'XLM')}
        </p>
      </div>

      <div>
        <label htmlFor="stakeAmount" className="block text-sm font-medium text-gray-700">
          Stake Amount
        </label>
        <input
          id="stakeAmount"
          type="number"
          value={settings.stakeAmount || 0}
          onChange={(e) => handleChange('stakeAmount', parseInt(e.target.value))}
          min={0}
          max={1000000}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="mt-2 p-3 bg-gray-50 rounded-md">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Total Pool:</span>{' '}
            {formatCurrency((settings.stakeAmount || 0) * (settings.maxPlayers || 4), settings.currency || 'XLM')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Winner takes all (minus 5% platform fee)
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
          Currency
        </label>
        <select
          id="currency"
          value={settings.currency || 'XLM'}
          onChange={(e) => handleChange('currency', e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="XLM">Stellar Lumens (XLM)</option>
          <option value="USDC">USD Coin (USDC)</option>
          <option value="BTC">Bitcoin (BTC)</option>
        </select>
      </div>

      <div>
        <label htmlFor="timePerTurn" className="block text-sm font-medium text-gray-700">
          Time per Turn (seconds)
        </label>
        <input
          id="timePerTurn"
          type="number"
          value={settings.timePerTurn || 60}
          onChange={(e) => handleChange('timePerTurn', parseInt(e.target.value))}
          min={30}
          max={300}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.allowTrading ?? true}
            onChange={(e) => handleChange('allowTrading', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Allow Trading</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.enableAuctions ?? true}
            onChange={(e) => handleChange('enableAuctions', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Enable Auctions</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || isLoading}
        className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Creating...' : 'Create Game'}
      </button>
    </form>
  );
}

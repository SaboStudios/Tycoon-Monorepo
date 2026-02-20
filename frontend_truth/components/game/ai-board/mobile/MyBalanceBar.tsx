"use client";

import { Player } from "@/types/game";

function getBalanceColor(bal: number): string {
  if (bal >= 1300) return "text-cyan-300";
  if (bal >= 1000) return "text-emerald-400";
  if (bal >= 750) return "text-yellow-400";
  if (bal >= 150) return "text-orange-400";
  return "text-red-500 animate-pulse";
}

interface MyBalanceBarProps {
  me: Player | null;
  /** Bottom bar above nav - best placement for mobile */
  bottomBar?: boolean;
}

export default function MyBalanceBar({ me, bottomBar = false }: MyBalanceBarProps) {
  if (!me) return null;

  const balance = me.balance ?? 0;
  if (bottomBar) {
    return (
      <div className="flex items-center justify-center gap-3 py-2">
        <span className="text-sm opacity-80">Balance:</span>
        <span className={`text-lg font-bold ${getBalanceColor(balance)} drop-shadow-md`}>
          ${Number(balance).toLocaleString()}
        </span>
      </div>
    );
  }
  return (
    <div className="mt-4 flex items-center justify-start gap-4 rounded-xl px-5 py-3 border border-white/20 flex-wrap gap-y-2">
      <div className="flex items-center gap-3">
        <span className="text-sm opacity-80">Bal:</span>
        <span className={`text-xl font-bold ${getBalanceColor(balance)} drop-shadow-md`}>
          ${Number(balance).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

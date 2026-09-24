/**
 * Board center area: GO, Chance, Community Chest, Free Parking, Go to Jail.
 * Placeholder layout for future enhancement with icons/cards.
 * Tycoon colors, flex/grid layout.
 */
import React from "react";

export default function CenterArea(): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-1 min-h-[160px] min-w-[200px] bg-[#010F10] border border-[#003B3E] rounded-lg p-2">
      {/* Go to Jail - top left */}
      <div
        className="col-span-1 row-span-1 flex items-center justify-center rounded border border-[#003B3E] bg-[#0E1415]"
        data-slot="go-to-jail"
      >
        <span className="text-[#00F0FF] text-xs font-orbitron font-bold text-center px-1">
          Go to Jail
        </span>
      </div>

      {/* Chance - top center */}
      <div
        className="col-span-1 row-span-1 flex items-center justify-center rounded border border-[#003B3E] bg-[#0E1415]"
        data-slot="chance"
      >
        <span className="text-[#00F0FF] text-xs font-orbitron font-bold text-center px-1">
          Chance
        </span>
      </div>

      {/* Community Chest - top right */}
      <div
        className="col-span-1 row-span-1 flex items-center justify-center rounded border border-[#003B3E] bg-[#0E1415]"
        data-slot="community-chest"
      >
        <span className="text-[#00F0FF] text-xs font-orbitron font-bold text-center px-1">
          Community Chest
        </span>
      </div>

      {/* Left spacer */}
      <div className="col-span-1 row-span-1 flex items-center justify-center rounded border border-[#003B3E]/50 bg-[#0E1415]/50" />

      {/* Free Parking - center */}
      <div
        className="col-span-1 row-span-1 flex items-center justify-center rounded border-2 border-[#00F0FF] bg-[#0E1415]"
        data-slot="free-parking"
      >
        <span className="text-[#00F0FF] text-xs font-orbitron font-bold text-center px-1">
          Free Parking
        </span>
      </div>

      {/* Right spacer */}
      <div className="col-span-1 row-span-1 flex items-center justify-center rounded border border-[#003B3E]/50 bg-[#0E1415]/50" />

      {/* Bottom left spacer */}
      <div className="col-span-1 row-span-1 flex items-center justify-center rounded border border-[#003B3E]/50 bg-[#0E1415]/50" />

      {/* GO - bottom center */}
      <div
        className="col-span-1 row-span-1 flex items-center justify-center rounded border-2 border-[#00F0FF] bg-[#00F0FF]/10"
        data-slot="go"
      >
        <span className="text-[#00F0FF] text-sm font-orbitron font-bold text-center px-1">
          GO
        </span>
      </div>

      {/* Bottom right spacer */}
      <div className="col-span-1 row-span-1 flex items-center justify-center rounded border border-[#003B3E]/50 bg-[#0E1415]/50" />
    </div>
  );
}

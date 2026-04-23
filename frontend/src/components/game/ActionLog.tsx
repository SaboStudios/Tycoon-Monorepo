"use client";

import React from "react";
import { ScrollText } from "lucide-react";

export interface ActionLogProps {
  /** Array of event messages (e.g. ["Player 1 rolled 6", "Bought Boardwalk"]) */
  events?: string[];
  /** Optional CSS class for the container */
  className?: string;
}

/**
 * Component to display a list of game events (Action Log).
 * Features a scrollable list, Tycoon-themed styling, and an empty state.
 */
export function ActionLog({ 
  events = [], 
  className = "" 
}: ActionLogProps): React.JSX.Element {
  return (
    <div 
      className={`flex flex-col bg-[#010F10]/80 border border-[#00F0FF]/30 rounded-lg overflow-hidden shadow-lg ${className}`.trim()}
      data-testid="action-log"
    >
      {/* Header */}
      <div className="bg-[#00F0FF]/10 px-4 py-2 border-b border-[#00F0FF]/20 flex items-center gap-2">
        <ScrollText className="w-4 h-4 text-[#00F0FF]" />
        <h3 className="text-[#00F0FF] text-xs font-orbitron font-bold uppercase tracking-wider">
          Action Log
        </h3>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-[150px] max-h-[300px]">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-40 py-8">
            <p className="text-[#F0F7F7] text-xs font-dmSans italic">
              Waiting for actions...
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {[...events].reverse().map((event, index) => (
              <li 
                key={`${event}-${index}`}
                className="text-[#F0F7F7] text-sm font-dmSans border-l-2 border-[#00F0FF]/50 pl-2 py-1 bg-[#00F0FF]/5 animate-in fade-in slide-in-from-left-2"
              >
                {event}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer / Gradient overlay for scroll */}
      <div className="h-2 bg-gradient-to-t from-[#010F10] to-transparent" />
    </div>
  );
}

export default ActionLog;

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Property } from "@/types/game";

interface TradeModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  my_properties: Property[];
  properties: Property[];
  game_properties: any[];
  offerProperties: number[];
  requestProperties: number[];
  setOfferProperties: React.Dispatch<React.SetStateAction<number[]>>;
  setRequestProperties: React.Dispatch<React.SetStateAction<number[]>>;
  offerCash: number;
  requestCash: number;
  setOfferCash: React.Dispatch<React.SetStateAction<number>>;
  setRequestCash: React.Dispatch<React.SetStateAction<number>>;
  toggleSelect: (id: number, arr: number[], setter: any) => void;
  targetPlayerAddress?: string | null;
  isAITrade?: boolean;
}

const PropertyCard = ({
  prop,
  isSelected,
  onClick,
  accent,
}: {
  prop: Property;
  isSelected: boolean;
  onClick: () => void;
  accent: "offer" | "request";
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`
      w-full text-left p-3 rounded-lg border-2 transition-all duration-200 flex items-center gap-3
      focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[#0f172a]
      ${isSelected
        ? accent === "offer"
          ? "border-emerald-400 bg-emerald-500/20 shadow-sm shadow-emerald-500/30"
          : "border-amber-400 bg-amber-500/20 shadow-sm shadow-amber-500/30"
        : "border-slate-600/80 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-700/50"
      }
    `}
  >
    {prop.color && (
      <div
        className="w-8 h-8 rounded flex-shrink-0 border border-white/10"
        style={{ backgroundColor: prop.color }}
      />
    )}
    <span className="text-sm font-medium text-slate-200 truncate">{prop.name}</span>
  </button>
);

export const TradeModal: React.FC<TradeModalProps> = (props) => {
  if (!props.open) return null;

  const {
    title,
    onClose,
    onSubmit,
    my_properties,
    properties,
    game_properties,
    offerProperties,
    requestProperties,
    setOfferProperties,
    setRequestProperties,
    offerCash,
    requestCash,
    setOfferCash,
    setRequestCash,
    toggleSelect,
    targetPlayerAddress,
    isAITrade = false,
  } = props;

  const targetOwnedProps = useMemo(() => {
    if (!targetPlayerAddress) return [];
    const owned = game_properties.filter(
      (gp: any) => gp.address === targetPlayerAddress
    );
    return properties.filter((p: any) =>
      owned.some((gp: any) => gp.property_id === p.id)
    );
  }, [game_properties, properties, targetPlayerAddress]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[calc(100vh-140px)] flex flex-col rounded-2xl bg-slate-900 border border-slate-600/50 shadow-2xl overflow-hidden mb-[80px]"
      >
        {/* Header - matches desktop */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/80 bg-slate-800/50 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-100 truncate pr-2">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/80 transition flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - two sections like desktop (stack on mobile) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="space-y-6">
            {/* You offer */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                You offer
              </h3>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {my_properties.length > 0 ? (
                  my_properties.map((p) => (
                    <PropertyCard
                      key={p.id}
                      prop={p}
                      isSelected={offerProperties.includes(p.id)}
                      onClick={() => toggleSelect(p.id, offerProperties, setOfferProperties)}
                      accent="offer"
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-500 py-3 text-center">No properties</p>
                )}
              </div>
              <label className="block">
                <span className="text-xs text-slate-400 block mb-1">Cash ($)</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={offerCash || ""}
                  onChange={(e) => setOfferCash(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                />
              </label>
            </div>

            {/* You request */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
                You request
              </h3>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {targetOwnedProps.length > 0 ? (
                  targetOwnedProps.map((p) => (
                    <PropertyCard
                      key={p.id}
                      prop={p}
                      isSelected={requestProperties.includes(p.id)}
                      onClick={() => toggleSelect(p.id, requestProperties, setRequestProperties)}
                      accent="request"
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-500 py-3 text-center">No properties</p>
                )}
              </div>
              <label className="block">
                <span className="text-xs text-slate-400 block mb-1">Cash ($)</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={requestCash || ""}
                  onChange={(e) => setRequestCash(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                />
              </label>
            </div>

            {/* AI extra incentive - styled to match slate/amber */}
            {isAITrade && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                <h4 className="text-sm font-semibold text-amber-400 mb-2">
                  Extra amount for AI (optional)
                </h4>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={offerCash || ""}
                  onChange={(e) => setOfferCash(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                />
                <p className="text-xs text-slate-400 mt-2">
                  Extra cash can increase AI acceptance chance.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer - matches desktop */}
        <div className="flex gap-3 px-5 py-4 border-t border-slate-700/80 bg-slate-800/30 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Send deal
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

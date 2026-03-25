"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Handshake,
  ArrowLeftRight,
  DollarSign,
  Check,
  AlertCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TradeProperty {
  name: string;
  color: string;
  price: number;
  type: "property" | "railroad" | "utility";
}

export interface TradePlayer {
  id: string;
  name: string;
  cash: number;
  properties: TradeProperty[];
}

export interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: TradePlayer[];
  currentPlayer: TradePlayer;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<TradeProperty["type"], string> = {
  property: "🏠",
  railroad: "🚂",
  utility: "💡",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function TradeModal({
  isOpen,
  onClose,
  players,
  currentPlayer,
}: TradeModalProps): React.JSX.Element | null {
  // ── State ────────────────────────────────────────────────────────────────
  const [partnerId, setPartnerId] = useState<string>("");
  const [offeredProperties, setOfferedProperties] = useState<Set<string>>(
    new Set()
  );
  const [requestedProperties, setRequestedProperties] = useState<Set<string>>(
    new Set()
  );
  const [offeredCash, setOfferedCash] = useState<string>("");
  const [requestedCash, setRequestedCash] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const partner = players.find((p) => p.id === partnerId) ?? null;
  const otherPlayers = players.filter((p) => p.id !== currentPlayer.id);

  // ── Reset on open/close ──────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setPartnerId("");
      setOfferedProperties(new Set());
      setRequestedProperties(new Set());
      setOfferedCash("");
      setRequestedCash("");
      setValidationError("");
      // Focus the close button when modal opens
      requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
  }, [isOpen]);

  // ── Escape key handler ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // ── Focus trap ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const modal = modalRef.current;
    if (!modal) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  // ── Togglers ─────────────────────────────────────────────────────────────
  const toggleOffered = useCallback((name: string) => {
    setOfferedProperties((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
    setValidationError("");
  }, []);

  const toggleRequested = useCallback((name: string) => {
    setRequestedProperties((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
    setValidationError("");
  }, []);

  // ── Validation & confirm ─────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!partnerId) {
      setValidationError("Please select a trade partner.");
      return;
    }

    const cashOffer = Number(offeredCash) || 0;
    const cashRequest = Number(requestedCash) || 0;

    if (cashOffer < 0 || cashRequest < 0) {
      setValidationError("Cash values cannot be negative.");
      return;
    }
    if (cashOffer > currentPlayer.cash) {
      setValidationError(
        `You only have $${currentPlayer.cash} available to offer.`
      );
      return;
    }
    if (partner && cashRequest > partner.cash) {
      setValidationError(
        `${partner.name} only has $${partner.cash} available.`
      );
      return;
    }
    if (
      offeredProperties.size === 0 &&
      requestedProperties.size === 0 &&
      cashOffer === 0 &&
      cashRequest === 0
    ) {
      setValidationError(
        "You must offer or request at least one property or some cash."
      );
      return;
    }

    // Mock: log trade details and close
    console.log("Trade proposed:", {
      from: currentPlayer.name,
      to: partner?.name,
      offeredProperties: [...offeredProperties],
      requestedProperties: [...requestedProperties],
      offeredCash: cashOffer,
      requestedCash: cashRequest,
    });

    onClose();
  };

  // ── Render nothing when closed ───────────────────────────────────────────
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        data-testid="trade-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-modal-title"
        data-testid="trade-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="pointer-events-auto w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border-2 border-[#003B3E] bg-[#010F10] shadow-[0_0_40px_rgba(0,240,255,0.12)]">
          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-b border-[#003B3E] px-6 py-4">
            <div className="flex items-center gap-3">
              <Handshake className="h-6 w-6 text-[#00F0FF]" aria-hidden />
              <h2
                id="trade-modal-title"
                className="text-lg font-bold text-[#F0F7F7] font-orbitron tracking-wide"
              >
                Propose Trade
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close trade modal"
              className="rounded-lg p-1.5 text-[#F0F7F7]/60 hover:bg-[#003B3E]/40 hover:text-[#00F0FF] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* ── Partner selector ───────────────────────────────────── */}
            <div>
              <label
                htmlFor="partner-select"
                className="block text-xs font-semibold uppercase tracking-wider text-[#00F0FF]/80 mb-2 font-orbitron"
              >
                Trade Partner
              </label>
              <div className="relative">
                <select
                  id="partner-select"
                  value={partnerId}
                  onChange={(e) => {
                    setPartnerId(e.target.value);
                    setRequestedProperties(new Set());
                    setRequestedCash("");
                    setValidationError("");
                  }}
                  className="w-full appearance-none rounded-lg border border-[#003B3E] bg-[#0E1415] px-4 py-2.5 pr-10 text-sm text-[#F0F7F7] outline-none focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/50 transition-colors"
                >
                  <option value="">Select a player…</option>
                  {otherPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ${p.cash}
                    </option>
                  ))}
                </select>
                <ArrowLeftRight className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00F0FF]/50" />
              </div>
            </div>

            {/* ── Two-column trade area ─────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* YOU OFFER */}
              <TradeColumn
                heading="You Offer"
                accentClass="text-rose-400"
                properties={currentPlayer.properties}
                selectedProperties={offeredProperties}
                onToggle={toggleOffered}
                cash={offeredCash}
                onCashChange={(v) => {
                  setOfferedCash(v);
                  setValidationError("");
                }}
                maxCash={currentPlayer.cash}
                testIdPrefix="offer"
              />

              {/* YOU REQUEST */}
              <TradeColumn
                heading="You Request"
                accentClass="text-emerald-400"
                properties={partner?.properties ?? []}
                selectedProperties={requestedProperties}
                onToggle={toggleRequested}
                cash={requestedCash}
                onCashChange={(v) => {
                  setRequestedCash(v);
                  setValidationError("");
                }}
                maxCash={partner?.cash ?? 0}
                testIdPrefix="request"
                disabled={!partnerId}
              />
            </div>

            {/* ── Validation error ──────────────────────────────────── */}
            {validationError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300"
                data-testid="validation-error"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {validationError}
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3 border-t border-[#003B3E] px-6 py-4">
            <button
              onClick={onClose}
              data-testid="cancel-button"
              className="rounded-lg border border-[#003B3E] bg-transparent px-5 py-2 text-sm font-semibold text-[#F0F7F7]/80 hover:bg-[#003B3E]/40 hover:text-[#F0F7F7] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              data-testid="confirm-button"
              className="flex items-center gap-2 rounded-lg bg-[#00F0FF] px-5 py-2 text-sm font-bold text-[#010F10] hover:bg-[#00F0FF]/80 shadow-[0_0_12px_rgba(0,240,255,0.3)] transition-all"
            >
              <Check className="h-4 w-4" />
              Confirm Trade
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface TradeColumnProps {
  heading: string;
  accentClass: string;
  properties: TradeProperty[];
  selectedProperties: Set<string>;
  onToggle: (name: string) => void;
  cash: string;
  onCashChange: (value: string) => void;
  maxCash: number;
  testIdPrefix: string;
  disabled?: boolean;
}

function TradeColumn({
  heading,
  accentClass,
  properties,
  selectedProperties,
  onToggle,
  cash,
  onCashChange,
  maxCash,
  testIdPrefix,
  disabled = false,
}: TradeColumnProps): React.JSX.Element {
  return (
    <div
      className={`rounded-lg border border-[#003B3E] bg-[#0E1415]/60 p-4 ${disabled ? "opacity-40 pointer-events-none" : ""}`}
      data-testid={`${testIdPrefix}-column`}
    >
      <h3
        className={`text-xs font-bold uppercase tracking-wider mb-3 font-orbitron ${accentClass}`}
      >
        {heading}
      </h3>

      {/* Property cards */}
      <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
        {properties.length === 0 ? (
          <p className="text-xs text-[#F0F7F7]/40 italic">
            No properties available
          </p>
        ) : (
          properties.map((prop) => {
            const selected = selectedProperties.has(prop.name);
            return (
              <button
                key={prop.name}
                type="button"
                onClick={() => onToggle(prop.name)}
                data-testid={`${testIdPrefix}-property-${prop.name.replace(/\s+/g, "-").toLowerCase()}`}
                className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                  selected
                    ? "border-[#00F0FF] bg-[#00F0FF]/10 text-[#F0F7F7] shadow-[0_0_8px_rgba(0,240,255,0.15)]"
                    : "border-[#003B3E]/60 bg-[#010F10]/50 text-[#F0F7F7]/70 hover:border-[#003B3E] hover:text-[#F0F7F7]"
                }`}
              >
                {/* Color swatch */}
                <span
                  className={`inline-block h-4 w-4 rounded ${prop.color}`}
                  aria-hidden
                />
                <span className="text-base" aria-hidden>
                  {TYPE_ICON[prop.type]}
                </span>
                <span className="flex-1 truncate font-medium">{prop.name}</span>
                <span className="text-xs text-[#F0F7F7]/50">
                  ${prop.price}
                </span>
                {selected && (
                  <Check className="h-4 w-4 text-[#00F0FF] shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Cash input */}
      <div>
        <label
          htmlFor={`${testIdPrefix}-cash`}
          className="flex items-center gap-1.5 text-xs text-[#F0F7F7]/60 mb-1"
        >
          <DollarSign className="h-3.5 w-3.5" />
          Cash (max ${maxCash})
        </label>
        <input
          id={`${testIdPrefix}-cash`}
          type="number"
          min={0}
          max={maxCash}
          value={cash}
          onChange={(e) => onCashChange(e.target.value)}
          placeholder="0"
          data-testid={`${testIdPrefix}-cash-input`}
          className="w-full rounded-lg border border-[#003B3E] bg-[#010F10] px-3 py-2 text-sm text-[#F0F7F7] outline-none placeholder:text-[#F0F7F7]/30 focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
    </div>
  );
}

export default TradeModal;

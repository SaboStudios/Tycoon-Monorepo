"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BankruptcyModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onConfirmBankruptcy?: () => Promise<void> | void;
  message?: string;
  onReturnHome?: () => void;
  autoCloseDelay?: number;
  tokensAwarded?: number;
}

export const BankruptcyModal: React.FC<BankruptcyModalProps> = ({
  isOpen,
  onClose,
  onConfirmBankruptcy,
  message = "You cannot pay your debts. Your empire has collapsed.",
  onReturnHome = () => (window.location.href = "/"),
  autoCloseDelay = 10000,
  tokensAwarded = 0.5,
}) => {
  const [shouldShow, setShouldShow] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.round(autoCloseDelay / 1000));
  const [isConfirming, setIsConfirming] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNavigated = useRef(false);
  const bankruptcyConfirmed = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setShouldShow(true);
      setIsConfirming(false);
      hasNavigated.current = false;
      bankruptcyConfirmed.current = false;
      if (!onConfirmBankruptcy) {
        setSecondsLeft(Math.round(autoCloseDelay / 1000));
      }
    } else {
      setShouldShow(false);
    }
  }, [isOpen, autoCloseDelay, onConfirmBankruptcy]);

  useEffect(() => {
    if (!shouldShow || onConfirmBankruptcy) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    exitTimerRef.current = setTimeout(() => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;
      setShouldShow(false);
      setTimeout(() => onReturnHome(), 300);
    }, autoCloseDelay);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [shouldShow, autoCloseDelay, onReturnHome, onConfirmBankruptcy]);

  useEffect(() => {
    if (!bankruptcyConfirmed.current || hasNavigated.current) return;
    const t = setTimeout(() => {
      hasNavigated.current = true;
      setShouldShow(false);
      setTimeout(() => { window.location.href = "/"; }, 300);
    }, 5000);
    return () => clearTimeout(t);
  }, [shouldShow]);

  const handleManualClose = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    setShouldShow(false);
    setTimeout(() => onClose?.(), 300);
  };

  const handleDeclareBankruptcy = async () => {
    if (isConfirming || hasNavigated.current) return;
    setIsConfirming(true);
    try {
      await onConfirmBankruptcy?.();
      bankruptcyConfirmed.current = true;
    } catch (error) {
      console.error("Bankruptcy declaration failed:", error);
      setIsConfirming(false);
      return;
    }
    hasNavigated.current = true;
    setShouldShow(false);
  };

  if (!shouldShow) return null;

  const isManualMode = !!onConfirmBankruptcy;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={isManualMode && onClose ? handleManualClose : undefined}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-600/60 shadow-xl overflow-hidden"
        >
          <div className="px-6 pt-6 pb-4 text-center">
            <h2 className="text-xl font-bold text-slate-100 mb-2">Bankruptcy</h2>
            <p className="text-slate-300 text-sm leading-relaxed">{message}</p>
            <p className="mt-4 text-slate-400 text-xs">
              You can claim a consolation reward from your profile after leaving.
            </p>
          </div>

          <div className="px-6 pb-6 pt-2 flex flex-col gap-3">
            {isManualMode ? (
              <>
                <button
                  type="button"
                  onClick={handleDeclareBankruptcy}
                  disabled={isConfirming}
                  className="w-full py-3 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-60 transition"
                >
                  {isConfirming ? "Leaving…" : "Leave game"}
                </button>
                {onClose && (
                  <button
                    type="button"
                    onClick={handleManualClose}
                    className="w-full py-2.5 rounded-xl font-medium text-slate-400 hover:text-slate-200 transition"
                  >
                    Cancel
                  </button>
                )}
                {bankruptcyConfirmed.current && (
                  <p className="text-center text-amber-400/90 text-sm">Redirecting home in 5 seconds…</p>
                )}
              </>
            ) : (
              <p className="text-center text-slate-400 text-sm">
                {secondsLeft > 0
                  ? `Returning home in ${secondsLeft} second${secondsLeft !== 1 ? "s" : ""}…`
                  : "Returning home…"}
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

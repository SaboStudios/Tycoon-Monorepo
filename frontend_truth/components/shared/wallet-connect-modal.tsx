"use client";

import { useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { X } from "lucide-react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import AnimationWrapper from "@/animation/animation-wrapper";

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletConnectModal({
  isOpen,
  onClose,
}: WalletConnectModalProps) {
  const { open } = useAppKit();
  const { isConnected } = useAppKitAccount();

  const handleConfirm = async () => {
    try {
      await open(); // 🔥 Directly open Reown's wallet connection modal
      onClose(); // Close your modal afterwards
    } catch (err) {
      console.error("Wallet connection failed:", err);
    }
  };

  // Auto close when connected
  useEffect(() => {
    if (isOpen && isConnected) {
      onClose();
    }
  }, [isConnected, isOpen, onClose]);

  const modalVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      transition: { duration: 0.2, ease: [0.42, 0, 1, 1] },
    },
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex z-[99] items-center justify-center">
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />

          <motion.div
            className="relative w-full max-w-md rounded-[12px] bg-[#010F10] p-[32px] border-[#003B3E] border-[1px]"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="w-full flex items-center justify-between relative mb-8">
              <h2 className="w-full text-[24px] font-[600] text-[#F0F7F7] text-left font-orbitron">
                Connect Wallet
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Just one button */}
            <AnimationWrapper variant="slideUp" delay={0.3}>
              <button
                type="button"
                onClick={handleConfirm}
                className="w-full py-3 rounded-[12px] font-medium transition-colors bg-[#0FF0FC]/80 hover:bg-[#0FF0FC]/40 text-[#0D191B]"
              >
                Connect
              </button>
            </AnimationWrapper>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

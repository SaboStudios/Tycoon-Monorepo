"use client";

import { motion, AnimatePresence, Variants } from "framer-motion";
import { X } from "lucide-react";
import { useDisconnect } from "@reown/appkit/react";
import AnimationWrapper from "@/animation/animation-wrapper";

interface WalletDisconnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletDisconnectModal({
  isOpen,
  onClose,
}: WalletDisconnectModalProps) {
  const { disconnect } = useDisconnect(); // Use the correct hook

  const handleDisconnect = async () => {
    try {
      await disconnect(); // Properly disconnect the wallet
      onClose();
    } catch (err) {
      console.error("Wallet disconnection failed:", err);
    }
  };

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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[9999] w-full max-w-md rounded-[12px] bg-[#010F10] p-[32px] border border-[#003B3E]"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="w-full flex items-center justify-between relative mb-4">
              <h2 className="text-2xl font-semibold text-[#F0F7F7] font-orbitron">
                Disconnect Wallet
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="w-auto text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <p className="w-full text-[#F0F7F7] text-sm text-center pb-6">
              Are you sure you want to disconnect your wallet?
            </p>
            <div className="flex gap-3 items-center justify-center">
              <AnimationWrapper variant="slideLeft" delay={0.1}>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="w-full py-3 px-4 rounded-lg font-medium bg-[#0FF0FC]/80 hover:bg-[#0FF0FC]/40 text-[#0D191B] transition-colors"
                >
                  Disconnect
                </button>
              </AnimationWrapper>
              <AnimationWrapper variant="slideRight" delay={0.2}>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 px-4 rounded-lg font-medium bg-[#0D191B] border border-[#0D191B] hover:border-[#0FF0FC] text-white transition-colors"
                >
                  Cancel
                </button>
              </AnimationWrapper>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

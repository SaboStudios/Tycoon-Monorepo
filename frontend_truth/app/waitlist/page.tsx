"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { Mail, Wallet, Sparkles, AtSign } from "lucide-react";

const WaitlistForm = () => {
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState("");
  const [telegram, setTelegram] = useState(""); // User types username WITHOUT @
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !wallet) {
      toast.error("Email and Wallet are required");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Wallet validation
    const walletRegex = /^0x[a-fA-F0-9]{40}$/i;
    if (!walletRegex.test(wallet)) {
      toast.error("Invalid wallet address (must be 0x + 40 hex characters)");
      return;
    }

    // Telegram: optional, but if provided, no @ allowed (we add it server-side)
    if (telegram.includes("@")) {
      toast.error("Please enter Telegram username without @");
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post("/waitlist", {
        email_address: email,
        wallet_address: wallet,
        telegram_username: telegram ? `@${telegram.trim()}` : null,
      });

      toast.success("Successfully joined the Tycoon waitlist! 🎉");
      setEmail("");
      setWallet("");
      setTelegram("");
    } catch (error: any) {
      console.error("Waitlist submission failed:", error);
      toast.error(error?.response?.data?.message || "Failed to join waitlist. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-blue-950 to-cyan-900 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-lg mx-auto p-8 md:p-10 bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-cyan-500/30 relative overflow-hidden"
      >
        {/* Background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/20 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-10 text-center flex items-center justify-center gap-4">
            Join Tycoon Waitlist
          </h2>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-cyan-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  className="w-full pl-12 pr-5 py-4 bg-gray-800/50 border border-cyan-700/50 rounded-2xl text-white text-lg placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/30 transition-all"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            {/* Wallet */}
            <div>
              <label htmlFor="wallet" className="block text-sm font-medium text-gray-300 mb-2">
                Wallet Address
              </label>
              <div className="relative">
                <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-cyan-400" />
                <input
                  id="wallet"
                  type="text"
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value.trim())}
                  className="w-full pl-12 pr-5 py-4 bg-gray-800/50 border border-cyan-700/50 rounded-2xl text-white text-lg placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/30 transition-all"
                  placeholder="0x..."
                  required
                />
              </div>
            </div>

            {/* Telegram */}
            <div>
              <label htmlFor="telegram" className="block text-sm font-medium text-gray-300 mb-2">
                Telegram Username <span className="text-gray-500 text-xs">(optional)</span>
              </label>
              <div className="relative">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-cyan-400" />
                <input
                  id="telegram"
                  type="text"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value.trim())}
                  className="w-full pl-12 pr-5 py-4 bg-gray-800/50 border border-cyan-700/50 rounded-2xl text-white text-lg placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/30 transition-all"
                  placeholder="yourusername"
                />
              </div>
              <p className="text-sm text-gray-400 mt-3 pl-1">
                Enter your username <strong>without</strong> the @ — we'll add it for you
              </p>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: isSubmitting ? 1 : 1.04 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.96 }}
              className="w-full py-5 mt-8 bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-bold text-xl rounded-2xl shadow-xl shadow-cyan-500/40 hover:shadow-cyan-500/60 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isSubmitting ? "Submitting..." : "Join Waitlist"}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default WaitlistForm;
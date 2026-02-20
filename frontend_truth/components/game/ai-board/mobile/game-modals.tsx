import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { Crown, Trophy, Sparkles, Wallet, HeartHandshake } from "lucide-react";
import { Game, Player } from "@/types/game";
import { apiClient } from "@/lib/api";
import { CardModal } from "../../modals/cards";

interface GameModalsProps {
  winner: Player | null;
  showExitPrompt: boolean;
  setShowExitPrompt: (value: boolean) => void;
  showInsolvencyModal: boolean;
  insolvencyDebt: number;
  isRaisingFunds: boolean;
  showBankruptcyModal: boolean;
  showCardModal: boolean;
  cardData: {
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null;
  cardPlayerName: string;
  setShowCardModal: (value: boolean) => void;
  me: Player | null;
  players: Player[];
  currentGame: Game;
  isGuest?: boolean;
  isPending: boolean;
  endGame: () => Promise<any>;
  reset: () => void;
  onFinishGameByTime?: () => Promise<void>;
  setShowInsolvencyModal: (value: boolean) => void;
  setIsRaisingFunds: (value: boolean) => void;
  setShowBankruptcyModal: (value: boolean) => void;
  fetchUpdatedGame: () => Promise<void>;
  showToast: (message: string, type?: "success" | "error" | "default") => void;
}

const GameModals: React.FC<GameModalsProps> = ({
  winner,
  showExitPrompt,
  setShowExitPrompt,
  showInsolvencyModal,
  insolvencyDebt,
  isRaisingFunds,
  showBankruptcyModal,
  showCardModal,
  cardData,
  cardPlayerName,
  setShowCardModal,
  me,
  players,
  currentGame,
  isGuest = false,
  isPending,
  endGame,
  reset,
  onFinishGameByTime,
  setShowInsolvencyModal,
  setIsRaisingFunds,
  setShowBankruptcyModal,
  fetchUpdatedGame,
  showToast,
}) => {
  const handleRaiseFunds = () => {
    setShowInsolvencyModal(false);
    setIsRaisingFunds(true);
    showToast("Raise funds (mortgage, sell houses, trade) then click 'Try Again'", "default");
  };

  const handleDeclareBankruptcy = async () => {
    setShowInsolvencyModal(false);
    setIsRaisingFunds(false);
    showToast("Declaring bankruptcy...", "default");

    try {
      if (!isGuest && endGame) await endGame();

      const opponent = players.find(p => p.user_id !== me?.user_id);
      await apiClient.put(`/games/${currentGame.id}`, {
        status: "FINISHED",
        winner_id: opponent?.user_id || null,
      });

      showToast("Game over! You have declared bankruptcy.", "error");
      setShowBankruptcyModal(true);
    } catch (err) {
      showToast("Failed to end game", "error");
    }
  };

  const handleRetryAfterFunds = () => {
    fetchUpdatedGame();

    if (!me || me.balance > 0) {
      setIsRaisingFunds(false);
      showToast("Funds raised successfully! Your turn continues.", "success");
    } else {
      showToast("Still not enough money. Raise more or declare bankruptcy.", "error");
      setShowInsolvencyModal(true);
    }
  };

  const handleFinalizeAndLeave = async () => {
    setShowExitPrompt(false);
    const isHumanWinner = winner?.user_id === me?.user_id;
    const toastId = toast.loading(
      isHumanWinner ? "Claiming your prize on-chain…" : "Claiming consolation on-chain…"
    );

    try {
      // Guest: backend already claimed on-chain when finish-by-time ran; skip wallet call.
      if (!isGuest) {
        await endGame();
      }
      try {
        await onFinishGameByTime?.();
      } catch (backendErr: any) {
        if (backendErr?.message?.includes("not running") || backendErr?.response?.data?.error === "Game is not running") {
          // Game already finished (e.g. other player already called). On-chain claim succeeded; ignore.
        } else {
          throw backendErr;
        }
      }
      toast.success(
        isHumanWinner ? "Prize claimed! 🎉" : "Consolation collected — thanks for playing!",
        { id: toastId, duration: 5000 }
      );
    } catch (err: any) {
      toast.error(
        err?.message || "Something went wrong — you can try again later",
        { id: toastId, duration: 8000 }
      );
    } finally {
      reset();
    }
  };

  const [claimAndLeaveInProgress, setClaimAndLeaveInProgress] = useState(false);
  const handleClaimAndGoHome = useCallback(async () => {
    setClaimAndLeaveInProgress(true);
    const isHumanWinner = winner?.user_id === me?.user_id;
    const toastId = toast.loading(
      isHumanWinner ? "Claiming your prize…" : "Finishing up…"
    );
    try {
      // Guest: backend already claimed on-chain when finish-by-time ran; skip wallet call.
      if (!isGuest) {
        await endGame();
      }
      try {
        await onFinishGameByTime?.();
      } catch (backendErr: any) {
        if (backendErr?.message?.includes("not running") || backendErr?.response?.data?.error === "Game is not running") {
          // ignore
        } else {
          throw backendErr;
        }
      }
      toast.success(
        isHumanWinner ? "Prize claimed! 🎉" : "Consolation collected — thanks for playing!",
        { id: toastId, duration: 5000 }
      );
      window.location.href = "/";
    } catch (err: any) {
      toast.error(
        err?.message || "Something went wrong — you can try again later",
        { id: toastId, duration: 8000 }
      );
      setClaimAndLeaveInProgress(false);
    } finally {
      reset();
    }
  }, [winner?.user_id, me?.user_id, isGuest, endGame, onFinishGameByTime, reset]);

  return (
    <>
      {/* Winner / Loser Screen (time's up by net worth) */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4 overflow-y-auto"
          >
            {/* Ambient background — deep indigo/cyan, no gold */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/90 via-violet-950/60 to-cyan-950/70" />

            {winner.user_id === me?.user_id ? (
              <motion.div
                initial={{ scale: 0.88, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="relative w-full max-w-md rounded-[2rem] overflow-hidden border-2 border-cyan-400/50 bg-gradient-to-b from-indigo-900/95 via-violet-900/90 to-slate-950/95 shadow-2xl shadow-cyan-900/30 text-center"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.18),transparent)]" />
                <div className="relative z-10 p-8 sm:p-10">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                    className="mb-6 relative"
                  >
                    <Crown className="w-20 h-20 sm:w-24 sm:h-24 mx-auto text-cyan-300 drop-shadow-[0_0_40px_rgba(34,211,238,0.7)]" />
                    <motion.div
                      className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2"
                      animate={{ opacity: [0.4, 0.8, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Sparkles className="w-6 h-6 text-cyan-400/80" />
                    </motion.div>
                  </motion.div>
                  <motion.h1
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-4xl sm:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-cyan-300 mb-2"
                  >
                    YOU WIN
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="text-lg text-slate-200 mb-2"
                  >
                    You had the highest net worth when time ran out.
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-cyan-200/90 text-base mb-6"
                  >
                    Well played — you earned this one.
                  </motion.p>
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClaimAndGoHome}
                    disabled={claimAndLeaveInProgress || isPending}
                    className="w-full py-4 px-6 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-slate-900 font-bold text-lg shadow-lg shadow-cyan-900/40 border border-cyan-300/40 transition-all disabled:cursor-wait"
                  >
                    {claimAndLeaveInProgress || isPending ? "Claiming…" : "Claim & go home"}
                  </motion.button>
                  <p className="text-sm text-slate-500 mt-6">Thanks for playing Tycoon!</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.88, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="relative w-full max-w-md rounded-[2rem] overflow-hidden border-2 border-slate-500/50 bg-gradient-to-b from-slate-900/95 via-slate-800/90 to-black/95 shadow-2xl shadow-slate-900/50 text-center"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.12),transparent)]" />
                <div className="relative z-10 p-8 sm:p-10">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="mb-5"
                  >
                    <Trophy className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-amber-400/90" />
                  </motion.div>
                  <motion.h1
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="text-2xl sm:text-3xl font-bold text-slate-200 mb-1"
                  >
                    Time&apos;s up
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="text-xl font-semibold text-white mb-4"
                  >
                    {winner.username} <span className="text-amber-400">wins</span>
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mb-6 flex flex-col items-center gap-3"
                  >
                    <HeartHandshake className="w-12 h-12 text-cyan-400/80" />
                    <p className="text-slate-300">You still get a consolation prize.</p>
                  </motion.div>
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClaimAndGoHome}
                    disabled={claimAndLeaveInProgress || isPending}
                    className="w-full py-4 px-6 rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white font-bold text-lg shadow-lg shadow-cyan-900/40 border border-cyan-400/30 transition-all disabled:cursor-wait"
                  >
                    {claimAndLeaveInProgress || isPending ? "Claiming…" : "Claim & go home"}
                  </motion.button>
                  <p className="text-sm text-slate-500 mt-6">Thanks for playing Tycoon!</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit / Claim confirmation — sleek confirm dialog */}
      <AnimatePresence>
        {showExitPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[110] p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="relative w-full max-w-sm rounded-3xl overflow-hidden border border-cyan-500/40 bg-gradient-to-b from-slate-900 to-slate-800 shadow-2xl shadow-cyan-900/20 text-center"
            >
              <div className="p-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, delay: 0.05 }}
                  className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400/40"
                >
                  <Wallet className="w-7 h-7 text-cyan-400" />
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-2">
                  {winner?.user_id === me?.user_id ? "Confirm & claim" : "Confirm & collect"}
                </h2>
                <p className="text-slate-400 text-sm mb-8">
                  {winner?.user_id === me?.user_id
                    ? "This will finalize the game on-chain and send your rewards to your wallet."
                    : "This will finalize the game and send your consolation prize."}
                </p>
                <div className="flex flex-col gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleFinalizeAndLeave}
                    disabled={isPending}
                    className="w-full py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white font-semibold transition disabled:cursor-wait"
                  >
                    {isPending ? "Processing…" : "Confirm"}
                  </motion.button>
                  <button
                    onClick={() => setShowExitPrompt(false)}
                    className="w-full py-3 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-300 font-medium transition"
                  >
                    Back
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Insolvency Modal */}
      <AnimatePresence>
        {showInsolvencyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-red-500/50 shadow-2xl"
            >
              <h2 className="text-4xl font-bold text-red-400 mb-6">You're Broke!</h2>
              <p className="text-xl text-white mb-8">
                You owe <span className="text-yellow-400 font-bold">${insolvencyDebt}</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <button
                  onClick={handleRaiseFunds}
                  className="px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xl rounded-2xl shadow-xl hover:scale-105 transition-all"
                >
                  Raise Funds & Retry
                </button>
                <button
                  onClick={handleDeclareBankruptcy}
                  className="px-10 py-5 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold text-xl rounded-2xl shadow-xl hover:scale-105 transition-all"
                >
                  Declare Bankruptcy
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bankruptcy Modal */}
      <AnimatePresence>
        {showBankruptcyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-red-500/50 shadow-2xl"
            >
              <h2 className="text-4xl font-bold text-red-400 mb-6">Bankruptcy Declared!</h2>
              <p className="text-xl text-white mb-8">Game over. Better luck next time!</p>
              <button
                onClick={() => window.location.href = "/"}
                className="px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xl rounded-2xl shadow-xl hover:scale-105 transition-all"
              >
                Return Home
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Modal - using CardModal component for consistent experience */}
      {/* {showCardModal && cardData && (
        <CardModal
          isOpen={showCardModal}
          onClose={() => setShowCardModal(false)}
          card={cardData}
          playerName={cardPlayerName}
        />
      )} */}

      {/* Raised Funds Button */}
      {isRaisingFunds && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] w-[80vw] max-w-md"
        >
          <button
            onClick={handleRetryAfterFunds}
            className="w-full py-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-bold text-lg rounded-full shadow-2xl hover:from-yellow-600 hover:to-amber-700 transform hover:scale-105 active:scale-95 transition-all"
          >
            I've Raised Funds — Try Again
          </button>
        </motion.div>
      )}
    </>
  );
};

export default GameModals;
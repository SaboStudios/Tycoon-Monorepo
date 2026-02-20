import { motion } from "framer-motion";

type RollResultProps = {
  roll: { die1: number; die2: number; total: number };
  /** Smaller size for mobile boards */
  compact?: boolean;
};

export default function RollResult({ roll, compact = false }: RollResultProps) {
  return (
    <motion.div
      initial={{ scale: 0, y: 50 }}
      animate={{ scale: 1, y: 0 }}
      className={
        compact
          ? "flex items-center gap-2 text-2xl font-bold mb-2"
          : "flex items-center gap-6 text-7xl font-bold mb-4"
      }
    >
      <span className="text-cyan-400 drop-shadow-2xl">{roll.die1}</span>
      <span className={compact ? "text-white text-xl" : "text-white text-6xl"}>+</span>
      <span className="text-pink-400 drop-shadow-2xl">{roll.die2}</span>
      <span className={compact ? "text-white mx-1 text-xl" : "text-white mx-4 text-6xl"}>=</span>
      <span
        className={
          compact
            ? "text-yellow-400 text-3xl drop-shadow-2xl"
            : "text-yellow-400 text-9xl drop-shadow-2xl"
        }
      >
        {roll.total}
      </span>
    </motion.div>
  );
}
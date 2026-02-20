import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DiceAnimationProps {
  isRolling: boolean;
  roll: { die1: number; die2: number; total: number } | null;
}

const DiceFace = ({ value }: { value: number }) => {
  const dotPositions: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [28, 72], [72, 28], [72, 72]],
    5: [[28, 28], [28, 72], [50, 50], [72, 28], [72, 72]],
    6: [[28, 28], [28, 50], [28, 72], [72, 28], [72, 50], [72, 72]],
  };

  return (
    <>
      {dotPositions[value].map(([x, y], i) => (
        <div
          key={i}
          className="absolute w-5 h-5 bg-black rounded-full shadow-inner"
          style={{
            top: `${y}%`,
            left: `${x}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </>
  );
};

const DiceAnimation: React.FC<DiceAnimationProps> = ({ isRolling, roll }) => {
  return (
    <AnimatePresence>
      {isRolling && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed inset-0 flex items-center justify-center gap-8 z-20 pointer-events-none"
        >
          <motion.div
            animate={{ rotateX: [0, 360, 720, 1080], rotateY: [0, 360, -360, 720] }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative w-20 h-20 bg-white rounded-xl shadow-2xl border-2 border-gray-800"
            style={{ boxShadow: "0 15px 30px rgba(0,0,0,0.7), inset 0 5px 10px rgba(255,255,255,0.5)" }}
          >
            {roll ? <DiceFace value={roll.die1} /> : <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }} className="flex h-full items-center justify-center text-4xl font-bold text-gray-400">?</motion.div>}
          </motion.div>
          <motion.div
            animate={{ rotateX: [0, -720, 360, 1080], rotateY: [0, -360, 720, -360] }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            className="relative w-20 h-20 bg-white rounded-xl shadow-2xl border-2 border-gray-800"
            style={{ boxShadow: "0 15px 30px rgba(0,0,0,0.7), inset 0 5px 10px rgba(255,255,255,0.5)" }}
          >
            {roll ? <DiceFace value={roll.die2} /> : <motion.div animate={{ rotate: -360 }} transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }} className="flex h-full items-center justify-center text-4xl font-bold text-gray-400">?</motion.div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DiceAnimation;
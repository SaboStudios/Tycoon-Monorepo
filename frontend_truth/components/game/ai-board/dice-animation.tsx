import { motion, AnimatePresence } from "framer-motion";

type DiceAnimationProps = {
  isRolling: boolean;
  roll: { die1: number; die2: number } | null;
};

export default function DiceAnimation({ isRolling, roll }: DiceAnimationProps) {
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
            className="absolute w-7 h-7 bg-black rounded-full shadow-inner"
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

  return (
    <AnimatePresence>
      {isRolling && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute inset-0 flex items-center justify-center gap-16 z-20 pointer-events-none"
        >
          <motion.div
            animate={{ rotateX: [0, 360, 720, 1080], rotateY: [0, 360, -360, 720] }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="relative w-28 h-28 bg-white rounded-2xl shadow-2xl border-4 border-gray-800"
            style={{ boxShadow: "0 25px 50px rgba(0,0,0,0.7), inset 0 10px 20px rgba(255,255,255,0.5)" }}
          >
            {roll ? <DiceFace value={roll.die1} /> : (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }}
                className="flex h-full items-center justify-center text-6xl font-bold text-gray-400"
              >
                ?
              </motion.div>
            )}
          </motion.div>

          <motion.div
            animate={{ rotateX: [0, -720, 360, 1080], rotateY: [0, -360, 720, -360] }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
            className="relative w-28 h-28 bg-white rounded-2xl shadow-2xl border-4 border-gray-800"
            style={{ boxShadow: "0 25px 50px rgba(0,0,0,0.7), inset 0 10px 20px rgba(255,255,255,0.5)" }}
          >
            {roll ? <DiceFace value={roll.die2} /> : (
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }}
                className="flex h-full items-center justify-center text-6xl font-bold text-gray-400"
              >
                ?
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
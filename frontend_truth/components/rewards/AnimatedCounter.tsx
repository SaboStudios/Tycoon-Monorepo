"use client";

import { useState, useEffect } from "react";

interface AnimatedCounterProps {
  to: number;
  duration?: number;
}

export function AnimatedCounter({ to, duration = 2 }: AnimatedCounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const from = 0;
    const animateCount = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = (timestamp - startTime) / (duration * 1000);
      if (progress < 1) {
        setCount(Math.round(from + progress * (to - from)));
        requestAnimationFrame(animateCount);
      } else {
        setCount(to);
      }
    };
    requestAnimationFrame(animateCount);
    return () => {
      startTime = null;
    };
  }, [to, duration]);

  return <span>{count}</span>;
}

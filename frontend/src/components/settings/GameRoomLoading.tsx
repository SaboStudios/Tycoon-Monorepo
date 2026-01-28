'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GameRoomLoading() {
  const router = useRouter();
  const [dots, setDots] = useState('');

  // Animated dots effect
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Navigation timeout effect
  useEffect(() => {
    const timer = setTimeout(() => {
      // Navigate to game play route
      router.push('/play-ai');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-900 text-white flex flex-col items-center justify-center">
      {/* Background Image Placeholder - using a dark overlay for now */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0 opacity-50"
        style={{
          backgroundImage: 'url("https://placehold.co/1920x1080/1a1a2e/FFF?text=Game+Room+Background")',
          filter: 'blur(4px)'
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center justify-center space-y-8">
        {/* Evil Laugh Emoji Animation */}
        <div className="text-9xl animate-bounce drop-shadow-lg filter shadow-red-500/50">
          😈
        </div>

        {/* Loading Text */}
        <div className="flex flex-col items-center space-y-2">
          <h1 className="text-4xl font-bold tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
            Game Generation in Progress
          </h1>
          <p className="text-xl font-mono text-gray-300">
            Loading{dots}
          </p>
        </div>

        {/* Loading Bar Mockup */}
        <div className="w-96 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-red-600 animate-[loading_5s_ease-in-out_infinite] w-full origin-left" />
        </div>
      </div>
      
      <style jsx>{`
        @keyframes loading {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}

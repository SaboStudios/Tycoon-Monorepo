import React from 'react';
import WhatIsTycoon from '@/components/guest/WhatIsTycoon';
import { BoardSquare } from '@/components/game/BoardSquare';

export default {
  title: 'Visual Regression/Baseline',
};

export const MarketingLanding = () => (
  <div className="min-h-screen bg-[#010F10] p-8 text-white">
    <WhatIsTycoon />
  </div>
);

MarketingLanding.storyName = 'Marketing Landing (stable state)';

export const HUDBoardSquares = () => (
  <div className="min-h-screen bg-[#010F10] p-8 text-white">
    <h2 className="mb-4 text-2xl font-bold">HUD: Board Squares</h2>
    <div className="grid grid-cols-4 gap-4">
      <BoardSquare name="GO" type="go" position={0} />
      <BoardSquare name="Income Tax" type="tax" position={4} />
      <BoardSquare name="Community" type="community" position={2} />
      <BoardSquare name="Jail" type="jail" position={10} />
      <BoardSquare name="Park Place" type="property" position={37} color="bg-[#00008B]" />
    </div>
  </div>
);

HUDBoardSquares.storyName = 'HUD board squares (stable)';

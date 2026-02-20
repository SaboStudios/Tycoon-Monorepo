"use client";

import { ChevronRight } from "lucide-react";
import React, { useState } from "react";
import ChatRoom from "./chat-room";
import ChatRoomDesktop from "./chat-room-desktop";
import { PiChatsCircle } from "react-icons/pi";
import { Game, Player } from "@/types/game";

interface GameRoomProps {
  game: Game | null;
  me: Player | null;
  /** When true, used as full-width tab on mobile (no sidebar chrome) */
  isMobile?: boolean;
}

const GameRoom = ({ game, me, isMobile = false }: GameRoomProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const gameId = game?.code ?? game?.id ?? "";
  if (!gameId) return null;

  // Mobile tab layout: full-width chat, fill viewport (parent gives height via h-dvh)
  if (isMobile) {
    return (
      <div className="flex flex-col h-full min-h-[50vh] overflow-hidden bg-[#0a0f10]">
        <div className="flex-shrink-0 flex items-center px-4 py-2.5 border-b border-white/5">
          <h3 className="font-bold text-sm text-white font-dmSans tracking-tight">
            Game Chat{gameId ? ` · ${gameId}` : ""}
          </h3>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ChatRoom gameId={gameId} me={me} isMobile />
        </div>
      </div>
    );
  }

  // Desktop sidebar layout
  return (
    <>
      {!isSidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 right-4 z-30 lg:top-6 lg:right-8 bg-[#0B191A]/90 backdrop-blur-sm 
            text-cyan-400 hover:text-cyan-300 p-3 rounded-full shadow-lg border border-cyan-500/30 
            transition-all hover:scale-105 lg:hidden xl:block"
          aria-label="Open chat"
        >
          <PiChatsCircle className="w-6 h-6" />
        </button>
      )}

      <aside
        className={`
          h-[calc(100vh-120px)] mb-[120px] bg-[#0a0f10] border-l border-white/5 overflow-hidden flex flex-col
          transition-all duration-300 ease-in-out
          fixed top-0 right-0 z-20 lg:static lg:z-auto lg:self-start
          ${isSidebarOpen
            ? "translate-x-0 w-[85vw] sm:w-[75vw] md:w-[400px] lg:w-[340px] xl:w-[380px]"
            : "translate-x-full lg:translate-x-0 lg:w-[72px]"
          }
        `}
      >
        {!isSidebarOpen && (
          <div className="hidden lg:flex lg:flex-col lg:items-center lg:pt-10 lg:gap-10 text-[#869298]">
            <button
              onClick={toggleSidebar}
              className="p-3 hover:text-cyan-400 transition-colors rounded-full hover:bg-cyan-950/30"
              aria-label="Open chat sidebar"
            >
              <PiChatsCircle className="w-7 h-7" />
            </button>
          </div>
        )}

        {isSidebarOpen && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-white/5">
              <button
                onClick={toggleSidebar}
                className="lg:hidden text-[#869298] hover:text-white transition-colors p-1 rounded"
                aria-label="Close chat"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <h4 className="font-bold text-lg text-white font-dmSans tracking-tight">
                Game Chat{gameId ? ` · ${gameId}` : ""}
              </h4>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatRoomDesktop gameId={gameId} me={me} />
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default GameRoom;

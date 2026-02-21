"use client";

import React from "react";
import { Copy, Home, Coins, Share2, Send, MessageCircle, Users, Loader2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { PlayerList } from "@/components/game/PlayerList";
import type { GamePlayer, PlayerSymbol, StatusMessage } from "./GameWaiting";

interface GameWaitingMobileProps {
    gameCode: string;
    gamePlayers: GamePlayer[];
    playerSymbol: PlayerSymbol | null;
    isJoined: boolean;
    copySuccess: string | null;
    copySuccessFarcaster: string | null;
    error: string | null;
    loading: boolean;
    contractGameLoading: boolean;
    actionLoading: boolean;
    countdown: number;
    statusMessages: StatusMessage[];
    isHost: boolean;
    SYMBOLS: PlayerSymbol[];
    DUMMY_GAME_CONFIG: any;
    gameUrl: string;
    farcasterMiniappUrl: string;
    telegramShareUrl: string;
    twitterShareUrl: string;
    farcasterShareUrl: string;
    canStartGame: boolean;
    availableSymbols: PlayerSymbol[];
    playersJoinedCount: number;
    maxPlayersThreshold: number;
    setPlayerSymbol: (symbol: PlayerSymbol | null) => void;
    handleCopyLink: () => void;
    handleCopyFarcasterLink: () => void;
    handleJoinGame: () => void;
    handleLeaveGame: () => void;
    handleStartGame: () => void;
    handleGoHome: () => void;
    navigateToSettings: () => void;
}

export function GameWaitingMobile({
    gameCode,
    gamePlayers,
    playerSymbol,
    isJoined,
    copySuccess,
    copySuccessFarcaster,
    error,
    loading,
    contractGameLoading,
    actionLoading,
    countdown,
    statusMessages,
    isHost,
    SYMBOLS,
    DUMMY_GAME_CONFIG,
    gameUrl,
    farcasterMiniappUrl,
    telegramShareUrl,
    twitterShareUrl,
    farcasterShareUrl,
    canStartGame,
    availableSymbols,
    playersJoinedCount,
    maxPlayersThreshold,
    setPlayerSymbol,
    handleCopyLink,
    handleCopyFarcasterLink,
    handleJoinGame,
    handleLeaveGame,
    handleStartGame,
    handleGoHome,
    navigateToSettings,
}: GameWaitingMobileProps): React.JSX.Element {
    // Loading fallback
    if (loading || contractGameLoading) {
        return (
            <section className="w-full min-h-dvh flex flex-col items-center justify-center bg-[#010F10] p-6">
                <Spinner size="lg" />
                <p className="text-[#00F0FF] text-xl mt-6 font-semibold font-orbitron animate-pulse text-center">
                    Entering the Lobby...
                </p>
            </section>
        );
    }

    // Error state
    if (error || !gamePlayers) {
        return (
            <section className="w-full min-h-dvh flex flex-col items-center justify-center bg-[#010F10] p-4">
                <div className="w-full max-w-sm space-y-6 text-center bg-[#0A1A1B] p-6 rounded-2xl shadow-lg border border-red-500/50">
                    <p className="text-red-400 text-xl font-bold font-orbitron animate-pulse">
                        {error ?? "Game Portal Closed"}
                    </p>
                    <div className="flex flex-col gap-4">
                        <button
                            type="button"
                            onClick={navigateToSettings}
                            className="w-full bg-[#00F0FF]/20 text-[#00F0FF] py-4 rounded-xl font-orbitron font-bold border border-[#00F0FF]/50 active:bg-[#00F0FF]/30 transition-all text-lg"
                        >
                            Retry Join
                        </button>
                        <button
                            type="button"
                            onClick={handleGoHome}
                            className="w-full bg-[#00F0FF]/20 text-[#00F0FF] py-4 rounded-xl font-orbitron font-bold border border-[#00F0FF]/50 active:bg-[#00F0FF]/30 transition-all text-lg"
                        >
                            Return to Base
                        </button>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="w-full min-h-dvh bg-settings bg-cover bg-fixed bg-center">
            <main className="w-full min-h-full flex flex-col bg-[#010F10]/95 px-4 py-6">

                {/* Header - Game Code Stacked */}
                <div className="flex flex-col items-center mb-6 pt-4">
                    <h2 className="text-3xl font-bold font-orbitron text-[#F0F7F7] tracking-wider mb-2">
                        Lobby
                    </h2>
                    <div className="bg-[#0A1A1B] border-2 border-[#00F0FF] px-8 py-3 rounded-xl shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                        <span className="text-[#00F0FF] font-black text-2xl tracking-[0.2em]">
                            {gameCode}
                        </span>
                    </div>
                </div>

                {/* Status / Countdown */}
                <div className="bg-[#0A1A1B]/80 rounded-2xl border border-[#00F0FF]/30 p-5 mb-6 shadow-lg">
                    <p className="text-center text-[#869298] font-semibold mb-3 text-sm">
                        {playersJoinedCount === maxPlayersThreshold
                            ? "Full House! Game Starting Soon..."
                            : "Waiting for Allies..."}
                    </p>

                    <div className="w-full bg-[#003B3E]/50 h-3 rounded-full overflow-hidden shadow-inner mb-4">
                        <div
                            className="bg-linear-to-r from-[#00F0FF] to-[#00FFAA] h-full transition-all duration-500"
                            style={{ width: `${(playersJoinedCount / maxPlayersThreshold) * 100}%` }}
                        />
                    </div>

                    <div className="flex justify-between items-center px-1">
                        <p className="text-[#00F0FF] font-bold flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            {playersJoinedCount}/{maxPlayersThreshold}
                        </p>
                        <p className="text-yellow-400 font-bold flex items-center gap-2">
                            <Coins className="w-5 h-5" />
                            {DUMMY_GAME_CONFIG.stakeLabel}
                        </p>
                    </div>

                    <div className="mt-4 text-center">
                        <p className="text-[#869298] text-xs">
                            Starts in: <span className="text-[#00F0FF] font-bold text-lg">{countdown}s</span>
                        </p>
                    </div>
                </div>

                {/* Players List - Mobile Optimized */}
                <div className="mb-6">
                    <h3 className="text-[#00F0FF] font-orbitron font-bold mb-3 px-2">Players</h3>
                    <div className="bg-[#0A1A1B]/60 rounded-xl border border-[#00F0FF]/20 p-2">
                        <PlayerList
                            players={gamePlayers.map((p, i) => ({
                                id: p.address,
                                name: p.username,
                                symbol: p.symbol,
                                state: i === 0 ? ("host" as const) : undefined,
                            }))}
                            maxPlayers={maxPlayersThreshold}
                        />
                    </div>
                </div>

                {/* Action Area (Join / Start) */}
                {!isJoined ? (
                    <div className="bg-[#0A1A1B]/90 rounded-2xl border border-[#00F0FF]/50 p-5 mb-6 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
                        <label htmlFor="symbol-mobile" className="block text-[#00F0FF] font-orbitron font-bold mb-3 text-center">
                            Select Your Token
                        </label>
                        <select
                            id="symbol-mobile"
                            value={playerSymbol?.value ?? ""}
                            onChange={(e) => {
                                const selected = SYMBOLS.find((s) => s.value === e.target.value);
                                setPlayerSymbol(selected ?? null);
                            }}
                            className="w-full bg-[#010F10] text-white p-4 rounded-xl border border-[#00F0FF]/40 focus:ring-2 focus:ring-[#00F0FF] text-lg font-orbitron mb-5 appearance-none text-center"
                        >
                            <option value="" disabled>Tap to choose...</option>
                            {availableSymbols.map((symbol) => (
                                <option key={symbol.value} value={symbol.value}>
                                    {symbol.emoji} {symbol.name}
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={handleJoinGame}
                            disabled={!playerSymbol || actionLoading}
                            className="w-full bg-linear-to-r from-[#00F0FF] to-[#FF00FF] text-black text-lg font-orbitron font-black py-4 rounded-xl active:scale-95 transition-transform shadow-[0_0_15px_rgba(0,240,255,0.4)] disabled:opacity-50"
                        >
                            {actionLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "JOIN BATTLE"}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 mb-6">
                        {isHost && (
                            <button
                                type="button"
                                onClick={handleStartGame}
                                disabled={!canStartGame}
                                className="w-full bg-linear-to-r from-[#00F0FF] to-[#00FFAA] text-black text-lg font-orbitron font-black py-4 rounded-xl active:scale-95 transition-transform shadow-[0_0_15px_rgba(0,255,170,0.4)] disabled:opacity-50"
                            >
                                START GAME
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleLeaveGame}
                            disabled={actionLoading}
                            className="w-full bg-linear-to-r from-[#FF4D4D] to-[#FF00AA] text-white text-lg font-orbitron font-bold py-4 rounded-xl active:scale-95 transition-transform shadow-lg border border-red-500/50 disabled:opacity-50"
                        >
                            {actionLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "LEAVE LOBBY"}
                        </button>
                    </div>
                )}

                {/* Share Section - Large touch targets */}
                <div className="bg-[#0A1A1B]/80 rounded-2xl border border-[#00F0FF]/30 p-5 mb-6">
                    <h3 className="text-center text-[#00F0FF] font-bold font-orbitron mb-4">Invite Friends</h3>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <button
                            onClick={handleCopyLink}
                            className="flex flex-col items-center justify-center bg-[#010F10] border border-[#00F0FF]/30 p-4 rounded-xl active:bg-[#00F0FF]/20 transition-colors"
                        >
                            <Copy className="w-6 h-6 text-[#00F0FF] mb-2" />
                            <span className="text-xs text-[#F0F7F7]">{copySuccess ? "Copied!" : "Copy Link"}</span>
                        </button>

                        <a
                            href={telegramShareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center bg-[#010F10] border border-[#00F0FF]/30 p-4 rounded-xl active:bg-[#00F0FF]/20 transition-colors"
                        >
                            <Send className="w-6 h-6 text-[#00F0FF] mb-2" />
                            <span className="text-xs text-[#F0F7F7]">Telegram</span>
                        </a>

                        <a
                            href={twitterShareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center bg-[#010F10] border border-[#00F0FF]/30 p-4 rounded-xl active:bg-[#00F0FF]/20 transition-colors"
                        >
                            <Share2 className="w-6 h-6 text-[#00F0FF] mb-2" />
                            <span className="text-xs text-[#F0F7F7]">X / Twitter</span>
                        </a>

                        <a
                            href={farcasterShareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center bg-[#010F10] border border-[#00F0FF]/30 p-4 rounded-xl active:bg-[#00F0FF]/20 transition-colors"
                        >
                            <MessageCircle className="w-6 h-6 text-[#00F0FF] mb-2" />
                            <span className="text-xs text-[#F0F7F7]">Farcaster</span>
                        </a>
                    </div>
                </div>

                {/* Status Messages - Simplified for mobile */}
                <div className="bg-[#0A1A1B]/60 p-4 rounded-xl border border-[#00F0FF]/20 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <MessageCircle className="w-4 h-4 text-[#00F0FF]" />
                        <span className="text-sm font-bold text-[#00F0FF]">Activity log</span>
                    </div>
                    <div className="space-y-2 max-h-24 overflow-y-auto pr-2">
                        {statusMessages.slice(-3).map((msg) => (
                            <p key={msg.id} className="text-xs text-[#869298] truncate">
                                <span className="text-[#00F0FF]/50 mr-2">
                                    [{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]
                                </span>
                                {msg.text}
                            </p>
                        ))}
                    </div>
                </div>

                {/* Footer Navigation */}
                <div className="mt-auto pt-4 flex justify-between px-2 pb-6">
                    <button
                        onClick={navigateToSettings}
                        className="text-[#00F0FF]/80 text-sm font-orbitron underline active:text-[#00F0FF] p-2 -ml-2"
                    >
                        Settings
                    </button>
                    <button
                        onClick={handleGoHome}
                        className="flex items-center text-[#00F0FF]/80 text-sm font-orbitron underline active:text-[#00F0FF] p-2 -mr-2"
                    >
                        <Home className="w-4 h-4 mr-1" /> Home
                    </button>
                </div>

            </main>
        </section>
    );
}

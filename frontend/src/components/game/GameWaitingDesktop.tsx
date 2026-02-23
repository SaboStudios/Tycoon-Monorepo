"use client";

import React, { useMemo } from "react";
import { Copy, Home, Coins, Share2, Send, MessageCircle, Users, Loader2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { PlayerList } from "@/components/game/PlayerList";

// Import types from the future container (we'll move them to a shared types file or keep them in GameWaiting)
import type { GamePlayer, PlayerSymbol, StatusMessage } from "./GameWaiting";

interface GameWaitingDesktopProps {
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
    // Handlers
    setPlayerSymbol: (symbol: PlayerSymbol | null) => void;
    handleCopyLink: () => void;
    handleCopyFarcasterLink: () => void;
    handleJoinGame: () => void;
    handleLeaveGame: () => void;
    handleStartGame: () => void;
    handleGoHome: () => void;
    navigateToSettings: () => void;
}

export function GameWaitingDesktop({
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
}: GameWaitingDesktopProps): React.JSX.Element {
    const showShareSection = true;

    // Loading fallback
    if (loading || contractGameLoading) {
        return (
            <section className="w-full min-h-[calc(100dvh-87px)] flex items-center justify-center bg-[#010F10]">
                <div className="flex flex-col items-center gap-4">
                    <Spinner size="lg" />
                    <p className="text-[#00F0FF] text-lg font-semibold font-orbitron animate-pulse">
                        Entering the Lobby...
                    </p>
                </div>
            </section>
        );
    }

    // Error state
    if (error || !gamePlayers) {
        return (
            <section className="w-full min-h-[calc(100dvh-87px)] flex items-center justify-center bg-[#010F10]">
                <div className="space-y-3 text-center bg-[#0A1A1B]/80 p-6 rounded-xl shadow-lg border border-red-500/50">
                    <p className="text-red-400 text-lg font-bold font-orbitron animate-pulse">
                        {error ?? "Game Portal Closed"}
                    </p>
                    <div className="flex gap-3 justify-center flex-wrap">
                        <button
                            type="button"
                            onClick={navigateToSettings}
                            className="bg-[#00F0FF]/20 text-[#00F0FF] px-5 py-2 rounded-lg font-orbitron font-bold border border-[#00F0FF]/50 hover:bg-[#00F0FF]/30 transition-all shadow-md hover:shadow-[#00F0FF]/50"
                        >
                            Retry Join
                        </button>
                        <button
                            type="button"
                            onClick={handleGoHome}
                            className="bg-[#00F0FF]/20 text-[#00F0FF] px-5 py-2 rounded-lg font-orbitron font-bold border border-[#00F0FF]/50 hover:bg-[#00F0FF]/30 transition-all shadow-md hover:shadow-[#00F0FF]/50"
                        >
                            Return to Base
                        </button>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="w-full min-h-[calc(100dvh-87px)] bg-settings bg-cover bg-fixed bg-center">
            <main className="w-full min-h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#010F10]/90 to-[#010F10]/50 px-4 sm:px-6 py-8">
                <div className="w-full max-w-xl bg-[#0A1A1B]/80 p-5 sm:p-6 rounded-2xl shadow-2xl border border-[#00F0FF]/50 backdrop-blur-md">
                    {/* Header & Game Code */}
                    <h2 className="text-2xl sm:text-3xl font-bold font-orbitron mb-6 text-[#F0F7F7] text-center tracking-widest bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] bg-clip-text text-transparent">
                        Tycoon Lobby
                        <span className="block text-base text-[#00F0FF] mt-1 font-extrabold">
                            Code: {gameCode}
                        </span>
                    </h2>

                    {/* Player count & progress */}
                    <div className="text-center space-y-3 mb-6">
                        <p className="text-[#869298] text-sm font-semibold">
                            {playersJoinedCount === maxPlayersThreshold
                                ? "Full House! Game Starting Soon..."
                                : "Assemble Your Rivals..."}
                        </p>
                        <div className="w-full bg-[#003B3E]/50 h-2 rounded-full overflow-hidden shadow-inner">
                            <div
                                className="bg-gradient-to-r from-[#00F0FF] to-[#00FFAA] h-full transition-all duration-500 ease-out"
                                style={{ width: `${(playersJoinedCount / maxPlayersThreshold) * 100}%` }}
                            />
                        </div>
                        <p className="text-[#00F0FF] text-lg font-bold flex items-center justify-center gap-2">
                            <Users className="w-5 h-5" />
                            Players Ready: {playersJoinedCount}/{maxPlayersThreshold}
                        </p>
                        <p className="text-yellow-400 text-lg font-bold flex items-center justify-center gap-2 animate-pulse">
                            <Coins className="w-6 h-6" />
                            Entry Stake: {DUMMY_GAME_CONFIG.stakeLabel}
                        </p>

                        {/* Mock auto-start countdown */}
                        <p className="text-[#869298] text-xs">
                            Auto-start in: <span className="text-[#00F0FF] font-bold">{countdown}s</span>
                        </p>

                        {/* Player slots (reusable PlayerList) */}
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

                    {/* Chat / Status messages */}
                    <div className="mb-6 bg-[#010F10]/50 p-4 rounded-xl border border-[#00F0FF]/30 max-h-32 overflow-y-auto">
                        <h3 className="text-sm font-bold text-[#00F0FF] mb-2 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4" />
                            Status
                        </h3>
                        <ul className="space-y-1 text-xs text-[#869298]">
                            {statusMessages.slice(-5).map((msg: StatusMessage) => (
                                <li key={msg.id} className="flex items-start gap-2">
                                    <span className="text-[#00F0FF]/70 shrink-0">
                                        [{msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}]
                                    </span>
                                    <span>{msg.text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Share section */}
                    {showShareSection && (
                        <div className="mt-6 space-y-5 bg-[#010F10]/50 p-5 rounded-xl border border-[#00F0FF]/30 shadow-lg">
                            <h3 className="text-lg font-bold text-[#00F0FF] text-center mb-3">
                                Summon Allies!
                            </h3>

                            <div className="space-y-2">
                                <p className="text-[#869298] text-xs text-center">Web Link</p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        aria-label="game url"
                                        value={gameUrl}
                                        readOnly
                                        className="w-full bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded-lg border border-[#00F0FF]/50 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron text-xs shadow-inner"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCopyLink}
                                        disabled={actionLoading}
                                        className="flex items-center justify-center bg-gradient-to-r from-[#00F0FF] to-[#00FFAA] text-black p-2 rounded-lg hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 disabled:opacity-50"
                                    >
                                        <Copy className="w-5 h-5" />
                                    </button>
                                </div>
                                {copySuccess && (
                                    <p className="text-green-400 text-xs text-center">{copySuccess}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <p className="text-[#869298] text-xs text-center">Farcaster Miniapp Link</p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        aria-label="farcaster miniapp url"
                                        value={farcasterMiniappUrl}
                                        readOnly
                                        className="w-full bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded-lg border border-[#00F0FF]/50 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron text-xs shadow-inner"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCopyFarcasterLink}
                                        disabled={actionLoading}
                                        className="flex items-center justify-center bg-gradient-to-r from-[#A100FF] to-[#00F0FF] text-white p-2 rounded-lg hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 disabled:opacity-50"
                                    >
                                        <Copy className="w-5 h-5" />
                                    </button>
                                </div>
                                {copySuccessFarcaster && (
                                    <p className="text-green-400 text-xs text-center">{copySuccessFarcaster}</p>
                                )}
                            </div>

                            <div className="flex justify-center gap-5 pt-3">
                                <a
                                    href={telegramShareUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] p-3 rounded-full border border-[#00F0FF]/50 hover:bg-[#00F0FF]/20 transition-all duration-300 shadow-md hover:shadow-[#00F0FF]/50 hover:scale-110"
                                    aria-label="Share on Telegram"
                                >
                                    <Send className="w-6 h-6" />
                                </a>
                                <a
                                    href={twitterShareUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] p-3 rounded-full border border-[#00F0FF]/50 hover:bg-[#00F0FF]/20 transition-all duration-300 shadow-md hover:shadow-[#00F0FF]/50 hover:scale-110"
                                    aria-label="Share on X"
                                >
                                    <Share2 className="w-6 h-6" />
                                </a>
                                <a
                                    href={farcasterShareUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] p-3 rounded-full border border-[#00F0FF]/50 hover:bg-[#00F0FF]/20 transition-all duration-300 shadow-md hover:shadow-[#00F0FF]/50 hover:scale-110"
                                    aria-label="Share on Farcaster"
                                >
                                    <MessageCircle className="w-6 h-6" />
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Join flow (if not joined) */}
                    {!isJoined && (
                        <div className="mt-6 space-y-5">
                            <div className="flex flex-col bg-[#010F10]/50 p-5 rounded-xl border border-[#00F0FF]/30 shadow-lg">
                                <label
                                    htmlFor="symbol"
                                    className="text-sm text-[#00F0FF] mb-1 font-orbitron font-bold"
                                >
                                    Pick Your Token
                                </label>
                                <select
                                    id="symbol"
                                    value={playerSymbol?.value ?? ""}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                        const selected = SYMBOLS.find((s) => s.value === e.target.value);
                                        setPlayerSymbol(selected ?? null);
                                    }}
                                    className="bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded-lg border border-[#00F0FF]/50 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron text-sm shadow-inner"
                                >
                                    <option value="" disabled>
                                        Select Token
                                    </option>
                                    {availableSymbols.length > 0 ? (
                                        availableSymbols.map((symbol: PlayerSymbol) => (
                                            <option key={symbol.value} value={symbol.value}>
                                                {symbol.emoji} {symbol.name}
                                            </option>
                                        ))
                                    ) : (
                                        <option disabled>No Tokens Left</option>
                                    )}
                                </select>
                            </div>

                            <button
                                type="button"
                                onClick={handleJoinGame}
                                disabled={!playerSymbol || actionLoading}
                                className="w-full bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] text-black text-sm font-orbitron font-extrabold py-3 rounded-xl hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-[#00F0FF]/50 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {actionLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Entering...
                                    </span>
                                ) : (
                                    "Join the Battle"
                                )}
                            </button>
                        </div>
                    )}

                    {/* Host: Start Game button (enabled when min players joined) */}
                    {isHost && isJoined && (
                        <button
                            type="button"
                            onClick={handleStartGame}
                            disabled={!canStartGame}
                            className="w-full mt-6 bg-gradient-to-r from-[#00F0FF] to-[#00FFAA] text-black text-sm font-orbitron font-extrabold py-3 rounded-xl hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-[#00F0FF]/50 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            Start Game
                        </button>
                    )}

                    {/* Leave game (when joined) */}
                    {isJoined && (
                        <button
                            type="button"
                            onClick={handleLeaveGame}
                            disabled={actionLoading}
                            className="w-full mt-4 bg-gradient-to-r from-[#FF4D4D] to-[#FF00AA] text-white text-sm font-orbitron font-extrabold py-3 rounded-xl hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-red-500/50 hover:scale-[1.02] disabled:opacity-50"
                        >
                            {actionLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Exiting...
                                </span>
                            ) : (
                                "Abandon Ship"
                            )}
                        </button>
                    )}

                    {/* Footer links */}
                    <div className="flex justify-between mt-5 px-3 flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={navigateToSettings}
                            className="text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200 hover:underline"
                        >
                            Switch Portal
                        </button>
                        <button
                            type="button"
                            onClick={handleGoHome}
                            className="flex items-center text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200 hover:underline"
                        >
                            <Home className="mr-1 w-4 h-4" /> Back to HQ
                        </button>
                    </div>

                    {error && (
                        <p className="text-red-400 text-xs mt-3 text-center bg-red-900/50 p-2 rounded-lg">
                            {error}
                        </p>
                    )}
                </div>
            </main>
        </section>
    );
}

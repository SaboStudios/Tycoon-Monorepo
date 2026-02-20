"use client";
// Guest (no-wallet) support: useWaitingRoom() handles guestUser for join, isCreator, checkPlayerJoined. Guests join via POST /games/join-as-guest.

import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { PiTelegramLogoLight } from "react-icons/pi";
import { FaXTwitter, FaCoins } from "react-icons/fa6";
import { SiFarcaster } from "react-icons/si";
import { IoCopyOutline, IoHomeOutline } from "react-icons/io5";
import { useWaitingRoom, USDC_DECIMALS } from "./useWaitingRoom";
import { getPlayerSymbolData, symbols } from "@/lib/types/symbol";
import GameRoomLoading from "./game-room-loading";

export default function GameWaiting(): JSX.Element {
  const {
    router,
    gameCode,
    game,
    playerSymbol,
    setPlayerSymbol,
    availableSymbols,
    isJoined,
    copySuccess,
    copySuccessFarcaster,
    error,
    loading,
    actionLoading,
    contractGameLoading,
    contractGameError,
    stakePerPlayer,
    approvePending,
    approveConfirming,
    isJoining,
    joinError,
    gameUrl,
    farcasterMiniappUrl,
    telegramShareUrl,
    twitterShareUrl,
    farcasterShareUrl,
    showShare,
    handleCopyLink,
    handleCopyFarcasterLink,
    playersJoined,
    maxPlayers,
    handleJoinGame,
    handleLeaveGame,
    handleGoHome,
    isCreator,
    guestCannotJoinStaked,
  } = useWaitingRoom();

  // Loading / Error guards
  if (loading || contractGameLoading) {
    return <GameRoomLoading variant="waiting" />;
  }

  if (error || !game) {
    const needsGuestSignIn = error?.toLowerCase().includes("sign in as guest");
    return (
      <section className="w-full h-[calc(100dvh-87px)] flex items-center justify-center bg-gray-900">
        <div className="space-y-3 text-center bg-[#0A1A1B]/80 p-6 rounded-xl shadow-lg border border-red-500/50">
          <p className="text-red-400 text-lg font-bold font-orbitron animate-pulse">
            {error ?? "Game Portal Closed"}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={() => router.push("/join-room")}
              className="bg-[#00F0FF]/20 text-[#00F0FF] px-5 py-2 rounded-lg font-orbitron font-bold border border-[#00F0FF]/50 hover:bg-[#00F0FF]/30 transition-all shadow-md hover:shadow-[#00F0FF]/50"
            >
              {needsGuestSignIn ? "Go to Join Room" : "Retry Join"}
            </button>
            {needsGuestSignIn && (
              <button
                type="button"
                onClick={() => router.push("/")}
                className="bg-[#00F0FF]/20 text-[#00F0FF] px-5 py-2 rounded-lg font-orbitron font-bold border border-[#00F0FF]/50 hover:bg-[#00F0FF]/30 transition-all shadow-md hover:shadow-[#00F0FF]/50"
              >
                Sign in as guest (home)
              </button>
            )}
            <button
              type="button"
              onClick={handleGoHome}
              className="bg-[#00F0FF]/20 text-[#00F0FF] px-5 py-2 rounded-lg font-orbitron font-bold border border-[#00F0FF]/50 hover:bg-[#00F0FF]/30 transition-all shadow-md hover:shadow-[#00F0FF]/50"
            >
              Return to Celo
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full min-h-[calc(100dvh-87px)] bg-settings bg-cover bg-fixed bg-center">
      <main className="w-full min-h-full flex flex-col bg-gradient-to-b from-[#010F10]/90 to-[#010F10]/50 px-4 sm:px-6">
        {/* Top bar */}
        <div className="w-full max-w-xl mx-auto py-4 flex justify-center">
          <h1 className="text-lg sm:text-xl font-orbitron font-extrabold tracking-widest text-[#F0F7F7]">
            Tycoon Lobby
          </h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center pb-8">
        <div className="w-full max-w-xl bg-[#0A1A1B]/80 p-5 sm:p-6 rounded-2xl shadow-2xl border border-[#00F0FF]/50 backdrop-blur-md">
          <h2 className="text-xl sm:text-2xl font-bold font-orbitron mb-2 text-[#F0F7F7] text-center tracking-widest bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] bg-clip-text text-transparent">
            Tycoon Lobby
          </h2>

          {!isCreator && (
            <p className="text-center text-[#00F0FF] font-orbitron font-bold text-sm mb-4">Code: {gameCode}</p>
          )}

          {/* Game details card */}
          <div className="mb-6 p-4 rounded-xl bg-[#010F10]/70 border border-[#00F0FF]/30 space-y-3">
            <h3 className="text-sm font-orbitron font-bold text-[#00F0FF] tracking-widest uppercase">Game details</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-[#869298]">Mode</span>
              <span className="text-[#F0F7F7] font-semibold">{game.mode ?? "PRIVATE"}</span>
              <span className="text-[#869298]">Players</span>
              <span className="text-[#F0F7F7] font-semibold">{game.number_of_players} max</span>
              <span className="text-[#869298]">Starting cash</span>
              <span className="text-[#F0F7F7] font-semibold">${(game.settings as any)?.starting_cash ?? 1500}</span>
              {(game as any)?.duration != null && Number((game as any).duration) > 0 && (
                <>
                  <span className="text-[#869298]">Duration</span>
                  <span className="text-[#F0F7F7] font-semibold">{(game as any).duration} min</span>
                </>
              )}
            </div>
            <div className="pt-2 border-t border-[#00F0FF]/20">
              <p className="text-[#869298] text-xs font-orbitron mb-1.5">House rules</p>
              <div className="flex flex-wrap gap-2">
                {(game.settings as any)?.auction && (
                  <span className="px-2 py-0.5 rounded-md bg-[#00F0FF]/15 text-[#00F0FF] text-xs">Auction</span>
                )}
                {(game.settings as any)?.mortgage && (
                  <span className="px-2 py-0.5 rounded-md bg-[#00F0FF]/15 text-[#00F0FF] text-xs">Mortgage</span>
                )}
                {(game.settings as any)?.even_build && (
                  <span className="px-2 py-0.5 rounded-md bg-[#00F0FF]/15 text-[#00F0FF] text-xs">Even build</span>
                )}
                {(game.settings as any)?.randomize_play_order && (
                  <span className="px-2 py-0.5 rounded-md bg-[#00F0FF]/15 text-[#00F0FF] text-xs">Random order</span>
                )}
                {(game.settings as any)?.rent_in_prison && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-xs">Rent in jail</span>
                )}
              </div>
            </div>
            {(game as any)?.is_ai && (
              <p className="text-cyan-400/90 text-xs font-semibold flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                AI game
              </p>
            )}
          </div>

          {/* Non-creator: show Join first so they prioritise picking symbol + joining */}
          {!isCreator && game.players.length < game.number_of_players && !isJoined && (
            <div className="mb-6 space-y-5">
              <div className="flex flex-col bg-[#010F10]/50 p-5 rounded-xl border border-[#00F0FF]/30 shadow-lg">
                <label
                  htmlFor="symbol-joiner"
                  className="text-sm text-[#00F0FF] mb-1 font-orbitron font-bold"
                >
                  Pick Your Token
                </label>
                <select
                  id="symbol-joiner"
                  value={playerSymbol?.value ?? ""}
                  onChange={(e) =>
                    setPlayerSymbol(getPlayerSymbolData(e.target.value) ?? null)
                  }
                  className="bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded-lg border border-[#00F0FF]/50 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron text-sm shadow-inner"
                >
                  <option value="" disabled>
                    Select Token
                  </option>
                  {availableSymbols.length > 0 ? (
                    availableSymbols.map((symbol) => (
                      <option key={symbol.value} value={symbol.value}>
                        {symbol.emoji} {symbol.name}
                      </option>
                    ))
                  ) : (
                    <option disabled>No Tokens Left</option>
                  )}
                </select>
              </div>
              {guestCannotJoinStaked && (
                <p className="text-amber-400 text-sm text-center bg-amber-900/30 p-3 rounded-xl border border-amber-500/40">
                  Guests cannot join staked games. Connect a wallet to join this game.
                </p>
              )}
              <button
                type="button"
                onClick={handleJoinGame}
                className="w-full bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] text-black text-sm font-orbitron font-extrabold py-3 rounded-xl hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-[#00F0FF]/50 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!playerSymbol || actionLoading || isJoining || approvePending || approveConfirming || guestCannotJoinStaked}
              >
                {actionLoading || isJoining || approvePending || approveConfirming ? "Entering..." : "Join the Battle"}
              </button>
            </div>
          )}

          <div className="text-center space-y-3 mb-6">
            <p className="text-[#869298] text-sm font-semibold">
              {playersJoined === maxPlayers
                ? "Full House! Game Starting Soon..."
                : "Assemble Your Rivals..."}
            </p>
            <div className="w-full bg-[#003B3E]/50 h-2 rounded-full overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-[#00F0FF] to-[#00FFAA] h-full transition-all duration-500 ease-out"
                style={{ width: `${(playersJoined / maxPlayers) * 100}%` }}
              ></div>
            </div>
            <p className="text-[#00F0FF] text-lg font-bold">
              Players Ready: {playersJoined}/{maxPlayers}
            </p>
            {stakePerPlayer > 0 ? (
              <p className="text-yellow-400 text-lg font-bold flex items-center justify-center gap-2 animate-pulse">
                <FaCoins className="w-6 h-6" />
                Entry Stake: {Number(stakePerPlayer) / 10 ** USDC_DECIMALS}
                USDC
              </p>
            ) : (
              <p className="text-green-400 text-base font-bold">
                Free Practice Game – No Stake Required
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 justify-center">
              {Array.from({ length: maxPlayers }).map((_, index) => {
                const player = game.players[index];
                return (
                  <div
                    key={index}
                    className="bg-[#010F10]/70 p-3 rounded-lg border border-[#00F0FF]/30 flex flex-col items-center justify-center shadow-md hover:shadow-[#00F0FF]/50 transition-shadow duration-300"
                  >
                    <span className="text-4xl mb-1 animate-bounce-slow">
                      {player
                        ? symbols.find((s) => s.value === player.symbol)?.emoji
                        : "❓"}
                    </span>
                    <p className="text-[#F0F7F7] text-xs font-semibold truncate max-w-[80px]">
                      {player?.username || "Slot Open"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {showShare && isCreator && (
            <div className="mt-6 space-y-5 bg-[#010F10]/50 p-5 rounded-xl border border-[#00F0FF]/30 shadow-lg">
              <h3 className="text-lg font-bold text-[#00F0FF] text-center mb-4 tracking-widest">
                Summon Allies!
              </h3>

              {/* QR + Code block - gamy focal point */}
              <div className="flex flex-col items-center gap-6 p-5 rounded-xl bg-[#010F10]/80 border border-[#00F0FF]/40 shadow-[inset_0_0_30px_rgba(0,240,255,0.05)]">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-orbitron font-bold text-[#00F0FF] tracking-[0.3em] mb-2 opacity-90">SCAN TO JOIN</span>
                  <div className="p-3 rounded-xl bg-white border-2 border-[#00F0FF]/60 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
                    <QRCodeSVG
                      value={gameUrl}
                      size={160}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#0E282A"
                      marginSize={1}
                    />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-orbitron font-bold text-[#869298] tracking-[0.2em]">GAME CODE</span>
                  <p className="font-orbitron font-black text-4xl sm:text-5xl text-[#00F0FF] tracking-widest tabular-nums text-center" style={{ textShadow: "0 0 20px rgba(0,240,255,0.4)" }}>
                    {gameCode}
                  </p>
                  <p className="text-[#869298] text-xs font-dmSans max-w-[240px] text-center">
                    Share this code or scan the QR to join the lobby.
                  </p>
                </div>
              </div>

              {/* Links row */}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <p className="text-[#869298] text-xs text-center font-orbitron">Web Link</p>
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
                      className="flex items-center justify-center bg-gradient-to-r from-[#00F0FF] to-[#00FFAA] text-black p-2 rounded-lg hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-[0_0_12px_rgba(0,240,255,0.4)] shrink-0"
                    >
                      <IoCopyOutline className="w-5 h-5" />
                    </button>
                  </div>
                  {copySuccess && (
                    <p className="text-green-400 text-xs text-center animate-fade-in">
                      {copySuccess}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-[#869298] text-xs text-center font-orbitron">Farcaster Miniapp</p>
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
                      className="flex items-center justify-center bg-gradient-to-r from-[#A100FF] to-[#00F0FF] text-white p-2 rounded-lg hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg shrink-0"
                    >
                      <IoCopyOutline className="w-5 h-5" />
                    </button>
                  </div>
                  {copySuccessFarcaster && (
                    <p className="text-green-400 text-xs text-center animate-fade-in">
                      {copySuccessFarcaster}
                    </p>
                  )}
                </div>
              </div>

              {/* Social share */}
              <div className="flex justify-center gap-5 pt-2">
                <a
                  href={telegramShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] p-3 rounded-full border border-[#00F0FF]/50 hover:bg-[#00F0FF]/20 transition-all duration-300 shadow-md hover:shadow-[0_0_16px_rgba(0,240,255,0.3)] transform hover:scale-110"
                >
                  <PiTelegramLogoLight className="w-6 h-6" />
                </a>
                <a
                  href={twitterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] p-3 rounded-full border border-[#00F0FF]/50 hover:bg-[#00F0FF]/20 transition-all duration-300 shadow-md hover:shadow-[0_0_16px_rgba(0,240,255,0.3)] transform hover:scale-110"
                >
                  <FaXTwitter className="w-6 h-6" />
                </a>
                <a
                  href={farcasterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] p-3 rounded-full border border-[#00F0FF]/50 hover:bg-[#00F0FF]/20 transition-all duration-300 shadow-md hover:shadow-[0_0_16px_rgba(0,240,255,0.3)] transform hover:scale-110"
                >
                  <SiFarcaster className="w-6 h-6" />
                </a>
              </div>
            </div>
          )}

          {game.players.length < game.number_of_players && !isJoined && isCreator && (
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
                  onChange={(e) =>
                    setPlayerSymbol(getPlayerSymbolData(e.target.value) ?? null)
                  }
                  className="bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded-lg border border-[#00F0FF]/50 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron text-sm shadow-inner"
                >
                  <option value="" disabled>
                    Select Token
                  </option>
                  {availableSymbols.length > 0 ? (
                    availableSymbols.map((symbol) => (
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
                className="w-full bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] text-black text-sm font-orbitron font-extrabold py-3 rounded-xl hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-[#00F0FF]/50 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!playerSymbol || actionLoading || isJoining || approvePending || approveConfirming || guestCannotJoinStaked}
              >
                {actionLoading || isJoining || approvePending || approveConfirming ? "Entering..." : "Join the Battle"}
              </button>
            </div>
          )}

          {game.players.length < game.number_of_players && isJoined && (
            <button
              type="button"
              onClick={handleLeaveGame}
              className="w-full mt-6 bg-gradient-to-r from-[#FF4D4D] to-[#FF00AA] text-white text-sm font-orbitron font-extrabold py-3 rounded-xl hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-red-500/50 transform hover:scale-105 disabled:opacity-50"
              disabled={actionLoading}
            >
              {actionLoading ? "Exiting..." : "Abandon Ship"}
            </button>
          )}

          <div className="flex justify-between mt-5 px-3">
            <button
              type="button"
              onClick={() => router.push("/join-room")}
              className="text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200 hover:underline"
            >
              Switch Portal
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              className="flex items-center text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200 hover:underline"
            >
              <IoHomeOutline className="mr-1 w-4 h-4" />
              Back to HQ
            </button>
          </div>

          {(error || guestCannotJoinStaked || joinError || contractGameError) && (
            <p className="text-red-400 text-xs mt-3 text-center bg-red-900/50 p-2 rounded-lg animate-pulse">
              {error ??
                (guestCannotJoinStaked ? "Guests cannot join staked games. Connect a wallet to join this game." : null) ??
                joinError?.message ??
                contractGameError?.message ??
                "System Glitch Detected"}
            </p>
          )}
        </div>
        </div>
      </main>
    </section>
  );
}
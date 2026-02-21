"use client";

import React, { useState } from "react";
import { TradeModal, TradePlayer } from "@/components/game/TradeModal";

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_PLAYERS: TradePlayer[] = [
    {
        id: "p1",
        name: "You (Alice)",
        cash: 1500,
        properties: [
            { name: "Park Place", color: "bg-blue-700", price: 350, type: "property" },
            { name: "Boardwalk", color: "bg-blue-700", price: 400, type: "property" },
            { name: "Reading Railroad", color: "bg-gray-800", price: 200, type: "railroad" },
            { name: "Water Works", color: "bg-yellow-400", price: 150, type: "utility" },
        ],
    },
    {
        id: "p2",
        name: "Bob",
        cash: 1200,
        properties: [
            { name: "Mediterranean Ave", color: "bg-purple-900", price: 60, type: "property" },
            { name: "Baltic Ave", color: "bg-purple-900", price: 60, type: "property" },
            { name: "Electric Company", color: "bg-yellow-400", price: 150, type: "utility" },
        ],
    },
    {
        id: "p3",
        name: "Carol",
        cash: 800,
        properties: [
            { name: "Oriental Ave", color: "bg-cyan-400", price: 100, type: "property" },
            { name: "Vermont Ave", color: "bg-cyan-400", price: 100, type: "property" },
            { name: "Connecticut Ave", color: "bg-cyan-400", price: 120, type: "property" },
        ],
    },
    {
        id: "p4",
        name: "Dave",
        cash: 950,
        properties: [
            { name: "St. Charles Place", color: "bg-pink-500", price: 140, type: "property" },
            { name: "B&O Railroad", color: "bg-gray-800", price: 200, type: "railroad" },
        ],
    },
];

// ─── Demo page ───────────────────────────────────────────────────────────────

export default function TradeModalDemo() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <main className="min-h-screen bg-[#010F10] flex flex-col items-center justify-center gap-8 p-8">
            {/* Header */}
            <div className="text-center space-y-3">
                <h1 className="text-3xl font-bold text-[#00F0FF] font-orbitron tracking-wider">
                    Trade Modal Demo
                </h1>
                <p className="text-[#F0F7F7]/60 text-sm max-w-md">
                    Click the button below to open the trade modal. You are playing as{" "}
                    <span className="text-[#00F0FF] font-semibold">Alice</span> with $1,500 and 4 properties.
                </p>
            </div>

            {/* Player cards preview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl">
                {MOCK_PLAYERS.map((player, i) => (
                    <div
                        key={player.id}
                        className={`rounded-lg border p-4 text-center transition-all ${i === 0
                                ? "border-[#00F0FF] bg-[#00F0FF]/10 shadow-[0_0_12px_rgba(0,240,255,0.2)]"
                                : "border-[#003B3E] bg-[#0E1415]/60"
                            }`}
                    >
                        <p className="text-2xl mb-1">{["🚢", "🚗", "✈️", "🚚"][i]}</p>
                        <p className={`text-sm font-semibold ${i === 0 ? "text-[#00F0FF]" : "text-[#F0F7F7]"}`}>
                            {player.name}
                        </p>
                        <p className="text-xs text-[#F0F7F7]/50 mt-1">${player.cash}</p>
                        <p className="text-[10px] text-[#F0F7F7]/40">
                            {player.properties.length} properties
                        </p>
                    </div>
                ))}
            </div>

            {/* Open button */}
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-[#00F0FF] px-8 py-3 text-base font-bold text-[#010F10] hover:bg-[#00F0FF]/80 shadow-[0_0_24px_rgba(0,240,255,0.35)] hover:shadow-[0_0_32px_rgba(0,240,255,0.5)] transition-all active:scale-95"
            >
                🤝 Open Trade Modal
            </button>

            {/* The modal */}
            <TradeModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                players={MOCK_PLAYERS}
                currentPlayer={MOCK_PLAYERS[0]}
            />
        </main>
    );
}

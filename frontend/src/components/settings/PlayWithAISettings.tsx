"use client"

import { useState } from "react"
import { ArrowLeft, Bot, Coins, Clock, Play, Shield, Gamepad2, Settings2, Wallet, Rocket } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"

// Mock Data
const PIECES = [
    { value: "rocket", label: "🚀 Stellar Rocket" },
    { value: "bull", label: "🐂 Market Bull" },
    { value: "racecar", label: "🏎️ Classic Racecar" },
    { value: "tophat", label: "🎩 Top Hat" },
]

const AI_OPPONENTS = [
    { value: "1", label: "1 Opponent" },
    { value: "2", label: "2 Opponents" },
    { value: "3", label: "3 Opponents" },
]

const DIFFICULTIES = [
    { value: "easy", label: "Novice (Standard)" },
    { value: "medium", label: "Trader (Strategic)" },
    { value: "hard", label: "Tycoon (Ruthless)" },
]

const DURATIONS = [
    { value: "30", label: "30 Minutes" },
    { value: "60", label: "1 Hour" },
    { value: "90", label: "1.5 Hours" },
    { value: "0", label: "Untimed (Until Bankruptcy)" },
]

const STARTING_CASH = [
    { value: "1500", label: "1,500 XLM" },
    { value: "2500", label: "2,500 XLM" },
    { value: "5000", label: "5,000 XLM" },
    { value: "10000", label: "10,000 XLM" },
]

export function PlayWithAISettings() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    // Form State
    const [piece, setPiece] = useState("rocket")
    const [opponents, setOpponents] = useState("3")
    const [difficulty, setDifficulty] = useState("medium")
    const [cash, setCash] = useState("1500")
    const [duration, setDuration] = useState("0")
    const [playerName, setPlayerName] = useState("Tycoon Player")

    // House Rules State
    const [freeParkingBonus, setFreeParkingBonus] = useState(false)
    const [doubleGoCash, setDoubleGoCash] = useState(false)
    const [auctionsEnabled, setAuctionsEnabled] = useState(true)

    const handleStartBattle = async () => {
        setIsLoading(true)

        // Simulate API call/processing
        await new Promise(resolve => setTimeout(resolve, 1500))

        const settings = {
            piece,
            opponents,
            difficulty,
            cash,
            duration,
            playerName,
            houseRules: { freeParkingBonus, doubleGoCash, auctionsEnabled }
        }

        console.log("Starting game with settings:", settings)
        const mockGameCode = Math.random().toString(36).substring(7).toUpperCase()

        toast.success("Initializing On-Chain Session... Minting Game Assets.")

        // Navigate to AI game with generated code
        router.push(`/ai-play/game/${mockGameCode}`)

        setIsLoading(false)
    }

    return (
        <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                    <span className="sr-only">Back</span>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Tycoon AI Arena</h1>
                    <p className="text-neutral-500 dark:text-neutral-400">Configure your session on the Stellar Network.</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Settings Column */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Player Setup Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Wallet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                Tycoon Identity
                            </CardTitle>
                            <CardDescription>Setup your digital presence.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="player-name">Wallet / Tycoon Name</Label>
                                <Input
                                    id="player-name"
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    placeholder="Enter your Alias"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Select Token</Label>
                                <Select
                                    value={piece}
                                    onChange={setPiece}
                                    options={PIECES}
                                    placeholder="Choose your token"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Match Configuration Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                Contract Settings
                            </CardTitle>
                            <CardDescription>Define the smart contract parameters.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-6 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>AI Competitors</Label>
                                    <Select
                                        value={opponents}
                                        onChange={setOpponents}
                                        options={AI_OPPONENTS}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Market Difficulty</Label>
                                    <Select
                                        value={difficulty}
                                        onChange={setDifficulty}
                                        options={DIFFICULTIES}
                                    />
                                    <p className="text-[0.8rem] text-neutral-500 dark:text-neutral-400">
                                        {difficulty === 'hard' && "Warning: Ruthless trading algorithms active."}
                                        {difficulty === 'medium' && "Balanced strategies."}
                                        {difficulty === 'easy' && "Conservative trading behavior."}
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-6 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Coins className="h-4 w-4" /> Initial Liquidity (XLM)
                                    </Label>
                                    <Select
                                        value={cash}
                                        onChange={setCash}
                                        options={STARTING_CASH}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Clock className="h-4 w-4" /> Session Limit
                                    </Label>
                                    <Select
                                        value={duration}
                                        onChange={setDuration}
                                        options={DURATIONS}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar / House Rules */}
                <div className="space-y-6">
                    <Card className="h-full border-indigo-100 bg-gradient-to-b from-white to-indigo-50/20 dark:border-indigo-900/50 dark:from-neutral-950 dark:to-indigo-950/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                Governance Rules
                            </CardTitle>
                            <CardDescription>Protocol modifiers.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between space-x-2">
                                <Label htmlFor="parking-bonus" className="flex flex-col space-y-1">
                                    <span>Free Parking Pool</span>
                                    <span className="font-normal text-xs text-neutral-500">Collect accumulated fees</span>
                                </Label>
                                <Switch
                                    id="parking-bonus"
                                    checked={freeParkingBonus}
                                    onCheckedChange={setFreeParkingBonus}
                                />
                            </div>
                            <div className="flex items-center justify-between space-x-2">
                                <Label htmlFor="double-go" className="flex flex-col space-y-1">
                                    <span>Double GO Yield</span>
                                    <span className="font-normal text-xs text-neutral-500">400 XLM on cycle completion</span>
                                </Label>
                                <Switch
                                    id="double-go"
                                    checked={doubleGoCash}
                                    onCheckedChange={setDoubleGoCash}
                                />
                            </div>
                            <div className="flex items-center justify-between space-x-2">
                                <Label htmlFor="auctions" className="flex flex-col space-y-1">
                                    <span>Asset Auctions</span>
                                    <span className="font-normal text-xs text-neutral-500">Auction unbought assets</span>
                                </Label>
                                <Switch
                                    id="auctions"
                                    checked={auctionsEnabled}
                                    onCheckedChange={setAuctionsEnabled}
                                />
                            </div>

                            <div className="mt-8 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/50 dark:bg-yellow-900/20">
                                <div className="flex items-start gap-3">
                                    <Bot className="mt-0.5 h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Simulation Mode</p>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                            You are initializing a match against {opponents} AI agent(s) on {difficulty} difficulty. Assets are tokenized on testnet.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end pt-4">
                <Button
                    size="lg"
                    className="w-full bg-indigo-600 text-lg hover:bg-indigo-700 md:w-auto dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-700 hover:cursor-pointer"
                    onClick={handleStartBattle}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>Spinning Up Nodes...</>
                    ) : (
                        <span className="flex items-center gap-2">Initialize Session <Rocket className="fill-current h-4 w-4" /></span>
                    )}
                </Button>
            </div>
        </div>
    )
}

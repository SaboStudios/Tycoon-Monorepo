"use client"

import * as React from "react"
import { ArrowLeft, Users, Lock, Unlock, Gavel, Coins, Clock, Rocket, Shield, Wallet } from "lucide-react"
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

const PLAYER_COUNTS = [
    { value: "2", label: "2 Players" },
    { value: "3", label: "3 Players" },
    { value: "4", label: "4 Players" },
    { value: "5", label: "5 Players" },
    { value: "6", label: "6 Players" },
    { value: "8", label: "8 Players (Max)" },
]

const ENTRY_STAKES = [
    { value: "100", label: "100 XLM" },
    { value: "500", label: "500 XLM" },
    { value: "1000", label: "1,000 XLM" },
    { value: "5000", label: "5,000 XLM" },
    { value: "custom", label: "Custom Amount" },
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
]

export function GameSettings() {
    const router = useRouter()
    const [isLoading, setIsLoading] = React.useState(false)

    // Form State
    const [playerName, setPlayerName] = React.useState("Tycoon Player")
    const [piece, setPiece] = React.useState("rocket")

    // Lobby Settings
    const [maxPlayers, setMaxPlayers] = React.useState("4")
    const [isPrivate, setIsPrivate] = React.useState(false)
    const [isFreeGame, setIsFreeGame] = React.useState(false)

    // Economics
    const [stakePreset, setStakePreset] = React.useState("100")
    const [customStake, setCustomStake] = React.useState("")
    const [startingCash, setStartingCash] = React.useState("1500")

    // Rules
    const [duration, setDuration] = React.useState("60")
    const [freeParkingBonus, setFreeParkingBonus] = React.useState(false)
    const [doubleGoCash, setDoubleGoCash] = React.useState(false)
    const [auctionsEnabled, setAuctionsEnabled] = React.useState(true)

    const handleCreateLobby = async () => {
        setIsLoading(true)

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000))

        const entryFee = isFreeGame ? 0 : (stakePreset === "custom" ? customStake : stakePreset)

        const settings = {
            host: { name: playerName, piece },
            lobby: { maxPlayers, isPrivate, entryFee },
            rules: { startingCash, duration, freeParkingBonus, doubleGoCash, auctionsEnabled }
        }

        console.log("Creating lobby with settings:", settings)
        const mockGameCode = Math.random().toString(36).substring(7).toUpperCase()

        toast.success("Deployed Smart Contract! Lobby Created.")

        // Navigate to waiting room (mock route)
        router.push(`/game-waiting?gameCode=${mockGameCode}`)

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
                    <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Create Multiplayer Lobby</h1>
                    <p className="text-neutral-500 dark:text-neutral-400">Host a game on the Stellar Network.</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Settings Column */}
                <div className="space-y-6 lg:col-span-2">

                    {/* Identity & Room Config */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                Lobby Configuration
                            </CardTitle>
                            <CardDescription>Setup your room and identity.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <div className="grid gap-6 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="player-name">Host Name</Label>
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
                            </div>

                            <div className="grid gap-6 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Max Players</Label>
                                    <Select
                                        value={maxPlayers}
                                        onChange={setMaxPlayers}
                                        options={PLAYER_COUNTS}
                                    />
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 shadow-sm dark:border-neutral-800">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Private Room</Label>
                                        <div className="text-xs text-neutral-500">
                                            {isPrivate ? <span className="flex items-center gap-1 text-amber-600"><Lock className="h-3 w-3" /> Invite Only</span> : <span className="flex items-center gap-1 text-green-600"><Unlock className="h-3 w-3" /> Public Listing</span>}
                                        </div>
                                    </div>
                                    <Switch
                                        checked={isPrivate}
                                        onCheckedChange={setIsPrivate}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Economics & Rules */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Gavel className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                Economic Protocol
                            </CardTitle>
                            <CardDescription>Define stakes and game parameters.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            {/* Entry Fee Section */}
                            <div className="rounded-lg bg-neutral-50 p-4 dark:bg-neutral-900/50">
                                <div className="flex items-center justify-between mb-4">
                                    <Label className="text-base font-semibold">Entry Stake</Label>
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="free-game" className="text-sm font-normal text-neutral-600 dark:text-neutral-400">Free Game (No XLM)</Label>
                                        <Switch id="free-game" checked={isFreeGame} onCheckedChange={setIsFreeGame} />
                                    </div>
                                </div>

                                {!isFreeGame && (
                                    <div className="grid gap-4 sm:grid-cols-2 animate-in fade-in slide-in-from-top-2">
                                        <div className="space-y-2">
                                            <Label>Stake Amount</Label>
                                            <Select
                                                value={stakePreset}
                                                onChange={setStakePreset}
                                                options={ENTRY_STAKES}
                                            />
                                        </div>
                                        {stakePreset === 'custom' && (
                                            <div className="space-y-2">
                                                <Label>Custom Amount (XLM)</Label>
                                                <Input
                                                    type="number"
                                                    value={customStake}
                                                    onChange={(e) => setCustomStake(e.target.value)}
                                                    placeholder="e.g. 250"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="grid gap-6 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Coins className="h-4 w-4" /> Starting Liquidity (XLM)
                                    </Label>
                                    <Select
                                        value={startingCash}
                                        onChange={setStartingCash}
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

                {/* House Rules Sidebar */}
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

                            <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
                                <div className="flex items-start gap-3">
                                    <Wallet className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-500" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Host Contract</p>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            You are deploying a room for up to {maxPlayers} players.
                                            {!isFreeGame && ` Entry fee set to ${stakePreset === 'custom' ? customStake : stakePreset} XLM.`}
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
                    onClick={handleCreateLobby}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>Deploying Room...</>
                    ) : (
                        <span className="flex items-center gap-2">Create Lobby <Rocket className="fill-current h-4 w-4" /></span>
                    )}
                </Button>
            </div>
        </div>
    )
}

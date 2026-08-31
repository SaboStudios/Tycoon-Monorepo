"use client"

import * as React from "react"
import { GameSettings } from "@/components/settings/GameSettings"

type WalletCheckState = "checking" | "registered" | "unregistered" | "error"

export default function GameSettingsClient(): React.JSX.Element {
    const [walletState, setWalletState] = React.useState<WalletCheckState>("checking")

    React.useEffect(() => {
        const checkWallet = async (): Promise<void> => {
            try {
                // Simulate network delay
                await new Promise<void>(resolve => setTimeout(resolve, 800))
                // Assume user is connected for demo
                setWalletState("registered")
            } catch {
                setWalletState("error")
            }
        }

        void checkWallet()
    }, [])

    if (walletState === "checking") {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-neutral-950">
                <div className="flex flex-col items-center gap-4" role="status" aria-label="Checking NEAR wallet connection">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400" aria-hidden="true"></div>
                    <p className="animate-pulse text-sm font-medium text-neutral-500 dark:text-neutral-400">Checking NEAR wallet…</p>
                </div>
            </div>
        )
    }

    if (walletState === "error") {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-white p-4 dark:bg-neutral-950">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Connection Failed</h2>
                    <p className="mt-2 text-neutral-500 dark:text-neutral-400">Unable to reach the NEAR network. Please try again.</p>
                </div>
            </div>
        )
    }

    if (walletState === "unregistered") {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-white p-4 dark:bg-neutral-950">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Wallet Not Connected</h2>
                    <p className="mt-2 text-neutral-500 dark:text-neutral-400">Please connect your NEAR wallet to host a game.</p>
                </div>
            </div>
        )
    }

    return (
        <GameSettings />
    )
}

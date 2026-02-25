"use client"

import * as React from "react"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { GameSettings } from "@/components/settings/GameSettings"

export default function GameSettingsClient() {
    const [isChecking, setIsChecking] = React.useState(true)
    const [isRegistered, setIsRegistered] = React.useState(false)

    React.useEffect(() => {
        // Mock wallet/reg check
        const checkWallet = async () => {
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 800))

            // Assume user is connected for demo
            setIsRegistered(true)
            setIsChecking(false)
        }

        checkWallet()
    }, [])

    if (isChecking) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-neutral-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400"></div>
                    <p className="animate-pulse text-sm font-medium text-neutral-500 dark:text-neutral-400">Connecting to Stellar Network...</p>
                </div>
            </div>
        )
    }

    if (!isRegistered) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-white p-4 dark:bg-neutral-950">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Wallet Not Connected</h2>
                    <p className="mt-2 text-neutral-500 dark:text-neutral-400">Please connect your Stellar wallet to host a game.</p>
                </div>
            </div>
        )
    }

    return (
        <main className="min-h-screen bg-gray-50/50 dark:bg-neutral-950">
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
            />
            <GameSettings />
        </main>
    )
}

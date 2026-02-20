'use client'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export type GameRoomLoadingVariant = 'game' | 'waiting'

export interface GameRoomLoadingProps {
  /** 'game' = loading game then redirect; 'waiting' = entering lobby, no redirect */
  variant?: GameRoomLoadingVariant
  /** Override title (variant sets defaults) */
  title?: string
  /** Override subtitle line 1 */
  subtitle?: string
  /** Override tagline (e.g. "show no mercy!") */
  tagline?: string
  /** Redirect path when variant is 'game' (default: /game-play) */
  redirectTo?: string
  /** Delay before redirect in ms (default: 5000) */
  redirectDelay?: number
}

const DEFAULTS = {
  game: {
    title: 'Loading Game',
    subtitle: 'Always remember to strategize properly and...',
    tagline: 'show no mercy!',
  },
  waiting: {
    title: 'Entering the Lobby...',
    subtitle: 'Gathering your rivals and preparing the board...',
    tagline: 'see you at the table!',
  },
} as const

const GameRoomLoading = (props: GameRoomLoadingProps) => {
  const {
    variant = 'game',
    title,
    subtitle,
    tagline,
    redirectTo = '/game-play',
    redirectDelay = 5000,
  } = props

  const [dots, setDots] = useState('')
  const router = useRouter()

  const config = DEFAULTS[variant]
  const displayTitle = title ?? config.title
  const displaySubtitle = subtitle ?? config.subtitle
  const displayTagline = tagline ?? config.tagline
  const doRedirect = variant === 'game'

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length < 5 ? prev + 'A' : ''))
    }, 300)
    return () => clearInterval(dotInterval)
  }, [])

  useEffect(() => {
    if (!doRedirect) return
    const t = setTimeout(() => router.push(redirectTo), redirectDelay)
    return () => clearTimeout(t)
  }, [router, doRedirect, redirectTo, redirectDelay])

  return (
    <section className="w-full min-h-[calc(100dvh-87px)] h-full bg-settings bg-cover bg-fixed bg-center">
      <main className="w-full min-h-[calc(100dvh-87px)] flex flex-col items-center justify-center bg-gradient-to-b from-[#010F10] to-[#010F1033] px-4 py-12">
        <div className="w-full max-w-xl">
          <h2 className="text-3xl md:text-4xl font-bold font-orbitron mb-6 text-[#F0F7F7] text-center">
            {displayTitle}
          </h2>
          <p className="text-[12px] md:text-[14px] text-center text-[#869298] font-[500]">
            {displaySubtitle}
            <br />
            <span className="font-semibold text-center uppercase">{displayTagline}</span>
          </p>
          <p className="mt-6 text-[12px] text-center md:text-[14px] text-[#869298] font-[500] animate-pulse">
            😈MUAHAHAHAHAHA{dots}😈
          </p>
        </div>
      </main>
    </section>
  )
}

export default GameRoomLoading
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Code-split heavy wallet/board deps so the hero stays within bundle/CLS budgets.
const WalletConnectButton = dynamic(() => import('../components/WalletConnectButton'), {
  ssr: false,
  loading: () => (
    <button
      type="button"
      className="hero-cta hero-cta--wallet"
      aria-disabled="true"
      disabled
    >
      Loading wallet…
    </button>
  ),
});

const GameBoardPreview = dynamic(() => import('../components/GameBoardPreview'), {
  ssr: false,
  loading: () => (
    <div className="hero-board hero-board--skeleton" role="status" aria-live="polite">
      Loading board…
    </div>
  ),
});

type HeroStatus = 'idle' | 'loading' | 'empty' | 'error' | 'ready';

interface HeroContent {
  headline: string;
  subheadline: string;
  ctaLabel: string;
}

const FALLBACK_CONTENT: HeroContent = {
  headline: 'Own the board. Roll the dice.',
  subheadline: 'Tycoon is a player-owned economy on NEAR.',
  ctaLabel: 'Play now',
};

// Only NEAR is a supported chain UI per ADR-003 until Stellar is gated ready.
const SUPPORTED_CHAIN = 'near' as const;

export default function LandingPage() {
  const [status, setStatus] = useState<HeroStatus>('loading');
  const [content, setContent] = useState<HeroContent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [walletRejected, setWalletRejected] = useState(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadHero = useCallback(async () => {
    // Idempotency: ignore concurrent duplicate requests / reconnect retries.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus('loading');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/landing/hero', {
        method: 'GET',
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        // Distinguish API 500 from a legitimately empty payload.
        setStatus('error');
        setErrorMessage('We could not load the hero right now. Please retry.');
        return;
      }

      const data: unknown = await res.json();
      if (!mountedRef.current) return;

      if (!isHeroContent(data)) {
        setStatus('empty');
        setContent(null);
        return;
      }

      setContent(data);
      setStatus('ready');
    } catch {
      if (!mountedRef.current) return;
      setStatus('error');
      setErrorMessage('Network error. Check your connection and retry.');
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadHero();
  }, [loadHero]);

  const handleWalletReject = useCallback(() => {
    setWalletRejected(true);
  }, []);

  const handleRetry = useCallback(() => {
    setWalletRejected(false);
    void loadHero();
  }, [loadHero]);

  const resolved = content ?? FALLBACK_CONTENT;

  return (
    <main className="landing-hero" data-chain={SUPPORTED_CHAIN}>
      <section className="landing-hero__copy" aria-labelledby="hero-headline">
        <h1 id="hero-headline" className="landing-hero__headline">
          {resolved.headline}
        </h1>
        <p className="landing-hero__subheadline">{resolved.subheadline}</p>

        {status === 'loading' && (
          <p className="landing-hero__status" role="status" aria-live="polite">
            Loading…
          </p>
        )}

        {status === 'empty' && (
          <p className="landing-hero__status" role="status" aria-live="polite">
            Nothing to show yet — check back soon.
          </p>
        )}

        {status === 'error' && (
          <div className="landing-hero__error" role="alert">
            <p>{errorMessage ?? 'Something went wrong.'}</p>
            <button type="button" className="hero-cta hero-cta--retry" onClick={handleRetry}>
              Retry
            </button>
          </div>
        )}

        {walletRejected && (
          <p className="landing-hero__status" role="status" aria-live="polite">
            Wallet connection was cancelled. You can try again anytime.
          </p>
        )}

        <div className="landing-hero__actions">
          <a className="hero-cta hero-cta--primary" href="/play">
            {resolved.ctaLabel}
          </a>
          <WalletConnectButton onReject={handleWalletReject} />
        </div>
      </section>

      <section className="landing-hero__board" aria-label="Game board preview">
        <GameBoardPreview />
      </section>
    </main>
  );
}

function isHeroContent(value: unknown): value is HeroContent {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.headline === 'string' &&
    candidate.headline.length > 0 &&
    typeof candidate.subheadline === 'string' &&
    typeof candidate.ctaLabel === 'string' &&
    candidate.ctaLabel.length > 0
  );
}

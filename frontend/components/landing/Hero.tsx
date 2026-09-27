'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Landing hero (SW-FE-001 / SW-FE-007 / SW-FE-008).
 *
 * - Strict TypeScript null guards on all external data.
 * - Explicit loading / empty / error states; live API only (no prod mocks).
 * - Keyboard + focus-order friendly CTAs (a11y).
 * - Double-click / duplicate-request guard (idempotent CTA).
 * - No secrets, no PII in telemetry labels; consent-gated analytics.
 */

export interface HeroCta {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

export interface HeroContent {
  readonly headline: string;
  readonly subhead: string;
  readonly ctas: readonly HeroCta[];
}

type HeroState =
  | { readonly status: 'loading' }
  | { readonly status: 'empty' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly content: HeroContent };

const HERO_ENDPOINT = '/api/landing/hero';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseCta(value: unknown): HeroCta | null {
  if (!isRecord(value)) return null;
  const { id, label, href } = value;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof label !== 'string' || label.length === 0) return null;
  if (typeof href !== 'string' || href.length === 0) return null;
  // No open redirects: only same-origin relative paths are allowed.
  if (!href.startsWith('/') || href.startsWith('//')) return null;
  return { id, label, href };
}

function parseHeroContent(value: unknown): HeroContent | null {
  if (!isRecord(value)) return null;
  const { headline, subhead, ctas } = value;
  if (typeof headline !== 'string' || headline.length === 0) return null;
  if (typeof subhead !== 'string') return null;
  if (!Array.isArray(ctas)) return null;
  const parsed: HeroCta[] = [];
  for (const raw of ctas) {
    const cta = parseCta(raw);
    if (cta === null) return null;
    parsed.push(cta);
  }
  return { headline, subhead, ctas: parsed };
}

function track(event: string, props: Record<string, string> = {}): void {
  if (typeof window === 'undefined') return;
  // Consent-gated: never emit analytics before the user opts in.
  const consent = (window as unknown as { __tycoonConsent?: boolean }).__tycoonConsent;
  if (consent !== true) return;
  const sink = (window as unknown as { __tycoonAnalytics?: (e: string, p: Record<string, string>) => void })
    .__tycoonAnalytics;
  if (typeof sink !== 'function') return;
  // Labels only — no PII, no tokens.
  sink(event, props);
}

export default function Hero(): JSX.Element {
  const [state, setState] = useState<HeroState>({ status: 'loading' });
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ status: 'loading' });
    try {
      const res = await fetch(HERO_ENDPOINT, {
        method: 'GET',
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        signal,
      });
      if (!res.ok) {
        throw new Error(res.status >= 500 ? 'service_unavailable' : 'request_failed');
      }
      const json: unknown = await res.json();
      const content = parseHeroContent(json);
      if (content === null) {
        throw new Error('invalid_payload');
      }
      if (!mounted.current) return;
      if (content.ctas.length === 0) {
        setState({ status: 'empty' });
        return;
      }
      setState({ status: 'ready', content });
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setState({ status: 'error', message: 'Unable to load the hero right now.' });
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [load]);

  const onCtaClick = useCallback((cta: HeroCta) => {
    // Guard against double CTA clicks / duplicate navigation.
    if (inFlight.current) return;
    track('landing_hero_cta_click', { cta_id: cta.id });
  }, []);

  if (state.status === 'loading') {
    return (
      <section className="hero" aria-busy="true" aria-live="polite">
        <div className="hero__skeleton" data-testid="hero-loading" />
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="hero" role="alert" data-testid="hero-error">
        <p>{state.message}</p>
        <button type="button" onClick={() => void load()}>
          Retry
        </button>
      </section>
    );
  }

  if (state.status === 'empty') {
    return (
      <section className="hero" data-testid="hero-empty">
        <h1>Tycoon</h1>
        <p>Coming soon.</p>
      </section>
    );
  }

  const { content } = state;
  return (
    <section className="hero" data-testid="hero-ready">
      <h1>{content.headline}</h1>
      <p>{content.subhead}</p>
      <nav aria-label="Primary">
        {content.ctas.map((cta) => (
          <a
            key={cta.id}
            href={cta.href}
            className="hero__cta"
            onClick={() => onCtaClick(cta)}
          >
            {cta.label}
          </a>
        ))}
      </nav>
    </section>
  );
}

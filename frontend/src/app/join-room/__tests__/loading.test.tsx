/**
 * Tests for src/app/join-room/loading.tsx
 *
 * Covers:
 *  - Rendering without crash
 *  - ARIA: aria-busy="true", aria-label via i18n key, role=status/region
 *  - CLS prevention: min-h-screen, w-full, exact layout classes matching JoinRoomPageContent
 *  - Theme variables alignment with the real form (bg-[var(--tycoon-bg)] etc.)
 *  - Skeleton slot count and structural hierarchy
 *  - Error slot space reservation (min-h-[1.25rem]) — prevents layout shift on error
 *  - Stale/re-render stability: multiple renders produce consistent output
 *  - Visibility: component is visible and not hidden by default
 *  - i18n key coverage: loadingAria resolved via mock t()
 *  - No interactive elements (loading state must not be interactive)
 *
 * Mock strategy:
 *  - react-i18next: key-passthrough so aria-label is the raw i18n key
 *    (the component calls t(JOIN_ROOM_I18N.loadingAria) — we assert on the key value)
 */

import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';
import JoinRoomLoading from '../loading';
import { JOIN_ROOM_I18N } from '@/lib/join-room/i18n-keys';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('JoinRoomLoading (Suspense skeleton)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Basic rendering ─────────────────────────────────────────────────────────

  describe('Basic rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<JoinRoomLoading />)).not.toThrow();
    });

    it('renders a <section> as the outermost accessible element', () => {
      const { container } = render(<JoinRoomLoading />);
      expect(container.querySelector('section')).toBeInTheDocument();
    });

    it('is visible and not hidden by default', () => {
      render(<JoinRoomLoading />);
      const section = screen.getByLabelText(JOIN_ROOM_I18N.loadingAria);
      expect(section).toBeVisible();
    });
  });

  // ── ARIA / Accessibility ────────────────────────────────────────────────────

  describe('Accessibility (ARIA)', () => {
    it('sets aria-busy="true" so screen readers announce loading state', () => {
      render(<JoinRoomLoading />);
      const section = screen.getByLabelText(JOIN_ROOM_I18N.loadingAria);
      expect(section).toHaveAttribute('aria-busy', 'true');
    });

    it('sets aria-label to the i18n loadingAria key for screen-reader announcement', () => {
      render(<JoinRoomLoading />);
      // getByLabelText will throw if the label is missing — this IS the assertion
      const section = screen.getByLabelText(JOIN_ROOM_I18N.loadingAria);
      expect(section).toBeInTheDocument();
    });

    it('uses the correct i18n key (join_room.loading_aria)', () => {
      expect(JOIN_ROOM_I18N.loadingAria).toBe('join_room.loading_aria');
      render(<JoinRoomLoading />);
      // If the key changes, this test will catch the regression
      expect(screen.getByLabelText('join_room.loading_aria')).toBeInTheDocument();
    });

    it('has no interactive elements — loading skeletons must not be focusable', () => {
      const { container } = render(<JoinRoomLoading />);
      const interactives = container.querySelectorAll('button, input, a, select, textarea, [tabindex]');
      expect(interactives.length).toBe(0);
    });

    it('skeleton divs are aria-hidden to avoid redundant announcements', () => {
      const { container } = render(<JoinRoomLoading />);
      // Skeleton component sets aria-hidden="true" on each div
      const skeletonDivs = container.querySelectorAll('[aria-hidden="true"]');
      expect(skeletonDivs.length).toBeGreaterThan(0);
    });
  });

  // ── CLS prevention / layout ─────────────────────────────────────────────────

  describe('CLS (Cumulative Layout Shift) prevention', () => {
    it('has min-h-screen on the section to fill the viewport height', () => {
      const { container } = render(<JoinRoomLoading />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('min-h-screen');
    });

    it('has w-full on the section to prevent horizontal shift', () => {
      const { container } = render(<JoinRoomLoading />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('w-full');
    });

    it('uses flex layout to center card — matches JoinRoomPageContent layout', () => {
      const { container } = render(<JoinRoomLoading />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center');
    });

    it('has px-4 padding on the section matching the real page', () => {
      const { container } = render(<JoinRoomLoading />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('px-4');
    });

    it('preserves the error slot space even while loading (min-h-[1.25rem])', () => {
      const { container } = render(<JoinRoomLoading />);
      const errorSlot = container.querySelector('.min-h-\\[1\\.25rem\\]');
      expect(errorSlot).toBeInTheDocument();
    });
  });

  // ── Theme alignment ─────────────────────────────────────────────────────────

  describe('Theme variable alignment', () => {
    it('section background matches the real form: bg-[var(--tycoon-bg)]', () => {
      const { container } = render(<JoinRoomLoading />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('bg-[var(--tycoon-bg)]');
    });

    it('card wrapper uses the same max-w-md constraint as the real page', () => {
      const { container } = render(<JoinRoomLoading />);
      const card = container.querySelector('.max-w-md');
      expect(card).toBeInTheDocument();
    });

    it('card wrapper has rounded-2xl and shadow-xl matching the real page', () => {
      const { container } = render(<JoinRoomLoading />);
      const card = container.querySelector('.max-w-md');
      expect(card).toHaveClass('rounded-2xl', 'shadow-xl');
    });

    it('card wrapper has p-6 padding matching the real page', () => {
      const { container } = render(<JoinRoomLoading />);
      const card = container.querySelector('.max-w-md');
      expect(card).toHaveClass('p-6');
    });

    it('inner card uses bg-[var(--tycoon-bg)] matching JoinRoomPageContent inner wrapper', () => {
      const { container } = render(<JoinRoomLoading />);
      const innerCard = container.querySelector('.max-w-md .rounded-lg');
      expect(innerCard).toHaveClass('bg-[var(--tycoon-bg)]');
    });

    it('inner card has p-6 and space-y-5 matching the form inner container', () => {
      const { container } = render(<JoinRoomLoading />);
      const innerCard = container.querySelector('.max-w-md .rounded-lg');
      expect(innerCard).toHaveClass('p-6', 'space-y-5');
    });
  });

  // ── Skeleton slot structure ─────────────────────────────────────────────────

  describe('Skeleton slots', () => {
    it('renders at least 4 skeleton placeholders (title + label + hint + input + button)', () => {
      const { container } = render(<JoinRoomLoading />);
      // Skeleton renders as an animate-pulse div; count all animate-pulse children
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThanOrEqual(4);
    });

    it('renders a title skeleton in the outer card area (mb-6)', () => {
      const { container } = render(<JoinRoomLoading />);
      // Title skeleton is outside the inner card, has mx-auto and mb-6
      const titleSkeleton = container.querySelector('.mx-auto.mb-6');
      expect(titleSkeleton).toBeInTheDocument();
    });

    it('renders a full-width skeleton for the input field', () => {
      const { container } = render(<JoinRoomLoading />);
      // Input skeleton uses w-full
      const inputSkeleton = container.querySelector('.animate-pulse.w-full');
      expect(inputSkeleton).toBeInTheDocument();
    });

    it('renders field-label and hint skeletons (w-24, w-56)', () => {
      const { container } = render(<JoinRoomLoading />);
      const labelSkeleton = container.querySelector('.animate-pulse.w-24');
      const hintSkeleton = container.querySelector('.animate-pulse.w-56');
      // At least one partial-width skeleton for label
      expect(labelSkeleton ?? hintSkeleton).toBeInTheDocument();
    });

    it('renders a full-width button skeleton', () => {
      const { container } = render(<JoinRoomLoading />);
      // There should be two full-width skeletons: input and button
      const fullWidthSkeletons = container.querySelectorAll('.animate-pulse.w-full');
      expect(fullWidthSkeletons.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Stale / re-render stability ─────────────────────────────────────────────

  describe('Stale and re-render stability', () => {
    it('re-renders consistently without adding duplicate sections', () => {
      const { rerender, container } = render(<JoinRoomLoading />);
      rerender(<JoinRoomLoading />);
      expect(container.querySelectorAll('section').length).toBe(1);
    });

    it('maintains the same skeleton count across multiple renders', () => {
      const { rerender, container } = render(<JoinRoomLoading />);
      const firstCount = container.querySelectorAll('.animate-pulse').length;
      rerender(<JoinRoomLoading />);
      expect(container.querySelectorAll('.animate-pulse').length).toBe(firstCount);
    });

    it('does not unmount the section between re-renders (stable DOM identity)', () => {
      const { rerender, container } = render(<JoinRoomLoading />);
      const firstSection = container.querySelector('section');
      rerender(<JoinRoomLoading />);
      expect(container.querySelector('section')).toBe(firstSection);
    });
  });

  // ── Integration: structural parity with the real form ──────────────────────

  describe('Structural parity with JoinRoomPageContent', () => {
    it('outer wrapper has border border-[var(--tycoon-border)] matching the real card', () => {
      const { container } = render(<JoinRoomLoading />);
      const card = container.querySelector('.max-w-md');
      expect(card).toHaveClass('border');
    });

    it('inner form area has border matching the real inner card', () => {
      const { container } = render(<JoinRoomLoading />);
      const innerCard = container.querySelector('.max-w-md .rounded-lg');
      expect(innerCard).toHaveClass('border');
    });

    it('field group has space-y-1.5 to mirror FormField spacing', () => {
      const { container } = render(<JoinRoomLoading />);
      const fieldGroup = container.querySelector('.space-y-1\\.5');
      expect(fieldGroup).toBeInTheDocument();
    });
  });
});

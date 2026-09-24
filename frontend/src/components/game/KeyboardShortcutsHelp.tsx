'use client';

import React, { useRef } from 'react';
import { X, Keyboard } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { KEYBOARD_SHORTCUT_MAP } from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Cheat-sheet overlay listing all keyboard shortcuts for game overlays.
 * Accessible dialog with focus trap and Escape-to-close.
 */
export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(containerRef, isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-help-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={containerRef}
        className="relative z-10 w-full max-w-sm rounded-xl border border-[#003B3E] bg-[#010F10] shadow-[0_0_40px_rgba(0,240,255,0.12)]"
        data-testid="keyboard-shortcuts-help"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#003B3E] px-5 py-4">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-[#00F0FF]" aria-hidden />
            <h2
              id="shortcuts-help-title"
              className="text-base font-bold text-[#F0F7F7] tracking-wide"
            >
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close keyboard shortcuts help"
            className="rounded-lg p-1.5 text-[#F0F7F7]/60 hover:bg-[#003B3E]/40 hover:text-[#00F0FF] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00F0FF]/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Shortcut list */}
        <ul className="divide-y divide-[#003B3E]/60 px-5 py-2" role="list">
          {KEYBOARD_SHORTCUT_MAP.map(({ key, description }) => (
            <li key={key} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-[#F0F7F7]/80">{description}</span>
              <kbd className="ml-4 rounded border border-[#003B3E] bg-[#0E1415] px-2 py-0.5 text-xs font-mono text-[#00F0FF] shadow-sm">
                {key}
              </kbd>
            </li>
          ))}
        </ul>

        <p className="px-5 pb-4 text-xs text-[#F0F7F7]/40">
          Shortcuts are disabled while typing in input fields.
        </p>
      </div>
    </div>
  );
}

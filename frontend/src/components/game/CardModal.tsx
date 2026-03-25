import React, { useEffect, useRef, useCallback } from 'react';
import { CardData } from '../../hooks/useCardModal';

export interface CardModalProps {
    isOpen: boolean;
    onClose: () => void;
    card: CardData | null;
}

/**
 * Chance card: bright orange with "?" motif — playful, high-risk feel.
 * Community Chest: warm sky-blue with community icon — cooperative feel.
 */
const CARD_THEMES = {
    chance: {
        bg: 'bg-amber-50',
        header: 'bg-amber-500',
        border: 'border-amber-500',
        badge: 'bg-amber-100 text-amber-800',
        icon: '?',
        iconBg: 'bg-amber-400',
        title: 'Chance',
        overlay: 'bg-amber-500/10',
    },
    community: {
        bg: 'bg-sky-50',
        header: 'bg-sky-500',
        border: 'border-sky-500',
        badge: 'bg-sky-100 text-sky-800',
        icon: '🏦',
        iconBg: 'bg-sky-400',
        title: 'Community Chest',
        overlay: 'bg-sky-500/10',
    },
} as const;

export const CardModal: React.FC<CardModalProps> = ({ isOpen, onClose, card }) => {
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // Focus management — move focus into modal when opened
    useEffect(() => {
        if (isOpen) {
            closeButtonRef.current?.focus();
        }
    }, [isOpen]);

    // Close on Escape key
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }

            // Focus trap: keep Tab/Shift+Tab within the modal
            if (e.key === 'Tab' && modalRef.current) {
                const focusable = modalRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last?.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first?.focus();
                    }
                }
            }
        },
        [onClose]
    );

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            // Prevent body scroll while modal is open
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen || !card) return null;

    const theme = CARD_THEMES[card.type];

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-modal-title"
            aria-describedby="card-modal-description"
        >
            {/* Dimmed overlay — clicking outside closes the modal */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Card */}
            <div
                ref={modalRef}
                className={`
                    relative z-10 w-72 sm:w-80 rounded-2xl shadow-2xl border-4
                    ${theme.bg} ${theme.border}
                    transform transition-all duration-200 scale-100
                    flex flex-col overflow-hidden
                `}
                data-testid="card-modal"
            >
                {/* Header band */}
                <div className={`${theme.header} px-4 py-3 flex items-center justify-between`}>
                    <h2
                        id="card-modal-title"
                        className="text-white font-black text-lg uppercase tracking-widest font-serif"
                    >
                        {theme.title}
                    </h2>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        aria-label="Close card"
                        className="
                            w-8 h-8 rounded-full bg-white/20 hover:bg-white/40
                            text-white font-bold text-sm flex items-center justify-center
                            transition-colors focus:outline-none focus:ring-2 focus:ring-white
                        "
                    >
                        ✕
                    </button>
                </div>

                {/* Icon circle */}
                <div className="flex justify-center -mb-8 mt-5">
                    <div
                        className={`
                            w-16 h-16 rounded-full ${theme.iconBg}
                            flex items-center justify-center text-white
                            text-3xl font-black shadow-lg border-4 border-white
                        `}
                        aria-hidden="true"
                    >
                        {theme.icon}
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 pt-12 pb-6 flex flex-col items-center gap-4">
                    {/* Card type badge */}
                    <span className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${theme.badge}`}>
                        {card.type === 'chance' ? 'Chance Card' : 'Community Chest Card'}
                    </span>

                    {/* Card text */}
                    <p
                        id="card-modal-description"
                        className="text-gray-800 text-center text-base font-medium leading-relaxed"
                    >
                        {card.text}
                    </p>
                </div>

                {/* Footer */}
                <div className={`${theme.overlay} px-6 py-4 border-t-2 ${theme.border} flex justify-center`}>
                    <button
                        onClick={onClose}
                        className={`
                            ${theme.header} text-white font-bold text-sm uppercase tracking-wider
                            px-8 py-2 rounded-full shadow-md
                            hover:opacity-90 active:scale-95 transition-all
                            focus:outline-none focus:ring-4 focus:ring-offset-2
                            ${card.type === 'chance' ? 'focus:ring-amber-300' : 'focus:ring-sky-300'}
                        `}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CardModal;

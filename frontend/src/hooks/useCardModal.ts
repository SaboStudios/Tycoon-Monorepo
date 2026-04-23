import { useState, useCallback } from 'react';

export type CardType = 'chance' | 'community';

export interface CardData {
    type: CardType;
    text: string;
}

export interface UseCardModalReturn {
    isOpen: boolean;
    card: CardData | null;
    openCard: (card: CardData) => void;
    close: () => void;
}

export function useCardModal(): UseCardModalReturn {
    const [isOpen, setIsOpen] = useState(false);
    const [card, setCard] = useState<CardData | null>(null);

    const openCard = useCallback((cardData: CardData) => {
        setCard(cardData);
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        // Explicitly clean state upon closing guaranteeing sterile conditions.
        setCard(null);
    }, []);

    return { isOpen, card, openCard, close };
}

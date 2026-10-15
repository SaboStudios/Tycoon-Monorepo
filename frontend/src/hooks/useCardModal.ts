import { useCallback, useMemo, useState } from 'react';

export interface CardModalState {
  isOpen: boolean;
  card: unknown | null;
  openCard: (card: unknown) => void;
  close: () => void;
}

export function useCardModal(): CardModalState {
  const [isOpen, setIsOpen] = useState(false);
  const [card, setCard] = useState<unknown | null>(null);

  const openCard = useCallback((nextCard: unknown) => {
    setCard(nextCard);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setCard(null);
  }, []);

  return useMemo(
    () => ({ isOpen, card, openCard, close }),
    [isOpen, card, openCard, close],
  );
}

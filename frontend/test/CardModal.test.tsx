import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CardModal } from '../src/components/game/CardModal';
import type { CardData } from '../src/hooks/useCardModal';

const chanceCard: CardData = { type: 'chance', text: 'Advance to Go. Collect $200.' };
const communityCard: CardData = { type: 'community', text: 'Bank error in your favor. Collect $200.' };

describe('CardModal', () => {
    const onClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Restore body overflow after each test
        document.body.style.overflow = '';
    });

    it('renders nothing when isOpen is false', () => {
        render(<CardModal isOpen={false} onClose={onClose} card={chanceCard} />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders nothing when card is null', () => {
        render(<CardModal isOpen={true} onClose={onClose} card={null} />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders the Chance card with correct content and title', () => {
        render(<CardModal isOpen={true} onClose={onClose} card={chanceCard} />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Chance')).toBeInTheDocument();
        expect(screen.getByText(chanceCard.text)).toBeInTheDocument();
        expect(screen.getByText('Chance Card')).toBeInTheDocument();
    });

    it('renders the Community Chest card with correct content and title', () => {
        render(<CardModal isOpen={true} onClose={onClose} card={communityCard} />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Community Chest')).toBeInTheDocument();
        expect(screen.getByText(communityCard.text)).toBeInTheDocument();
        expect(screen.getByText('Community Chest Card')).toBeInTheDocument();
    });

    it('calls onClose when the ✕ close button is clicked', () => {
        render(<CardModal isOpen={true} onClose={onClose} card={chanceCard} />);
        fireEvent.click(screen.getByLabelText('Close card'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the OK button is clicked', () => {
        render(<CardModal isOpen={true} onClose={onClose} card={communityCard} />);
        fireEvent.click(screen.getByText('OK'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the backdrop overlay is clicked', () => {
        render(<CardModal isOpen={true} onClose={onClose} card={chanceCard} />);
        // The overlay is aria-hidden, find it by its position as sibling of the card
        const modal = screen.getByTestId('card-modal');
        const overlay = modal.parentElement?.querySelector('[aria-hidden="true"]') as HTMLElement;
        fireEvent.click(overlay);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
        render(<CardModal isOpen={true} onClose={onClose} card={chanceCard} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('has correct ARIA attributes for accessibility', () => {
        render(<CardModal isOpen={true} onClose={onClose} card={communityCard} />);
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby', 'card-modal-title');
        expect(dialog).toHaveAttribute('aria-describedby', 'card-modal-description');
    });

    it('locks body scroll when open and restores it on close', () => {
        const { unmount } = render(<CardModal isOpen={true} onClose={onClose} card={chanceCard} />);
        expect(document.body.style.overflow).toBe('hidden');
        unmount();
        expect(document.body.style.overflow).toBe('');
    });
});

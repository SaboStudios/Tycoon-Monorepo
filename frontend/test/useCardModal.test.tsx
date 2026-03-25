import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useCardModal } from '../src/hooks/useCardModal';

describe('useCardModal', () => {
    it('should initialize with default closed state', () => {
        const { result } = renderHook(() => useCardModal());
        expect(result.current.isOpen).toBe(false);
        expect(result.current.card).toBeNull();
    });

    it('should open the modal and set card data', () => {
        const { result } = renderHook(() => useCardModal());

        act(() => {
            result.current.openCard({ type: 'chance', text: 'Go directly to Jail' });
        });

        expect(result.current.isOpen).toBe(true);
        expect(result.current.card).toEqual({ type: 'chance', text: 'Go directly to Jail' });
    });

    it('should close the modal and clear state cleanly mapped', () => {
        const { result } = renderHook(() => useCardModal());

        act(() => {
            result.current.openCard({ type: 'community', text: 'Bank error in your favor' });
        });

        expect(result.current.isOpen).toBe(true);
        expect(result.current.card).not.toBeNull();

        act(() => {
            result.current.close();
        });

        expect(result.current.isOpen).toBe(false);
        expect(result.current.card).toBeNull();
    });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Marketplace } from '../Marketplace';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from 'react-toastify';

// Mock dependencies
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the PurchaseModal component since it's used by Marketplace
vi.mock('@/components/ui/purchase-modal', () => ({
  PurchaseModal: ({ isOpen, onConfirm, itemName }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="purchase-modal">
        <button onClick={onConfirm}>Confirm Purchase of {itemName}</button>
      </div>
    );
  },
}));

// Mock the Spinner component
vi.mock('@/components/ui/spinner', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

// Helper to mock fetch responses
const mockFetch = (data: any, ok = true, status = 200) => {
  return vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(data),
    })
  );
};

describe('Marketplace Optimistic UI', () => {
  const mockItems = [
    {
      id: 1,
      name: 'Cool Skin',
      description: 'A very cool skin',
      type: 'skin',
      price: '100',
      currency: 'GOLD',
      rarity: 'rare',
      is_owned: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch({ data: mockItems });
  });

  it('performs an optimistic update and reverts on failure', async () => {
    // 1. Initial render - fetch items
    render(<Marketplace />);
    
    // Wait for items to load
    await waitFor(() => expect(screen.queryByTestId('spinner')).not.toBeInTheDocument());
    expect(screen.getByText('Cool Skin')).toBeInTheDocument();
    
    // Check initial state: Buy button should be present
    const buyButton = screen.getByLabelText('shop.purchase Cool Skin');
    expect(buyButton).toBeInTheDocument();
    expect(buyButton).not.toHaveTextContent('shop.owned');

    // 2. Click purchase to open modal
    fireEvent.click(buyButton);
    
    // 3. Mock a failed purchase response for the next fetch call
    global.fetch = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Insufficient funds' }),
      }))
      // Subsequent fetch for items should return original items
      .mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockItems }),
      }));

    // 4. Confirm purchase in the modal
    const confirmButton = screen.getByText('Confirm Purchase of Cool Skin');
    fireEvent.click(confirmButton);

    // 5. CHECK OPTIMISTIC UI: The button should IMMEDIATELY show "Owned" (or equivalent state change)
    // before the fetch completes
    expect(screen.getAllByText('shop.owned').length).toBeGreaterThan(0);

    // 6. WAIT FOR ROLLBACK: After the failed fetch, it should revert to previous state
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
      expect(toast.error.mock.calls[0]?.[0]).toBe('Insufficient funds');
      // The "Owned" text should be gone and replaced by "Purchase" again
      expect(screen.queryAllByText('shop.owned').length).toBe(0);
    });
    
    expect(screen.getByLabelText('shop.purchase Cool Skin')).toBeInTheDocument();
  });

  it('performs an optimistic update and stays successful on server success', async () => {
    render(<Marketplace />);
    await waitFor(() => expect(screen.queryByTestId('spinner')).not.toBeInTheDocument());
    
    const buyButton = screen.getByLabelText('shop.purchase Cool Skin');
    fireEvent.click(buyButton);

    // Mock successful purchase
    global.fetch = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 101, status: 'completed' }),
      }))
      .mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [{ ...mockItems[0], is_owned: true }] }),
      }));

    const confirmButton = screen.getByText('Confirm Purchase of Cool Skin');
    fireEvent.click(confirmButton);

    // Optimistic update
    expect(screen.getAllByText('shop.owned').length).toBeGreaterThan(0);

    // Stay successful
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
      expect(toast.success.mock.calls[0]?.[0]).toBe(
        'Cool Skin purchased successfully!',
      );
      expect(screen.getAllByText('shop.owned').length).toBeGreaterThan(0);
    });
  });
});

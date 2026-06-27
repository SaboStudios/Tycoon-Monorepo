import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { ConfirmationModal } from '../ConfirmationModal';

const baseProps = {
  isOpen: true,
  title: 'Confirm Action',
  description: 'Are you sure you want to proceed?',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmationModal', () => {
  describe('Visibility', () => {
    it('renders when isOpen is true', () => {
      render(<ConfirmationModal {...baseProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<ConfirmationModal {...baseProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders the title text', () => {
      render(<ConfirmationModal {...baseProps} />);
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('renders the description text', () => {
      render(<ConfirmationModal {...baseProps} />);
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });

    it('renders the confirm button with correct text', () => {
      render(<ConfirmationModal {...baseProps} />);
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });

    it('renders the cancel button with correct text', () => {
      render(<ConfirmationModal {...baseProps} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  describe('ARIA attributes', () => {
    it('has role="dialog" and aria-modal="true"', () => {
      render(<ConfirmationModal {...baseProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('links the title via aria-labelledby', () => {
      render(<ConfirmationModal {...baseProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    });

    it('links the description via aria-describedby', () => {
      render(<ConfirmationModal {...baseProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby', 'modal-description');
    });
  });

  describe('Interactions', () => {
    it('calls onConfirm when confirm button is clicked', async () => {
      const onConfirm = vi.fn();
      render(<ConfirmationModal {...baseProps} onConfirm={onConfirm} />);
      await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('calls onCancel when cancel button is clicked', async () => {
      const onCancel = vi.fn();
      render(<ConfirmationModal {...baseProps} onCancel={onCancel} />);
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe('Loading state', () => {
    it('disables confirm button when isLoading is true', () => {
      render(<ConfirmationModal {...baseProps} isLoading />);
      expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();
    });

    it('disables cancel button when isLoading is true', () => {
      render(<ConfirmationModal {...baseProps} isLoading />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });

    it('shows "Processing..." text when isLoading is true', () => {
      render(<ConfirmationModal {...baseProps} isLoading />);
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });
  });

  describe('Dangerous variant', () => {
    it('renders without danger styling by default', () => {
      render(<ConfirmationModal {...baseProps} />);
      const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmBtn.className).not.toContain('red-600');
    });

    it('applies red styling when isDangerous is true', () => {
      render(<ConfirmationModal {...baseProps} isDangerous />);
      const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmBtn.className).toContain('red');
    });
  });
});

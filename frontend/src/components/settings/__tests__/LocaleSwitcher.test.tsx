import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LocaleSwitcher } from '../LocaleSwitcher';

const mockChangeLanguage = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'settings.language': 'Language',
      };
      return map[key] ?? key;
    },
    i18n: {
      language: 'en',
      changeLanguage: mockChangeLanguage,
    },
  }),
}));

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the language section label', () => {
      render(<LocaleSwitcher />);
      expect(screen.getByText('Language')).toBeInTheDocument();
    });

    it('renders the English language button', () => {
      render(<LocaleSwitcher />);
      expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    });

    it('renders the Español language button', () => {
      render(<LocaleSwitcher />);
      expect(screen.getByRole('button', { name: 'Español' })).toBeInTheDocument();
    });

    it('renders exactly two language buttons', () => {
      render(<LocaleSwitcher />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });
  });

  describe('Language switching', () => {
    it('calls changeLanguage with "es" when Español is clicked', async () => {
      render(<LocaleSwitcher />);
      await userEvent.click(screen.getByRole('button', { name: 'Español' }));
      expect(mockChangeLanguage).toHaveBeenCalledWith('es');
    });

    it('calls changeLanguage with "en" when English is clicked', async () => {
      render(<LocaleSwitcher />);
      await userEvent.click(screen.getByRole('button', { name: 'English' }));
      expect(mockChangeLanguage).toHaveBeenCalledWith('en');
    });
  });

  describe('Active state', () => {
    it('English button uses default variant when "en" is the current language', () => {
      render(<LocaleSwitcher />);
      const englishBtn = screen.getByRole('button', { name: 'English' });
      // Default (active) variant contains indigo styling
      expect(englishBtn.className).toContain('indigo');
    });

    it('Español button uses outline variant when "en" is the current language', () => {
      render(<LocaleSwitcher />);
      const espanolBtn = screen.getByRole('button', { name: 'Español' });
      expect(espanolBtn.className).toContain('neutral');
    });
  });
});

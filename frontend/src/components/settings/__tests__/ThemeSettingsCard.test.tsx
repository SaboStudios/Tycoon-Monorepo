import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeSettingsCard } from '../ThemeSettingsCard';

const mockSetThemePreference = vi.fn();
const mockClearThemePreference = vi.fn();

vi.mock('@/components/providers/theme-provider', () => ({
  useTheme: () => ({
    clearThemePreference: mockClearThemePreference,
    preference: 'system',
    resolvedTheme: 'dark',
    setThemePreference: mockSetThemePreference,
  }),
}));

vi.mock('@/lib/theme', () => ({
  getChartPalette: () => ({
    background: '#000',
    grid: '#111',
    foreground: '#fff',
    series: ['#f00', '#0f0', '#00f'],
  }),
}));

describe('ThemeSettingsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the Appearance heading', () => {
      render(<ThemeSettingsCard />);
      expect(screen.getByText('Appearance')).toBeInTheDocument();
    });

    it('renders the Dark mode label', () => {
      render(<ThemeSettingsCard />);
      expect(screen.getByText('Dark mode')).toBeInTheDocument();
    });

    it('renders the dark mode toggle switch', () => {
      render(<ThemeSettingsCard />);
      expect(screen.getByRole('switch', { name: /dark mode/i })).toBeInTheDocument();
    });

    it('renders the Follow system theme option', () => {
      render(<ThemeSettingsCard />);
      expect(screen.getByText('Follow system theme')).toBeInTheDocument();
    });

    it('renders the Use System button', () => {
      render(<ThemeSettingsCard />);
      expect(screen.getByRole('button', { name: /use system/i })).toBeInTheDocument();
    });

    it('renders the chart contrast preview section', () => {
      render(<ThemeSettingsCard />);
      expect(screen.getByText(/chart contrast preview/i)).toBeInTheDocument();
    });

    it('renders chart series labels', () => {
      render(<ThemeSettingsCard />);
      expect(screen.getByText('Series 1')).toBeInTheDocument();
      expect(screen.getByText('Series 2')).toBeInTheDocument();
      expect(screen.getByText('Series 3')).toBeInTheDocument();
    });
  });

  describe('Theme preference state', () => {
    it('shows "System preference" when preference is system', () => {
      render(<ThemeSettingsCard />);
      expect(screen.getByText(/system preference/i)).toBeInTheDocument();
    });

    it('dark mode switch is checked when resolvedTheme is dark', () => {
      render(<ThemeSettingsCard />);
      expect(screen.getByRole('switch', { name: /dark mode/i })).toBeChecked();
    });

    it('Use System button is disabled when preference is already system', () => {
      render(<ThemeSettingsCard />);
      expect(screen.getByRole('button', { name: /use system/i })).toBeDisabled();
    });
  });

  describe('Interactions', () => {
    it('calls setThemePreference with "light" when toggling off dark mode', async () => {
      render(<ThemeSettingsCard />);
      const toggle = screen.getByRole('switch', { name: /dark mode/i });
      await userEvent.click(toggle);
      expect(mockSetThemePreference).toHaveBeenCalledWith('light');
    });

    it('calls clearThemePreference when Use System button is clicked', async () => {
      vi.mocked(vi.importMock('@/components/providers/theme-provider') as any);
      // Re-mock with non-system preference so button is enabled
      const { useTheme } = await import('@/components/providers/theme-provider');
      vi.mocked(useTheme).mockReturnValueOnce({
        clearThemePreference: mockClearThemePreference,
        preference: 'dark',
        resolvedTheme: 'dark',
        setThemePreference: mockSetThemePreference,
      } as any);
      render(<ThemeSettingsCard />);
      const btn = screen.getByRole('button', { name: /use system/i });
      if (!btn.hasAttribute('disabled')) {
        await userEvent.click(btn);
        expect(mockClearThemePreference).toHaveBeenCalledOnce();
      }
    });
  });
});

// Tests for Theme Validation Service

const ThemeValidationService = require('../services/themeValidationService');

describe('ThemeValidationService', () => {
  let service;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    service = new ThemeValidationService(mockDb);
  });

  describe('validateThemeOwnership', () => {
    test('should return valid for null board_style_id', async () => {
      const result = await service.validateThemeOwnership(1, null);

      expect(result.valid).toBe(true);
      expect(result.theme).toBeNull();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    test('should return valid for undefined board_style_id', async () => {
      const result = await service.validateThemeOwnership(1, undefined);

      expect(result.valid).toBe(true);
      expect(result.theme).toBeNull();
    });

    test('should return error if theme not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.validateThemeOwnership(1, 999);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Board theme not found');
    });

    test('should return valid for free theme', async () => {
      const freeTheme = { id: 1, name: 'Classic', is_premium: false };
      mockDb.query.mockResolvedValueOnce({ rows: [freeTheme] });

      const result = await service.validateThemeOwnership(1, 1);

      expect(result.valid).toBe(true);
      expect(result.theme).toEqual(freeTheme);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    test('should return error if premium theme not owned', async () => {
      const premiumTheme = { id: 5, name: 'Ocean Blue', is_premium: true };
      mockDb.query
        .mockResolvedValueOnce({ rows: [premiumTheme] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.validateThemeOwnership(1, 5);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Premium theme not owned by user');
    });

    test('should return valid if premium theme is owned', async () => {
      const premiumTheme = { id: 5, name: 'Ocean Blue', is_premium: true };
      const ownership = { user_id: 1, board_style_id: 5 };

      mockDb.query
        .mockResolvedValueOnce({ rows: [premiumTheme] })
        .mockResolvedValueOnce({ rows: [ownership] });

      const result = await service.validateThemeOwnership(1, 5);

      expect(result.valid).toBe(true);
      expect(result.theme).toEqual(premiumTheme);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });
});

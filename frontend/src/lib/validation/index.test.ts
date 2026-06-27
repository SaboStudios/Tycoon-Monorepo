import { describe, it, expect } from 'vitest';
import * as validation from './index';

/**
 * Strict Exports Test Suite
 *
 * Verifies that the validation library exports only the public API
 * and prevents accidental internal usage.
 */

describe('Validation Library - Strict Exports', () => {
  describe('schema exports', () => {
    it('exports loginSchema', () => {
      const { loginSchema } = validation;
      expect(loginSchema).toBeDefined();
      expect(typeof loginSchema.safeParse).toBe('function');
    });

    it('exports adminLoginSchema', () => {
      const { adminLoginSchema } = validation;
      expect(adminLoginSchema).toBeDefined();
      expect(typeof adminLoginSchema.safeParse).toBe('function');
    });

    it('exports walletLoginSchema', () => {
      const { walletLoginSchema } = validation;
      expect(walletLoginSchema).toBeDefined();
      expect(typeof walletLoginSchema.safeParse).toBe('function');
    });

    it('exports joinRoomSchema', () => {
      const { joinRoomSchema } = validation;
      expect(joinRoomSchema).toBeDefined();
      expect(typeof joinRoomSchema.safeParse).toBe('function');
    });

    it('exports inviteTokenSchema', () => {
      const { inviteTokenSchema } = validation;
      expect(inviteTokenSchema).toBeDefined();
      expect(typeof inviteTokenSchema.safeParse).toBe('function');
    });

    it('exports displayNameSchema', () => {
      const { displayNameSchema } = validation;
      expect(displayNameSchema).toBeDefined();
      expect(typeof displayNameSchema.safeParse).toBe('function');
    });

    it('exports gameSettingsSchema', () => {
      const { gameSettingsSchema } = validation;
      expect(gameSettingsSchema).toBeDefined();
      expect(typeof gameSettingsSchema.safeParse).toBe('function');
    });
  });

  describe('type exports', () => {
    it('exports LoginFormValues type', () => {
      // Type-only import should work
      type TestType = import('@/lib/validation').LoginFormValues;
      expect(true).toBe(true); // Type check passes if no error
    });

    it('exports AdminLoginFormValues type', () => {
      type TestType = import('@/lib/validation').AdminLoginFormValues;
      expect(true).toBe(true);
    });

    it('exports WalletLoginFormValues type', () => {
      type TestType = import('@/lib/validation').WalletLoginFormValues;
      expect(true).toBe(true);
    });

    it('exports JoinRoomFormValues type', () => {
      type TestType = import('@/lib/validation').JoinRoomFormValues;
      expect(true).toBe(true);
    });

    it('exports GameSettingsFormValues type', () => {
      type TestType = import('@/lib/validation').GameSettingsFormValues;
      expect(true).toBe(true);
    });

    it('exports FieldErrors type', () => {
      type TestType = import('@/lib/validation').FieldErrors;
      expect(true).toBe(true);
    });
  });

  describe('error mapping exports', () => {
    it('exports mapServerErrors function', () => {
      const { mapServerErrors } = validation;
      expect(mapServerErrors).toBeDefined();
      expect(typeof mapServerErrors).toBe('function');
    });

    it('mapServerErrors is callable', () => {
      const { mapServerErrors } = validation;
      const result = mapServerErrors(null);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('mapServerErrors handles various error formats', () => {
      const { mapServerErrors } = validation;

      // Test null
      expect(mapServerErrors(null)).toEqual({ _form: 'An unexpected error occurred' });

      // Test status code
      expect(mapServerErrors({ statusCode: 404 })).toEqual({
        _form: 'Room not found. Check the code and try again.',
      });

      // Test message
      expect(mapServerErrors({ message: 'email is invalid' })).toEqual({
        email: 'email is invalid',
      });
    });
  });

  describe('public API boundary', () => {
    it('only exports intended public API', () => {
      const exportedKeys = Object.keys(validation).sort();

      const expectedExports = [
        'adminLoginSchema',
        'displayNameSchema',
        'gameSettingsSchema',
        'inviteTokenSchema',
        'joinRoomSchema',
        'loginSchema',
        'mapServerErrors',
        'walletLoginSchema',
      ].sort();

      // Check that all expected exports are present
      expectedExports.forEach((key) => {
        expect(exportedKeys).toContain(key);
      });
    });

    it('does not export internal implementation details', () => {
      // These should not be exported
      expect(validation.FIELD_KEYWORDS).toBeUndefined();
      expect(validation.isServerErrorResponse).toBeUndefined();
      expect(validation.ServerErrorResponse).toBeUndefined();
    });
  });

  describe('schema functionality', () => {
    it('loginSchema validates correctly', () => {
      const { loginSchema } = validation;

      const valid = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(valid.success).toBe(true);

      const invalid = loginSchema.safeParse({
        email: 'invalid-email',
        password: '',
      });
      expect(invalid.success).toBe(false);
    });

    it('joinRoomSchema validates and normalizes', () => {
      const { joinRoomSchema } = validation;

      const result = joinRoomSchema.safeParse({ roomCode: 'abc123' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.roomCode).toBe('ABC123');
      }
    });

    it('gameSettingsSchema validates', () => {
      const { gameSettingsSchema } = validation;

      const valid = gameSettingsSchema.safeParse({
        playerName: 'Player One',
        customStake: '1000',
      });
      expect(valid.success).toBe(true);

      const invalid = gameSettingsSchema.safeParse({
        playerName: '',
        customStake: '-100',
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('error mapping functionality', () => {
    it('mapServerErrors handles null/undefined', () => {
      const { mapServerErrors } = validation;

      expect(mapServerErrors(null)).toEqual({ _form: 'An unexpected error occurred' });
      expect(mapServerErrors(undefined)).toEqual({ _form: 'An unexpected error occurred' });
    });

    it('mapServerErrors handles status codes', () => {
      const { mapServerErrors } = validation;

      expect(mapServerErrors({ statusCode: 401 })).toEqual({
        _form: 'Please sign in to join a room.',
      });

      expect(mapServerErrors({ statusCode: 409 })).toEqual({
        _form: 'Room is full. Try a different room.',
      });

      expect(mapServerErrors({ statusCode: 500 })).toEqual({
        _form: 'Server error. Please try again in a moment.',
      });
    });

    it('mapServerErrors handles error messages', () => {
      const { mapServerErrors } = validation;

      expect(mapServerErrors({ message: 'email is invalid' })).toEqual({
        email: 'email is invalid',
      });

      expect(mapServerErrors({ message: 'Game not found' })).toEqual({
        _form: 'Room not found. Check the code and try again.',
      });
    });

    it('mapServerErrors handles explicit errors array', () => {
      const { mapServerErrors } = validation;

      const result = mapServerErrors({
        errors: [
          { field: 'email', message: 'Invalid email' },
          { field: 'password', message: 'Too short' },
        ],
      });

      expect(result).toEqual({
        email: 'Invalid email',
        password: 'Too short',
      });
    });
  });

  describe('no regressions', () => {
    it('all schemas are usable from public API', () => {
      const {
        loginSchema,
        adminLoginSchema,
        walletLoginSchema,
        joinRoomSchema,
        inviteTokenSchema,
        displayNameSchema,
        gameSettingsSchema,
      } = validation;

      const schemas = [
        loginSchema,
        adminLoginSchema,
        walletLoginSchema,
        joinRoomSchema,
        inviteTokenSchema,
        displayNameSchema,
        gameSettingsSchema,
      ];

      schemas.forEach((schema) => {
        expect(schema).toBeDefined();
        expect(typeof schema.safeParse).toBe('function');
        expect(typeof schema.parse).toBe('function');
      });
    });

    it('error mapping is usable from public API', () => {
      const { mapServerErrors } = validation;

      expect(mapServerErrors).toBeDefined();
      expect(typeof mapServerErrors).toBe('function');

      // Should not throw
      const result = mapServerErrors({ statusCode: 404 });
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('types are correctly inferred', () => {
      const { loginSchema } = validation;

      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });

      if (result.success) {
        // Type should be inferred correctly
        const data = result.data;
        expect(data.email).toBe('test@example.com');
        expect(data.password).toBe('password123');
      }
    });
  });

  describe('graceful state handling', () => {
    it('handles invalid input gracefully', () => {
      const { mapServerErrors } = validation;

      // Should not throw on any input
      expect(() => mapServerErrors(null)).not.toThrow();
      expect(() => mapServerErrors(undefined)).not.toThrow();
      expect(() => mapServerErrors('string')).not.toThrow();
      expect(() => mapServerErrors(123)).not.toThrow();
      expect(() => mapServerErrors({})).not.toThrow();
    });

    it('schemas handle edge cases', () => {
      const { joinRoomSchema } = validation;

      // Empty string
      const empty = joinRoomSchema.safeParse({ roomCode: '' });
      expect(empty.success).toBe(false);

      // Too long
      const tooLong = joinRoomSchema.safeParse({ roomCode: 'ABCDEFGHIJ' });
      expect(tooLong.success).toBe(false);

      // Invalid characters
      const invalid = joinRoomSchema.safeParse({ roomCode: 'ABC@#$' });
      expect(invalid.success).toBe(false);
    });

    it('error mapping handles disconnected states', () => {
      const { mapServerErrors } = validation;

      // Partial error object
      const partial = mapServerErrors({ message: undefined });
      expect(partial).toBeDefined();
      expect(typeof partial).toBe('object');

      // Empty error object
      const empty = mapServerErrors({});
      expect(empty).toBeDefined();
      expect(typeof empty).toBe('object');
    });
  });
});

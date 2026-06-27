import { describe, it, expect } from 'vitest';
import { mapServerErrors } from './serverErrorMap';

describe('mapServerErrors', () => {
  describe('null/undefined handling', () => {
    it('returns _form fallback for null', () => {
      expect(mapServerErrors(null)).toEqual({ _form: 'An unexpected error occurred' });
    });

    it('returns _form fallback for undefined', () => {
      expect(mapServerErrors(undefined)).toEqual({ _form: 'An unexpected error occurred' });
    });

    it('returns _form fallback for non-object values', () => {
      expect(mapServerErrors('string')).toEqual({ _form: 'An unexpected error occurred' });
      expect(mapServerErrors(42)).toEqual({ _form: 'An unexpected error occurred' });
      expect(mapServerErrors(true)).toEqual({ _form: 'An unexpected error occurred' });
    });
  });

  describe('TycoonApiError details field (Priority 1)', () => {
    it('extracts field-level errors from details object', () => {
      const err = {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          email: ['Invalid email format'],
          password: ['Password must be at least 6 characters'],
        },
      };
      expect(mapServerErrors(err)).toEqual({
        email: 'Invalid email format',
        password: 'Password must be at least 6 characters',
      });
    });

    it('takes first message when field has multiple errors', () => {
      const err = {
        statusCode: 400,
        details: {
          roomCode: ['Invalid format', 'Must be 6 characters'],
        },
      };
      expect(mapServerErrors(err)).toEqual({
        roomCode: 'Invalid format',
      });
    });

    it('ignores empty error arrays in details', () => {
      const err = {
        statusCode: 400,
        details: {
          email: [],
          password: ['Required'],
        },
      };
      expect(mapServerErrors(err)).toEqual({
        password: 'Required',
      });
    });

    it('ignores non-string messages in details arrays', () => {
      const err = {
        statusCode: 400,
        details: {
          email: [null, undefined, 'Valid message'],
        },
      };
      expect(mapServerErrors(err)).toEqual({
        email: 'Valid message',
      });
    });

    it('returns empty object when details is empty', () => {
      const err = {
        statusCode: 400,
        details: {},
      };
      // Falls through to status code handling
      expect(mapServerErrors(err)).toEqual({
        _form: 'An unexpected error occurred',
      });
    });

    it('ignores invalid details format', () => {
      const err = {
        statusCode: 400,
        details: 'not an object',
      };
      // Falls through to status code handling
      expect(mapServerErrors(err)).toEqual({
        _form: 'An unexpected error occurred',
      });
    });
  });

  describe('explicit errors array (Priority 2)', () => {
    it('maps explicit errors array to fields', () => {
      const err = { errors: [{ field: 'roomCode', message: 'invalid' }] };
      expect(mapServerErrors(err)).toEqual({ roomCode: 'invalid' });
    });

    it('handles multiple field errors', () => {
      const err = {
        errors: [
          { field: 'email', message: 'Invalid email' },
          { field: 'password', message: 'Too short' },
        ],
      };
      expect(mapServerErrors(err)).toEqual({
        email: 'Invalid email',
        password: 'Too short',
      });
    });

    it('skips errors array if details is present (details has priority)', () => {
      const err = {
        details: { email: ['From details'] },
        errors: [{ field: 'email', message: 'From errors' }],
      };
      expect(mapServerErrors(err)).toEqual({
        email: 'From details',
      });
    });
  });

  describe('status code shortcuts (Priority 3)', () => {
    it('maps 401 statusCode to sign-in message', () => {
      expect(mapServerErrors({ statusCode: 401 })).toEqual({
        _form: 'Please sign in to join a room.',
      });
    });

    it('maps 403 statusCode to sign-in message', () => {
      expect(mapServerErrors({ statusCode: 403 })).toEqual({
        _form: 'Please sign in to join a room.',
      });
    });

    it('maps 404 statusCode to room-not-found message', () => {
      expect(mapServerErrors({ statusCode: 404 })).toEqual({
        _form: 'Room not found. Check the code and try again.',
      });
    });

    it('maps 409 statusCode to room-full message', () => {
      expect(mapServerErrors({ statusCode: 409 })).toEqual({
        _form: 'Room is full. Try a different room.',
      });
    });

    it('maps 410 statusCode to expired invite message', () => {
      expect(mapServerErrors({ statusCode: 410 })).toEqual({
        _form: 'This invite link has expired. Ask the host for a new one.',
      });
    });

    it('maps 500+ statusCode to server-error message', () => {
      expect(mapServerErrors({ statusCode: 500 })).toEqual({
        _form: 'Server error. Please try again in a moment.',
      });
      expect(mapServerErrors({ statusCode: 502 })).toEqual({
        _form: 'Server error. Please try again in a moment.',
      });
      expect(mapServerErrors({ statusCode: 503 })).toEqual({
        _form: 'Server error. Please try again in a moment.',
      });
    });

    it('does not map 2xx or 3xx status codes', () => {
      expect(mapServerErrors({ statusCode: 200 })).toEqual({
        _form: 'An unexpected error occurred',
      });
      expect(mapServerErrors({ statusCode: 301 })).toEqual({
        _form: 'An unexpected error occurred',
      });
    });
  });

  describe('message keyword extraction (Priority 4)', () => {
    it('maps "already joined" message to form error', () => {
      const err = { message: 'User already joined this game' };
      expect(mapServerErrors(err)).toEqual({
        _form: "You're already in this room.",
      });
    });

    it('maps "already in this" message to form error', () => {
      const err = { message: 'Player already in this room' };
      expect(mapServerErrors(err)).toEqual({
        _form: "You're already in this room.",
      });
    });

    it('maps "expired invite" message to form error', () => {
      const err = { message: 'Invite token expired for this room' };
      expect(mapServerErrors(err)).toEqual({
        _form: 'This invite link has expired. Ask the host for a new one.',
      });
    });

    it('maps "not found" message to form error', () => {
      const err = { message: 'Game not found' };
      expect(mapServerErrors(err)).toEqual({
        _form: 'Room not found. Check the code and try again.',
      });
    });

    it('maps "full" message to form error', () => {
      const err = { message: 'Game is full' };
      expect(mapServerErrors(err)).toEqual({
        _form: 'Room is full. Try a different room.',
      });
    });

    it('maps "unauthorized" message to form error', () => {
      const err = { message: 'Unauthorized access' };
      expect(mapServerErrors(err)).toEqual({
        _form: 'Please sign in to join a room.',
      });
    });

    it('maps "not authenticated" message to form error', () => {
      const err = { message: 'User not authenticated' };
      expect(mapServerErrors(err)).toEqual({
        _form: 'Please sign in to join a room.',
      });
    });

    it('handles message array with multiple messages', () => {
      const err = { message: ['First error', 'Second error'] };
      expect(mapServerErrors(err)).toEqual({
        _form: 'First error',
      });
    });

    it('filters out non-string messages from array', () => {
      const err = { message: [null, undefined, 'Valid message'] };
      expect(mapServerErrors(err)).toEqual({
        _form: 'Valid message',
      });
    });

    it('maps field keywords to field errors', () => {
      const err = { message: 'Invalid email format' };
      expect(mapServerErrors(err)).toEqual({
        email: 'Invalid email format',
      });
    });

    it('maps roomCode keyword to field error', () => {
      const err = { message: 'roomCode must be 6 characters' };
      expect(mapServerErrors(err)).toEqual({
        roomCode: 'roomCode must be 6 characters',
      });
    });

    it('maps password keyword to field error', () => {
      const err = { message: 'password is too short' };
      expect(mapServerErrors(err)).toEqual({
        password: 'password is too short',
      });
    });

    it('maps address keyword to field error', () => {
      const err = { message: 'address is invalid' };
      expect(mapServerErrors(err)).toEqual({
        address: 'address is invalid',
      });
    });

    it('maps chain keyword to field error', () => {
      const err = { message: 'chain is not supported' };
      expect(mapServerErrors(err)).toEqual({
        chain: 'chain is not supported',
      });
    });

    it('maps playerName keyword to field error', () => {
      const err = { message: 'playerName cannot be empty' };
      expect(mapServerErrors(err)).toEqual({
        playerName: 'playerName cannot be empty',
      });
    });

    it('maps customStake keyword to field error', () => {
      const err = { message: 'customStake must be positive' };
      expect(mapServerErrors(err)).toEqual({
        customStake: 'customStake must be positive',
      });
    });

    it('is case-insensitive for keyword matching', () => {
      const err = { message: 'EMAIL is required' };
      expect(mapServerErrors(err)).toEqual({
        email: 'EMAIL is required',
      });
    });

    it('falls back to _form when no keyword matches', () => {
      const err = { message: 'Something went wrong' };
      expect(mapServerErrors(err)).toEqual({
        _form: 'Something went wrong',
      });
    });

    it('handles plain string message', () => {
      const err = { message: 'something went wrong' };
      expect(mapServerErrors(err)).toEqual({ _form: 'something went wrong' });
    });
  });

  describe('priority ordering', () => {
    it('prefers details over errors array', () => {
      const err = {
        details: { email: ['From details'] },
        errors: [{ field: 'email', message: 'From errors' }],
      };
      expect(mapServerErrors(err)).toEqual({ email: 'From details' });
    });

    it('prefers errors array over status code', () => {
      const err = {
        statusCode: 404,
        errors: [{ field: 'roomCode', message: 'Custom error' }],
      };
      expect(mapServerErrors(err)).toEqual({ roomCode: 'Custom error' });
    });

    it('prefers status code over message keywords', () => {
      const err = {
        statusCode: 404,
        message: 'Something went wrong',
      };
      expect(mapServerErrors(err)).toEqual({
        _form: 'Room not found. Check the code and try again.',
      });
    });

    it('uses message keywords when status code is not recognized', () => {
      const err = {
        statusCode: 418, // I'm a teapot
        message: 'email is invalid',
      };
      expect(mapServerErrors(err)).toEqual({
        email: 'email is invalid',
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty message array', () => {
      const err = { message: [] };
      expect(mapServerErrors(err)).toEqual({
        _form: 'An unexpected error occurred',
      });
    });

    it('handles empty errors array', () => {
      const err = { errors: [] };
      expect(mapServerErrors(err)).toEqual({
        _form: 'An unexpected error occurred',
      });
    });

    it('handles object with no recognized fields', () => {
      const err = { foo: 'bar', baz: 123 };
      expect(mapServerErrors(err)).toEqual({
        _form: 'An unexpected error occurred',
      });
    });

    it('handles mixed valid and invalid error entries', () => {
      const err = {
        errors: [
          { field: 'email', message: 'Invalid' },
          { field: '', message: 'Empty field' },
          { field: 'password', message: 'Too short' },
        ],
      };
      expect(mapServerErrors(err)).toEqual({
        email: 'Invalid',
        '': 'Empty field',
        password: 'Too short',
      });
    });

    it('handles very long error messages', () => {
      const longMessage = 'A'.repeat(1000);
      const err = { message: longMessage };
      expect(mapServerErrors(err)).toEqual({
        _form: longMessage,
      });
    });

    it('handles special characters in messages', () => {
      const err = { message: 'Error: "invalid" <value> & more' };
      expect(mapServerErrors(err)).toEqual({
        _form: 'Error: "invalid" <value> & more',
      });
    });

    it('handles unicode in messages', () => {
      const err = { message: 'Erreur: 🚫 invalide' };
      expect(mapServerErrors(err)).toEqual({
        _form: 'Erreur: 🚫 invalide',
      });
    });
  });

  describe('real-world scenarios', () => {
    it('handles typical NestJS validation error', () => {
      const err = {
        statusCode: 400,
        message: ['email must be an email', 'password must be longer than or equal to 6 characters'],
      };
      expect(mapServerErrors(err)).toEqual({
        email: 'email must be an email',
        password: 'password must be longer than or equal to 6 characters',
      });
    });

    it('handles API error with structured details', () => {
      const err = {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          roomCode: ['Invalid format'],
          playerName: ['Too long'],
        },
      };
      expect(mapServerErrors(err)).toEqual({
        roomCode: 'Invalid format',
        playerName: 'Too long',
      });
    });

    it('handles game-specific error', () => {
      const err = {
        statusCode: 409,
        message: 'User 42 has already joined game 1',
      };
      expect(mapServerErrors(err)).toEqual({
        _form: "You're already in this room.",
      });
    });

    it('handles expired invite error', () => {
      const err = {
        statusCode: 410,
        message: 'Invite token expired for this room',
      };
      expect(mapServerErrors(err)).toEqual({
        _form: 'This invite link has expired. Ask the host for a new one.',
      });
    });

    it('handles server error', () => {
      const err = {
        statusCode: 500,
        message: 'Internal server error',
      };
      expect(mapServerErrors(err)).toEqual({
        _form: 'Server error. Please try again in a moment.',
      });
    });
  });
});

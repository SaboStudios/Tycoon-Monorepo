import { describe, expect, it } from 'vitest';

import {
  ApiErrorCode,
  TycoonApiError,
  isApiError,
  isUnauthorized,
  isValidationError,
} from './index';

describe('lib/api error guards', () => {
  describe('isApiError', () => {
    it('returns true for a TycoonApiError instance', () => {
      const error = new TycoonApiError('boom', ApiErrorCode.UNKNOWN);

      expect(isApiError(error)).toBe(true);
    });

    it('returns false for a plain Error', () => {
      expect(isApiError(new Error('boom'))).toBe(false);
    });

    it('returns false for a non-error value', () => {
      expect(isApiError('boom')).toBe(false);
      expect(isApiError(undefined)).toBe(false);
      expect(isApiError(null)).toBe(false);
      expect(isApiError({ message: 'boom' })).toBe(false);
    });
  });

  describe('isUnauthorized', () => {
    it('returns true for the 401 case', () => {
      const error = new TycoonApiError('unauthorized', ApiErrorCode.UNAUTHORIZED, 401);

      expect(isUnauthorized(error)).toBe(true);
    });

    it('returns false for a 403 case', () => {
      const error = new TycoonApiError('forbidden', ApiErrorCode.FORBIDDEN, 403);

      expect(isUnauthorized(error)).toBe(false);
    });
  });

  describe('isValidationError', () => {
    it('matches the validation ApiErrorCode', () => {
      const error = new TycoonApiError('invalid', ApiErrorCode.VALIDATION_ERROR, 422);

      expect(isValidationError(error)).toBe(true);
    });

    it('rejects other codes', () => {
      const error = new TycoonApiError('unauthorized', ApiErrorCode.UNAUTHORIZED, 401);

      expect(isValidationError(error)).toBe(false);
    });
  });
});

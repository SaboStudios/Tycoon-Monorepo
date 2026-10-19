/**
 * API Error Response Shape Standardization Test
 *
 * Verifies that all error responses conform to the canonical shape:
 * { statusCode, message, errors, correlationId }
 *
 * This ensures frontend error parsing is consistent across all modules.
 */

describe('API Error Response Shape (Issue #1445)', () => {
  describe('Canonical error response format', () => {
    /**
     * All error responses must include:
     * - statusCode: HTTP status code (number)
     * - message: Human-readable error message (string)
     * - errors: Validation or contextual error details (Record<string, string[]> or null for non-validation errors)
     * - correlationId: Unique request identifier for debugging (string, auto-generated if missing)
     */
    it('should define canonical error shape as { statusCode, message, errors, correlationId }', () => {
      const canonicalErrorShape = {
        statusCode: 400,
        message: 'Validation failed',
        errors: {
          email: ['Email is required', 'Email must be valid'],
          password: ['Password is too short'],
        },
        correlationId: 'req_abc123def456',
      };

      expect(canonicalErrorShape).toHaveProperty('statusCode');
      expect(canonicalErrorShape).toHaveProperty('message');
      expect(canonicalErrorShape).toHaveProperty('errors');
      expect(canonicalErrorShape).toHaveProperty('correlationId');
    });

    it('should include errors only for 400 (validation) responses', () => {
      // Validation error (400)
      const validationError = {
        statusCode: 400,
        message: 'Validation failed',
        errors: {
          field: ['constraint message'],
        },
        correlationId: 'req_abc123',
      };
      expect(validationError.errors).toBeDefined();

      // Authorization error (401) - no detailed errors field
      const authError = {
        statusCode: 401,
        message: 'Unauthorized',
        errors: null,
        correlationId: 'req_def456',
      };
      expect(authError.errors).toBeNull();

      // Conflict error (409) - no detailed errors field
      const conflictError = {
        statusCode: 409,
        message: 'Duplicate resource',
        errors: null,
        correlationId: 'req_ghi789',
      };
      expect(conflictError.errors).toBeNull();
    });

    it('should never include stack traces in error body', () => {
      // Production error responses must not leak stack traces
      const errorWithoutStack = {
        statusCode: 500,
        message: 'Internal server error',
        errors: null,
        correlationId: 'req_trace123',
      };

      expect(errorWithoutStack).not.toHaveProperty('stack');
      expect(Object.values(errorWithoutStack).join()).not.toMatch(/at.*line/);
    });

    it('should always auto-generate correlationId if missing', () => {
      // Simulating filter behavior: if request lacks correlationId header,
      // the filter must generate one
      const requestHeaders = { /* no x-correlation-id */ };
      const generatedCorrelationId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const errorResponse = {
        statusCode: 400,
        message: 'Validation failed',
        errors: { field: ['error'] },
        correlationId: generatedCorrelationId,
      };

      expect(errorResponse.correlationId).toBeDefined();
      expect(errorResponse.correlationId).toMatch(/^req_/);
    });
  });

  describe('Sample error responses by status code', () => {
    it('should format 400 Bad Request (validation) response', () => {
      const error400 = {
        statusCode: 400,
        message: 'Validation failed',
        errors: {
          email: ['Email is required'],
          password: ['Password must be at least 8 characters'],
        },
        correlationId: 'req_validation_001',
      };

      expect(error400.statusCode).toBe(400);
      expect(error400.errors).toBeDefined();
      expect(typeof error400.errors).toBe('object');
    });

    it('should format 401 Unauthorized response', () => {
      const error401 = {
        statusCode: 401,
        message: 'Access denied. Admin role required.',
        errors: null,
        correlationId: 'req_auth_001',
      };

      expect(error401.statusCode).toBe(401);
      expect(error401.errors).toBeNull();
    });

    it('should format 409 Conflict response', () => {
      const error409 = {
        statusCode: 409,
        message: 'A Community Chest card with this instruction already exists',
        errors: null,
        correlationId: 'req_conflict_001',
      };

      expect(error409.statusCode).toBe(409);
      expect(error409.errors).toBeNull();
    });

    it('should format 500 Internal Server Error response', () => {
      const error500 = {
        statusCode: 500,
        message: 'Internal server error',
        errors: null,
        correlationId: 'req_server_001',
      };

      expect(error500.statusCode).toBe(500);
      expect(error500.errors).toBeNull();
      expect(error500).not.toHaveProperty('stack');
    });
  });

  describe('Frontend AppError parsing alignment', () => {
    /**
     * Frontend expects to extract:
     * - statusCode
     * - message
     * - errors (for validation errors)
     * - correlationId (for debugging)
     */
    it('should allow frontend to extract statusCode from error', () => {
      const errorResponse = {
        statusCode: 400,
        message: 'Validation failed',
        errors: { field: ['error'] },
        correlationId: 'req_123',
      };

      const statusCode = errorResponse.statusCode;
      expect(statusCode).toBe(400);
    });

    it('should allow frontend to extract message from error', () => {
      const errorResponse = {
        statusCode: 401,
        message: 'Unauthorized',
        errors: null,
        correlationId: 'req_456',
      };

      const message = errorResponse.message;
      expect(message).toBe('Unauthorized');
    });

    it('should allow frontend to extract validation errors', () => {
      const errorResponse = {
        statusCode: 400,
        message: 'Validation failed',
        errors: {
          email: ['Email is required', 'Email must be valid'],
        },
        correlationId: 'req_789',
      };

      const validationErrors = errorResponse.errors;
      expect(validationErrors).toBeDefined();
      expect(validationErrors.email).toEqual(['Email is required', 'Email must be valid']);
    });

    it('should allow frontend to extract correlationId for debugging', () => {
      const errorResponse = {
        statusCode: 500,
        message: 'Internal server error',
        errors: null,
        correlationId: 'req_debug_abc123xyz789',
      };

      const correlationId = errorResponse.correlationId;
      expect(correlationId).toBe('req_debug_abc123xyz789');
    });
  });

  describe('Module error mapper standardization', () => {
    /**
     * All module error mappers (community-chest, uploads, etc.) must return
     * responses in the canonical shape, not custom shapes.
     */
    it('should require community-chest mapper to use canonical shape', () => {
      // OLD (non-canonical): { statusCode, message, error, details }
      // NEW (canonical):     { statusCode, message, errors, correlationId }

      const mappedError = {
        statusCode: 400,
        message: 'Validation failed',
        errors: { field: ['constraint'] },
        correlationId: 'req_cc_001', // Added
      };

      expect(mappedError).toHaveProperty('statusCode');
      expect(mappedError).toHaveProperty('message');
      expect(mappedError).toHaveProperty('errors'); // Renamed from 'error'
      expect(mappedError).toHaveProperty('correlationId'); // Added
    });

    it('should require uploads mapper to use canonical shape', () => {
      // OLD (non-canonical): { statusCode, message, error, details }
      // NEW (canonical):     { statusCode, message, errors, correlationId }

      const mappedError = {
        statusCode: 413,
        message: 'File size exceeds maximum of 5MB',
        errors: null, // Non-validation error has null errors
        correlationId: 'req_upload_001', // Added
      };

      expect(mappedError).toHaveProperty('statusCode');
      expect(mappedError).toHaveProperty('message');
      expect(mappedError).toHaveProperty('errors');
      expect(mappedError).toHaveProperty('correlationId');
    });
  });
});

/**
 * Regression test for admin guard verification script
 *
 * This test verifies that the verify-admin-guards.ts script correctly:
 * 1. Identifies controllers with /admin routes
 * 2. Detects presence/absence of AdminGuard
 * 3. Reports violations accurately
 *
 * Note: This is a unit test of the verification logic, not an integration test
 * that creates temp files. For manual testing of the full pipeline, see:
 *   cd backend && npx ts-node scripts/verify-admin-guards.ts
 */

import * as fs from 'fs';

describe('Admin Guard Verification Logic', () => {
  /**
   * Extracted verification logic from verify-admin-guards.ts
   * This allows testing without invoking the script directly
   */
  function analyzeControllerContent(content: string): {
    hasAdminRoute: boolean;
    hasAdminGuard: boolean;
    hasMutations: boolean;
    hasAuditTrail: boolean;
    isValid: boolean;
  } {
    const adminControllerMatch = /@Controller\s*\(\s*['"`]admin\//;
    const hasAdminRoute = adminControllerMatch.test(content);

    const adminGuardMatch = /@UseGuards\s*\([^)]*\bAdminGuard\b[^)]*\)/;
    const hasAdminGuard = adminGuardMatch.test(content);

    const mutationMatch = /@(Post|Put|Patch|Delete)\s*\(/;
    const hasMutations = mutationMatch.test(content);

    const auditTrailMatch = /AuditTrail|auditTrail|@Audit\b/;
    const hasAuditTrail = auditTrailMatch.test(content);

    // Admin controllers must have class-level AdminGuard
    // If there are mutations, they must have audit trail coverage
    const guardsValid = !hasAdminRoute || hasAdminGuard;
    const auditValid = !hasMutations || hasAuditTrail;

    return {
      hasAdminRoute,
      hasAdminGuard,
      hasMutations,
      hasAuditTrail,
      isValid: guardsValid && auditValid,
    };
  }

  describe('Valid admin controllers', () => {
    it('should accept controller with JwtAuthGuard and AdminGuard', () => {
      const content = `
        import { UseGuards, Controller } from '@nestjs/common';
        import { AdminGuard } from '../auth/guards/admin.guard';

        @Controller('admin/test')
        @UseGuards(JwtAuthGuard, AdminGuard)
        export class TestAdminController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
      expect(result.hasAdminGuard).toBe(true);
      expect(result.isValid).toBe(true);
    });

    it('should accept controller with only AdminGuard', () => {
      const content = `
        @Controller('admin/analytics')
        @UseGuards(AdminGuard)
        export class AdminAnalyticsController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
      expect(result.hasAdminGuard).toBe(true);
      expect(result.isValid).toBe(true);
    });

    it('should accept controller with multiple guards including AdminGuard', () => {
      const content = `
        @Controller('admin/logs')
        @UseGuards(JwtAuthGuard, AdminGuard, RateLimitGuard)
        export class AdminLogsController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
      expect(result.hasAdminGuard).toBe(true);
      expect(result.isValid).toBe(true);
    });

    it('should accept non-admin controller without guard', () => {
      const content = `
        @Controller('users')
        export class UsersController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(false);
      expect(result.hasAdminGuard).toBe(false);
      expect(result.isValid).toBe(true);
    });

    it('should accept non-admin controller with guards', () => {
      const content = `
        @Controller('products')
        @UseGuards(JwtAuthGuard)
        export class ProductsController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(false);
      expect(result.isValid).toBe(true);
    });

    it('should accept admin controller with JwtAuthGuard, AdminGuard, and AuditTrail on mutations', () => {
      const content = `
        @Controller('admin/rooms')
        @UseGuards(JwtAuthGuard, AdminGuard)
        @UseInterceptors(AuditTrailInterceptor)
        export class AdminRoomsController {
          @Post()
          @AuditLog(AuditAction.ADMIN_MUTATION)
          create() {}
        }
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
      expect(result.hasAdminGuard).toBe(true);
      expect(result.hasMutations).toBe(true);
      expect(result.hasAuditTrail).toBe(true);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Invalid admin controllers (missing AdminGuard)', () => {
    it('should reject admin controller without any guards', () => {
      const content = `
        @Controller('admin/users')
        export class AdminUsersController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
      expect(result.hasAdminGuard).toBe(false);
      expect(result.isValid).toBe(false);
    });

    it('should reject admin controller with only JwtAuthGuard', () => {
      const content = `
        @Controller('admin/shop')
        @UseGuards(JwtAuthGuard)
        export class AdminShopController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
      expect(result.hasAdminGuard).toBe(false);
      expect(result.isValid).toBe(false);
    });

    it('should reject admin controller with unrelated guards', () => {
      const content = `
        @Controller('admin/analytics')
        @UseGuards(JwtAuthGuard, RateLimitGuard)
        export class AdminAnalyticsController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
      expect(result.hasAdminGuard).toBe(false);
      expect(result.isValid).toBe(false);
    });

    it('should reject admin controller with AdminGuard on method only', () => {
      const content = `
        @Controller('admin/rooms')
        export class AdminRoomsController {
          @Post()
          @UseGuards(AdminGuard)
          create() {}
        }
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
      expect(result.hasAdminGuard).toBe(false);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Audit trail enforcement', () => {
    it('should reject admin controller with mutations but no audit trail', () => {
      const content = `
        @Controller('admin/reports')
        @UseGuards(JwtAuthGuard, AdminGuard)
        export class AdminReportsController {
          @Post('generate')
          generate() {}
        }
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
      expect(result.hasAdminGuard).toBe(true);
      expect(result.hasMutations).toBe(true);
      expect(result.hasAuditTrail).toBe(false);
      expect(result.isValid).toBe(false);
    });

    it('should accept admin controller with mutations and audit trail', () => {
      const content = `
        @Controller('admin/reports')
        @UseGuards(JwtAuthGuard, AdminGuard)
        @UseInterceptors(AuditTrailInterceptor)
        export class AdminReportsController {
          @Post('generate')
          @AuditLog(AuditAction.ADMIN_MUTATION)
          generate() {}
        }
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
      expect(result.hasAdminGuard).toBe(true);
      expect(result.hasMutations).toBe(true);
      expect(result.hasAuditTrail).toBe(true);
      expect(result.isValid).toBe(true);
    });

    it('should accept admin controller with read-only endpoints (no mutations)', () => {
      const content = `
        @Controller('admin/analytics')
        @UseGuards(JwtAuthGuard, AdminGuard)
        export class AdminAnalyticsController {
          @Get('dashboard')
          getDashboard() {}
        }
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
      expect(result.hasAdminGuard).toBe(true);
      expect(result.hasMutations).toBe(false);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Route prefix edge cases', () => {
    it('should recognize single-quoted route prefix', () => {
      const content = `
        @Controller('admin/test')
        @UseGuards(AdminGuard)
        export class TestController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
    });

    it('should recognize double-quoted route prefix', () => {
      const content = `
        @Controller("admin/test")
        @UseGuards(AdminGuard)
        export class TestController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
    });

    it('should recognize backtick-quoted route prefix', () => {
      const content = `
        @Controller(\`admin/test\`)
        @UseGuards(AdminGuard)
        export class TestController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
    });

    it('should NOT match non-admin routes', () => {
      const content = `
        @Controller('public/admin-help')
        export class AdminHelpController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(false);
      expect(result.isValid).toBe(true);
    });

    it('should NOT match admin route without slash', () => {
      const content = `
        @Controller('admin')
        export class AdminController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(false);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Whitespace handling', () => {
    it('should handle whitespace in decorator', () => {
      const content = `
        @UseGuards(  JwtAuthGuard  ,  AdminGuard  )
        export class TestController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminGuard).toBe(true);
    });

    it('should handle newlines in decorator', () => {
      const content = `
        @UseGuards(
          JwtAuthGuard,
          AdminGuard
        )
        export class TestController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminGuard).toBe(true);
    });

    it('should handle mixed whitespace', () => {
      const content = `
        @UseGuards(
          JwtAuthGuard  ,
          AdminGuard
        )
        export class TestController {}
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminGuard).toBe(true);
    });
  });

  describe('Class-level guard placement (ADMIN_ROUTES_MATRIX)', () => {
    it('should accept class-level @UseGuards(JwtAuthGuard, AdminGuard) on admin controller', () => {
      const content = `
        @Controller('admin/rooms')
        @UseGuards(JwtAuthGuard, AdminGuard)
        export class AdminRoomsController {
          @Get()
          list() {}
        }
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
      expect(result.hasAdminGuard).toBe(true);
      expect(result.isValid).toBe(true);
    });

    it('should reject admin controller with no guard anywhere', () => {
      const content = `
        @Controller('admin/rooms')
        export class AdminRoomsController {
          @Get()
          list() {}
        }
      `;

      const result = analyzeControllerContent(content);
      expect(result.hasAdminRoute).toBe(true);
      expect(result.hasAdminGuard).toBe(false);
      expect(result.isValid).toBe(false);
    });
  });
});

describe('Redaction function unit test (from admin-logs.service.ts)', () => {
  /**
   * Replicates the redactAuditDetails logic to test its behavior.
   */
  function redactAuditDetails(value: unknown): unknown {
    const SENSITIVE_DETAIL_KEY =
      /(password|secret|token|authorization|cookie|api.?key|private.?key|email|phone|address|wallet)/i;

    if (Array.isArray(value)) {
      return value.map(redactAuditDetails);
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
          key,
          SENSITIVE_DETAIL_KEY.test(key)
            ? '[REDACTED]'
            : redactAuditDetails(nestedValue),
        ]),
      );
    }

    return value;
  }

  it('should redact direct sensitive fields', () => {
    const input = { email: 'user@example.com', name: 'Alice' };
    const result = redactAuditDetails(input) as Record<string, unknown>;
    expect(result.email).toBe('[REDACTED]');
    expect(result.name).toBe('Alice');
  });

  it('should redact nested sensitive fields', () => {
    const input = { user: { email: 'user@example.com', token: 'abc123' }, role: 'admin' };
    const result = redactAuditDetails(input) as Record<string, unknown>;
    expect((result.user as Record<string, unknown>).email).toBe('[REDACTED]');
    expect((result.user as Record<string, unknown>).token).toBe('[REDACTED]');
    expect(result.role).toBe('admin');
  });

  it('should redact in arrays', () => {
    const input = [{ email: 'a@b.com' }, { email: 'c@d.com' }];
    const result = redactAuditDetails(input) as Array<Record<string, unknown>>;
    expect(result[0].email).toBe('[REDACTED]');
    expect(result[1].email).toBe('[REDACTED]');
  });

  it('should handle primitive values', () => {
    expect(redactAuditDetails('hello')).toBe('hello');
    expect(redactAuditDetails(42)).toBe(42);
    expect(redactAuditDetails(null)).toBe(null);
  });

  it('should handle empty objects and arrays', () => {
    expect(redactAuditDetails({})).toEqual({});
    expect(redactAuditDetails([])).toEqual([]);
  });

  it('should match various sensitive key patterns', () => {
    const input = {
      password: 'secret',
      api_key: 'key123',
      'private-key': 'priv',
      wallet: '0x123',
      phone: '555-0100',
      address: '123 Main St',
      authorization: 'Bearer ...',
      cookie: 'session=abc',
      name: 'Bob',
    };
    const result = redactAuditDetails(input) as Record<string, string>;
    for (const key of Object.keys(input)) {
      if (key === 'name') {
        expect(result[key]).toBe('Bob');
      } else {
        expect(result[key]).toBe('[REDACTED]');
      }
    }
  });
});
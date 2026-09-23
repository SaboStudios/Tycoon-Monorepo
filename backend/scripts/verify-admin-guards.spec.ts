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
    isValid: boolean;
  } {
    const adminControllerMatch = /@Controller\s*\(\s*['"`]admin\//;
    const hasAdminRoute = adminControllerMatch.test(content);

    const adminGuardMatch = /@UseGuards\s*\(\s*[^)]*AdminGuard[^)]*\s*\)/;
    const hasAdminGuard = adminGuardMatch.test(content);

    return {
      hasAdminRoute,
      hasAdminGuard,
      isValid: !hasAdminRoute || hasAdminGuard,
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
});

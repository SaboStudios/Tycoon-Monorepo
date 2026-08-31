#!/usr/bin/env node

/**
 * CI Script: Verify all /admin controllers have AdminGuard
 *
 * This script scans all TypeScript controller files and ensures that:
 * 1. Any controller with @Controller('admin/...') decorator has @UseGuards(...AdminGuard)
 * 2. If violations are found, the build fails with a clear error message
 *
 * Usage:
 *   npx ts-node backend/scripts/verify-admin-guards.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

interface VerificationResult {
  file: string;
  hasAdminRoute: boolean;
  hasAdminGuard: boolean;
  isValid: boolean;
}

const BACKEND_SRC = path.join(__dirname, '../src');
const CONTROLLERS_GLOB = path.join(BACKEND_SRC, '**/*.controller.ts');

/**
 * Read and analyze a controller file for admin route and guard decorators
 */
function analyzeController(filePath: string): VerificationResult {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for @Controller('admin/...')
  const adminControllerMatch = /@Controller\s*\(\s*['"`]admin\//;
  const hasAdminRoute = adminControllerMatch.test(content);

  // Check for @UseGuards(...AdminGuard)
  // Matches: @UseGuards(JwtAuthGuard, AdminGuard)
  //          @UseGuards(AdminGuard)
  //          @UseGuards(...AdminGuard...)
  const adminGuardMatch =
    /@UseGuards\s*\(\s*[^)]*AdminGuard[^)]*\s*\)/;
  const hasAdminGuard = adminGuardMatch.test(content);

  return {
    file: path.relative(BACKEND_SRC, filePath),
    hasAdminRoute,
    hasAdminGuard,
    isValid: !hasAdminRoute || hasAdminGuard,
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Verifying AdminGuard coverage on all /admin controllers...\n');

  // Find all controller files
  const files = glob.sync(CONTROLLERS_GLOB);
  if (files.length === 0) {
    console.error('❌ No controller files found!');
    process.exit(1);
  }

  console.log(`Found ${files.length} controller files\n`);

  const results: VerificationResult[] = [];
  const violations: VerificationResult[] = [];

  // Analyze each controller
  for (const file of files) {
    const result = analyzeController(file);
    results.push(result);
    if (!result.isValid) {
      violations.push(result);
    }
  }

  // Log admin routes
  const adminRoutes = results.filter((r) => r.hasAdminRoute);
  console.log(`📋 Found ${adminRoutes.length} admin controller(s):\n`);
  for (const route of adminRoutes) {
    const status = route.isValid ? '✅' : '❌';
    console.log(`  ${status} ${route.file}`);
  }
  console.log();

  // Report violations
  if (violations.length > 0) {
    console.error(
      `❌ FAILED: ${violations.length} admin controller(s) missing AdminGuard:\n`,
    );
    for (const violation of violations) {
      console.error(`  ❌ ${violation.file}`);
      console.error(
        `     Add: @UseGuards(JwtAuthGuard, AdminGuard) to the controller class\n`,
      );
    }
    process.exit(1);
  }

  console.log('✅ All admin controllers have AdminGuard!\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Verification script error:', err);
  process.exit(1);
});

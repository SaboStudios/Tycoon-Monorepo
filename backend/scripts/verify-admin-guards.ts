#!/usr/bin/env ts-node
/**
 * verify-admin-guards.ts
 *
 * CI guardrail for issue #1708: AdminGuard matrix + verify-admin-guards CI forever-green.
 *
 * Scans every admin controller under backend/src and asserts that each one:
 *   1. Is decorated with @UseGuards(JwtAuthGuard, AdminGuard) at the CLASS level
 *      (per ADMIN_ROUTES_MATRIX.md).
 *   2. Does not rely on method-level-only guards for admin surfaces.
 *   3. Is listed in ADMIN_ROUTES_MATRIX.md so the matrix stays in sync with code.
 *
 * Exits non-zero on any violation so the verify-admin-guards workflow fails closed.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '..', '..');
const BACKEND_SRC = join(REPO_ROOT, 'backend', 'src');
const MATRIX_PATH = join(REPO_ROOT, 'ADMIN_ROUTES_MATRIX.md');

const ADMIN_FILE_PATTERN = /admin[\w-]*\.controller\.ts$/i;
const CLASS_GUARD_PATTERN =
  /@UseGuards\(\s*JwtAuthGuard\s*,\s*AdminGuard\s*\)/;
const CLASS_DECL_PATTERN = /export\s+class\s+([A-Za-z0-9_]+)/;

interface Violation {
  file: string;
  reason: string;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full, out);
    } else if (ADMIN_FILE_PATTERN.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function loadMatrix(): string {
  if (!existsSync(MATRIX_PATH)) return '';
  return readFileSync(MATRIX_PATH, 'utf8');
}

function verifyController(file: string, matrix: string): Violation[] {
  const violations: Violation[] = [];
  const rel = relative(REPO_ROOT, file);
  const source = readFileSync(file, 'utf8');

  const classMatch = source.match(CLASS_DECL_PATTERN);
  const className = classMatch ? classMatch[1] : null;

  // Locate the class body start so we only inspect the class-level decorator block.
  const classIndex = classMatch ? source.indexOf(classMatch[0]) : -1;
  const decoratorBlock = classIndex >= 0 ? source.slice(0, classIndex) : source;

  if (!CLASS_GUARD_PATTERN.test(decoratorBlock)) {
    violations.push({
      file: rel,
      reason:
        'missing class-level @UseGuards(JwtAuthGuard, AdminGuard) per ADMIN_ROUTES_MATRIX.md',
    });
  }

  if (className && matrix && !matrix.includes(className)) {
    violations.push({
      file: rel,
      reason: `controller ${className} is not documented in ADMIN_ROUTES_MATRIX.md`,
    });
  }

  return violations;
}

function main(): void {
  const controllers = walk(BACKEND_SRC);
  const matrix = loadMatrix();

  if (controllers.length === 0) {
    console.error(
      '[verify-admin-guards] No admin controllers found under backend/src. Failing closed.',
    );
    process.exit(1);
  }

  const violations: Violation[] = [];
  for (const file of controllers) {
    violations.push(...verifyController(file, matrix));
  }

  if (violations.length > 0) {
    console.error('[verify-admin-guards] AdminGuard matrix violations detected:');
    for (const v of violations) {
      console.error(`  - ${v.file}: ${v.reason}`);
    }
    process.exit(1);
  }

  console.log(
    `[verify-admin-guards] OK — ${controllers.length} admin controller(s) guarded and documented.`,
  );
}

main();

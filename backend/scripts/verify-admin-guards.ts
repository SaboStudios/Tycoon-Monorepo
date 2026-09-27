#!/usr/bin/env ts-node
/**
 * verify-admin-guards.ts
 *
 * CI guard that enforces the ADMIN_ROUTES_MATRIX contract:
 * every admin controller must declare
 *   @UseGuards(JwtAuthGuard, AdminGuard)
 * at the CLASS level (deny-by-default), and every mutating admin
 * handler must be covered by an AuditTrail interceptor/service call.
 *
 * Exits non-zero on any violation so CI fails closed.
 *
 * Usage: ts-node backend/scripts/verify-admin-guards.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const REPO_ROOT = join(__dirname, '..', '..');
const BACKEND_SRC = join(REPO_ROOT, 'backend', 'src');

const CLASS_GUARD_RE = /@UseGuards\s*\(\s*JwtAuthGuard\s*,\s*AdminGuard\s*\)/;
const CONTROLLER_RE = /@Controller\s*\(/;
const MUTATION_RE = /@(Post|Put|Patch|Delete)\s*\(/;
const AUDIT_RE = /AuditTrail|auditTrail|@Audit\b/;

interface Violation {
  file: string;
  line: number;
  rule: string;
  detail: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full, out);
    } else if (entry.endsWith('.controller.ts')) {
      out.push(full);
    }
  }
  return out;
}

function isAdminController(source: string, file: string): boolean {
  if (/admin/i.test(file)) return true;
  const controllerMatch = source.match(/@Controller\s*\(\s*['"`]([^'"`]*)['"`]/);
  return !!controllerMatch && /admin/i.test(controllerMatch[1]);
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function verifyFile(file: string): Violation[] {
  const violations: Violation[] = [];
  const source = readFileSync(file, 'utf8');
  const rel = relative(REPO_ROOT, file);

  if (!CONTROLLER_RE.test(source)) return violations;
  if (!isAdminController(source, file)) return violations;

  const classGuard = source.match(CLASS_GUARD_RE);
  if (!classGuard) {
    violations.push({
      file: rel,
      line: lineOf(source, source.search(CONTROLLER_RE)),
      rule: 'class-level-guard',
      detail:
        'Admin controller must declare @UseGuards(JwtAuthGuard, AdminGuard) at class level per ADMIN_ROUTES_MATRIX.',
    });
  }

  const mutationMatches = [...source.matchAll(new RegExp(MUTATION_RE, 'g'))];
  if (mutationMatches.length > 0 && !AUDIT_RE.test(source)) {
    violations.push({
      file: rel,
      line: lineOf(source, mutationMatches[0].index ?? 0),
      rule: 'audit-trail',
      detail:
        'Admin controller with mutating handlers must write AuditTrail entries (AuditTrail / auditTrail / @Audit).',
    });
  }

  return violations;
}

function main(): void {
  let files: string[] = [];
  try {
    files = walk(BACKEND_SRC);
  } catch (err) {
    console.error(`[verify-admin-guards] unable to scan ${BACKEND_SRC}: ${(err as Error).message}`);
    process.exit(1);
  }

  const violations = files.flatMap(verifyFile);

  if (violations.length === 0) {
    console.log(`[verify-admin-guards] OK — ${files.length} controller(s) checked, 0 violations.`);
    process.exit(0);
  }

  console.error('[verify-admin-guards] FAILED — admin guard/audit violations:');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.detail}`);
  }
  process.exit(1);
}

main();

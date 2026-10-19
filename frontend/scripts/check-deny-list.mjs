#!/usr/bin/env node
/**
 * Frontend deny-list CI gate (issue #1811).
 *
 * Scans player-facing frontend copy/source for forbidden Stellar copy strings
 * (Stellar / XLM / Lumens / Soroban wallet references). Per ADR-003 the NEAR
 * wallet is the only supported chain UI until Stellar is gated ready, so any
 * player-facing mention of Stellar must fail CI.
 *
 * Usage:
 *   node frontend/scripts/check-deny-list.mjs [rootDir]
 *
 * Exits non-zero with file:line reporting when a forbidden string is found.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_ROOT = join(SCRIPT_DIR, '..');

/**
 * Single source of truth for the deny-list. Each entry is a case-insensitive
 * regex matched against player-facing copy. Keep this list authoritative: the
 * Vitest suite (frontend/scripts/check-deny-list.test.mjs) imports it.
 */
export const DENY_LIST = [
  { id: 'stellar', pattern: /\bstellar\b/i },
  { id: 'xlm', pattern: /\bxlm\b/i },
  { id: 'lumens', pattern: /\blumens?\b/i },
  { id: 'soroban', pattern: /\bsoroban\b/i },
];

/**
 * Allow-list of NEAR-only copy that must always pass. Used by tests to prove
 * the matcher does not over-block the supported chain UI.
 */
export const ALLOW_LIST = [
  'Connect your NEAR wallet to play',
  'NEAR wallet is the only supported chain',
  'Sign in with NEAR',
];

/** File extensions scanned for player-facing copy. */
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mdx', '.json']);

/** Directories never scanned (build output, deps, tests, this gate itself). */
const IGNORED_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.git',
  '__tests__',
  'e2e',
]);

/**
 * Normalize a line for matching: collapse whitespace so "Stellar  Wallet" and
 * "Stellar Wallet" behave identically, and trim surrounding padding.
 */
export function normalizeLine(line) {
  return line.replace(/\s+/g, ' ').trim();
}

/**
 * Return the deny-list entries that match a single line of copy.
 * @param {string} line
 * @returns {{id: string, pattern: RegExp}[]}
 */
export function matchLine(line) {
  const normalized = normalizeLine(line);
  if (!normalized) return [];
  return DENY_LIST.filter((entry) => entry.pattern.test(normalized));
}

/**
 * Scan a file's contents and return violations with 1-based line numbers.
 * @param {string} contents
 * @param {string} filePath
 * @returns {{file: string, line: number, id: string, text: string}[]}
 */
export function scanContents(contents, filePath) {
  const violations = [];
  const lines = contents.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const matches = matchLine(lines[i]);
    for (const match of matches) {
      violations.push({
        file: filePath,
        line: i + 1,
        id: match.id,
        text: normalizeLine(lines[i]),
      });
    }
  }
  return violations;
}

/** Recursively collect scannable files under a directory. */
function collectFiles(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      collectFiles(full, acc);
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(extname(entry.name))) {
      acc.push(full);
    }
  }
  return acc;
}

/** Scan a directory tree and return all violations. */
export function scanDirectory(rootDir) {
  const violations = [];
  for (const file of collectFiles(rootDir)) {
    let contents;
    try {
      contents = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    violations.push(...scanContents(contents, relative(rootDir, file)));
  }
  return violations;
}

function main() {
  const rootDir = process.argv[2] ? join(process.cwd(), process.argv[2]) : DEFAULT_ROOT;
  let stat;
  try {
    stat = statSync(rootDir);
  } catch {
    console.error(`[deny-list] scan root not found: ${rootDir}`);
    process.exit(1);
  }
  if (!stat.isDirectory()) {
    console.error(`[deny-list] scan root is not a directory: ${rootDir}`);
    process.exit(1);
  }

  const violations = scanDirectory(rootDir);
  if (violations.length === 0) {
    console.log('[deny-list] OK: no forbidden Stellar copy strings found.');
    process.exit(0);
  }

  console.error('[deny-list] Forbidden Stellar copy strings detected:');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.id}]  ${v.text}`);
  }
  console.error(
    `[deny-list] ${violations.length} violation(s). NEAR is the only supported chain UI (ADR-003).`,
  );
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

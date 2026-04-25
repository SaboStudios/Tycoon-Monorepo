#!/usr/bin/env node
/**
 * check-bundle-size.mjs
 *
 * Reads the Next.js build output (.next/static/chunks) and compares
 * gzip sizes against the budgets defined in .size-limit.json.
 *
 * Writes bundle-size-report.json for trend tracking.
 * Exits with code 1 if any budget is exceeded.
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs
 *
 * To exempt a temporary breach, see BUNDLE_BUDGET.md.
 */

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { createGzip } from 'zlib';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const ROOT = resolve(process.cwd());
const CHUNKS_DIR = join(ROOT, '.next', 'static', 'chunks');
const REPORT_PATH = join(ROOT, 'bundle-size-report.json');
const BUDGETS_PATH = join(ROOT, '.size-limit.json');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseBytes(limitStr) {
  const [num, unit] = limitStr.trim().split(' ');
  const n = parseFloat(num);
  switch (unit.toLowerCase()) {
    case 'kb': return Math.round(n * 1024);
    case 'mb': return Math.round(n * 1024 * 1024);
    default:   return Math.round(n);
  }
}

async function gzipSize(filePath) {
  const tmp = join(tmpdir(), randomBytes(8).toString('hex') + '.gz');
  await pipeline(createReadStream(filePath), createGzip(), createWriteStream(tmp));
  const size = statSync(tmp).size;
  return size;
}

function walkChunks(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => join(dir, f));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(CHUNKS_DIR)) {
    console.error('❌  .next/static/chunks not found. Run `next build` first.');
    process.exit(1);
  }

  const budgets = JSON.parse(readFileSync(BUDGETS_PATH, 'utf8'));
  const files = walkChunks(CHUNKS_DIR);

  // Compute gzip size for every chunk
  const chunkSizes = {};
  for (const f of files) {
    chunkSizes[f] = await gzipSize(f);
  }

  const totalJs = Object.values(chunkSizes).reduce((a, b) => a + b, 0);

  // Match glob-style path patterns (simple wildcard support)
  function matchFiles(pattern) {
    if (!pattern) return files;
    const re = new RegExp(
      pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*'),
    );
    return files.filter((f) => re.test(f.replace(/\\/g, '/')));
  }

  const results = [];
  let failed = false;

  for (const budget of budgets) {
    let size;

    if (budget.name === 'Total build output (JS)') {
      size = totalJs;
    } else if (budget.name === 'Total First Load JS') {
      // Approximate: framework + main + pages/_app chunks
      const relevant = files.filter(
        (f) => /framework/.test(f) || /main-/.test(f) || /pages\/_app/.test(f) || /app-/.test(f),
      );
      size = relevant.reduce((a, f) => a + (chunkSizes[f] ?? 0), 0);
    } else if (budget.path) {
      const matched = matchFiles(budget.path);
      size = matched.reduce((a, f) => a + (chunkSizes[f] ?? 0), 0);
    } else {
      continue;
    }

    const limitBytes = parseBytes(budget.limit);
    const exceeded = size > limitBytes;
    if (exceeded) failed = true;

    const entry = {
      name: budget.name,
      size: formatBytes(size),
      sizeBytes: size,
      limit: budget.limit,
      limitBytes,
      exceeded,
      delta: formatBytes(size - limitBytes),
    };

    results.push(entry);

    const icon = exceeded ? '❌' : '✅';
    const delta = exceeded ? ` (+${formatBytes(size - limitBytes)} over budget)` : '';
    console.log(`${icon}  ${budget.name}: ${formatBytes(size)} / ${budget.limit}${delta}`);
  }

  // Write trend report
  const report = {
    timestamp: new Date().toISOString(),
    commit: process.env.GITHUB_SHA ?? 'local',
    branch: process.env.GITHUB_REF_NAME ?? 'local',
    passed: !failed,
    results,
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n📄  Report written to bundle-size-report.json`);

  if (failed) {
    console.error(
      '\n❌  Bundle budget exceeded. See BUNDLE_BUDGET.md for how to fix or request an exemption.',
    );
    process.exit(1);
  } else {
    console.log('\n✅  All bundle budgets passed.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Bundle budget + size regression gate (#1759, #1460).
 *
 * Reads the Next.js build output in `.next/` and checks each budget in
 * `.size-limit.json`. Sizes are gzip-compressed bytes (zlib level 9).
 *
 *   node scripts/check-bundle-size.mjs                  # check (CI)
 *   node scripts/check-bundle-size.mjs --update-baseline # re-baseline in a PR
 *
 * Fails (exit 1) when:
 *   - a budget exceeds its hard `limit`;
 *   - a budget grew beyond the allowed regression over bundle-baseline.json;
 *   - MSW / mock code is found in any client chunk (SW-FE-001, SW-FE-1462).
 * Fails closed (exit 2) on misconfiguration: missing build output, invalid
 * config, unknown route, missing chunk file, or a glob that matches nothing.
 *
 * Works with Turbopack and webpack builds of Next 16. Per-route chunks come
 * from `.next/server/app/**\/page_client-reference-manifest.js`, which is
 * parsed as JSON. Build output is never executed.
 *
 * Dependency-free (Node >= 20) so it runs without `npm ci`.
 * See frontend/BUNDLE_BUDGET.md.
 */

import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');

export const EXIT_OK = 0;
export const EXIT_BUDGET = 1;
export const EXIT_CONFIG = 2;

/** Budget kinds understood by this gate. */
export const BUDGET_KINDS = ['shared', 'route', 'largestFirstLoad', 'glob'];

/** Defaults for the regression gate; overridable per budget. */
export const DEFAULT_MAX_REGRESSION_PERCENT = 5;
export const DEFAULT_MIN_REGRESSION_BYTES = 1024;

/**
 * Markers that only exist in MSW's client code. If any appear in a client
 * chunk, mocks have leaked into the production bundle.
 */
export const FORBIDDEN_CLIENT_MARKERS = [
  { id: 'msw-log-prefix', pattern: /\[MSW\]/ },
  { id: 'msw-worker-script', pattern: /mockServiceWorker\.js/ },
  { id: 'msw-integrity-check', pattern: /INTEGRITY_CHECK_REQUEST/ },
];

export class BundleConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BundleConfigError';
  }
}

const UNITS = { b: 1, kb: 1024, mb: 1024 * 1024 };

/** Parse "120 kB" / "1.5 MB" / "500 B" into bytes (1 kB = 1024 B). */
export function parseLimit(limit) {
  if (typeof limit !== 'string') {
    throw new BundleConfigError(`limit must be a string like "120 kB" (got ${JSON.stringify(limit)})`);
  }
  const match = /^\s*(\d+(?:\.\d+)?)\s*(B|kB|KB|MB)\s*$/.exec(limit);
  if (!match) {
    throw new BundleConfigError(`invalid limit "${limit}" (expected e.g. "120 kB", "1.5 MB", "500 B")`);
  }
  const bytes = Math.round(Number(match[1]) * UNITS[match[2].toLowerCase()]);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new BundleConfigError(`limit "${limit}" must be positive`);
  }
  return bytes;
}

export function formatBytes(bytes) {
  const sign = bytes < 0 ? '-' : '';
  const abs = Math.abs(bytes);
  if (abs >= 1024 * 1024) return `${sign}${(abs / (1024 * 1024)).toFixed(2)} MB`;
  if (abs >= 1024) return `${sign}${(abs / 1024).toFixed(1)} kB`;
  return `${sign}${abs} B`;
}

/** Validate `.size-limit.json`; throws BundleConfigError on any problem. */
export function validateConfig(config) {
  if (!Array.isArray(config) || config.length === 0) {
    throw new BundleConfigError('.size-limit.json must be a non-empty array of budgets');
  }
  const names = new Set();
  return config.map((entry, index) => {
    const where = `.size-limit.json[${index}]`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new BundleConfigError(`${where} must be an object`);
    }
    if (typeof entry.name !== 'string' || entry.name.trim() === '') {
      throw new BundleConfigError(`${where}.name is required`);
    }
    if (names.has(entry.name)) {
      throw new BundleConfigError(`${where}.name "${entry.name}" is duplicated`);
    }
    names.add(entry.name);
    if (!BUDGET_KINDS.includes(entry.kind)) {
      throw new BundleConfigError(`${where}.kind must be one of ${BUDGET_KINDS.join(', ')}`);
    }
    if (entry.kind === 'route' && (typeof entry.route !== 'string' || !entry.route.startsWith('/'))) {
      throw new BundleConfigError(`${where}.route must be an app route such as "/" or "/join-room"`);
    }
    if (entry.kind === 'glob' && (typeof entry.path !== 'string' || entry.path.includes('..'))) {
      throw new BundleConfigError(`${where}.path must be a glob inside the frontend dir`);
    }
    for (const key of ['maxRegressionPercent', 'minRegressionBytes']) {
      if (entry[key] !== undefined && (typeof entry[key] !== 'number' || entry[key] < 0)) {
        throw new BundleConfigError(`${where}.${key} must be a non-negative number`);
      }
    }
    return {
      ...entry,
      limitBytes: parseLimit(entry.limit),
      maxRegressionPercent: entry.maxRegressionPercent ?? DEFAULT_MAX_REGRESSION_PERCENT,
      minRegressionBytes: entry.minRegressionBytes ?? DEFAULT_MIN_REGRESSION_BYTES,
    };
  });
}

function readJson(file, label) {
  if (!existsSync(file)) {
    throw new BundleConfigError(`${label} not found: ${file}`);
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new BundleConfigError(`${label} is not valid JSON: ${error.message}`);
  }
}

/** `/_next/static/chunks/a.js?dpl=x` -> `static/chunks/a.js`. */
export function normalizeChunkPath(chunk) {
  const clean = String(chunk).split('?')[0].split('#')[0];
  const match = /(?:^|\/)(static\/.+)$/.exec(clean);
  return match ? match[1] : null;
}

/**
 * Parse a client reference manifest without executing it. The file has the
 * shape `globalThis.__RSC_MANIFEST["/page"] = {JSON};`.
 */
export function parseClientReferenceManifest(source, file) {
  const assignment = /globalThis\.__RSC_MANIFEST\[("(?:[^"\\]|\\.)*")\]\s*=\s*/g;
  const matches = [...source.matchAll(assignment)];
  if (matches.length !== 1) {
    throw new BundleConfigError(`${file}: expected exactly one __RSC_MANIFEST assignment, found ${matches.length}`);
  }
  const start = matches[0].index + matches[0][0].length;
  const body = source.slice(start).trim().replace(/;\s*$/, '');
  let manifest;
  try {
    manifest = JSON.parse(body);
  } catch (error) {
    throw new BundleConfigError(`${file}: manifest body is not JSON (${error.message})`);
  }
  if (manifest === null || typeof manifest !== 'object') {
    throw new BundleConfigError(`${file}: manifest body is not an object`);
  }
  return manifest;
}

/** Client JS a route loads on first paint (excluding rootMainFiles). */
export function routeChunksFromManifest(manifest) {
  const chunks = new Set();
  for (const files of Object.values(manifest.entryJSFiles ?? {})) {
    for (const file of Array.isArray(files) ? files : []) {
      const normalized = normalizeChunkPath(file);
      if (normalized?.endsWith('.js')) chunks.add(normalized);
    }
  }
  for (const mod of Object.values(manifest.clientModules ?? {})) {
    if (!mod || mod.async) continue;
    for (const file of Array.isArray(mod.chunks) ? mod.chunks : []) {
      const normalized = normalizeChunkPath(file);
      if (normalized?.endsWith('.js')) chunks.add(normalized);
    }
  }
  return chunks;
}

/** Load build output: shared chunks and per-route chunk sets. */
export function loadBuild(nextDir) {
  if (!existsSync(nextDir) || !statSync(nextDir).isDirectory()) {
    throw new BundleConfigError(`build output not found at ${nextDir}. Run \`next build\` first.`);
  }
  const buildManifest = readJson(join(nextDir, 'build-manifest.json'), 'build-manifest.json');
  if (!Array.isArray(buildManifest.rootMainFiles) || buildManifest.rootMainFiles.length === 0) {
    throw new BundleConfigError('build-manifest.json has no rootMainFiles (is this an App Router build?)');
  }
  const shared = new Set(buildManifest.rootMainFiles.map(normalizeChunkPath).filter(Boolean));

  const routes = new Map();
  const appPaths = readJson(join(nextDir, 'app-path-routes-manifest.json'), 'app-path-routes-manifest.json');
  for (const [appPath, route] of Object.entries(appPaths)) {
    if (!appPath.endsWith('/page')) continue; // route handlers ship no client JS
    const manifestFile = join(nextDir, 'server', 'app', `${appPath}_client-reference-manifest.js`);
    if (!existsSync(manifestFile)) {
      throw new BundleConfigError(`client reference manifest missing for ${route}: ${manifestFile}`);
    }
    const manifest = parseClientReferenceManifest(readFileSync(manifestFile, 'utf8'), manifestFile);
    const chunks = routeChunksFromManifest(manifest);
    for (const file of shared) chunks.delete(file);
    routes.set(route, chunks);
  }
  return { shared, routes };
}

const sizeCache = new Map();

/** gzip size of one file under `.next/`; missing files fail closed. */
export function gzipSizeOf(nextDir, chunk) {
  const file = join(nextDir, chunk);
  if (sizeCache.has(file)) return sizeCache.get(file);
  if (!existsSync(file)) {
    throw new BundleConfigError(`chunk listed in a manifest is missing: ${file}`);
  }
  const size = gzipSync(readFileSync(file), { level: 9 }).length;
  sizeCache.set(file, size);
  return size;
}

function sumSizes(nextDir, chunks) {
  let total = 0;
  for (const chunk of chunks) total += gzipSizeOf(nextDir, chunk);
  return total;
}

/** Convert a glob (`*` within a segment, `**` across segments) to a RegExp. */
export function globToRegExp(pattern) {
  const parts = pattern.split('/');
  let source = '';
  parts.forEach((part, i) => {
    const last = i === parts.length - 1;
    if (part === '**') {
      source += last ? '.*' : '(?:[^/]+/)*';
      return;
    }
    source += part
      .split('*')
      .map((literal) => literal.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^/]*');
    if (!last) source += '/';
  });
  return new RegExp(`^${source}$`);
}

/** Expand a glob relative to root; returns sorted absolute paths. */
export function expandGlob(root, pattern) {
  const parts = pattern.split('/');
  const prefix = [];
  for (const part of parts) {
    if (part.includes('*')) break;
    prefix.push(part);
  }
  if (prefix.length === parts.length) {
    const file = join(root, ...parts);
    return existsSync(file) && statSync(file).isFile() ? [file] : [];
  }

  const regex = globToRegExp(pattern);
  const results = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && regex.test(relative(root, full).split(sep).join('/'))) results.push(full);
    }
  };
  walk(join(root, ...prefix));
  return results.sort();
}

/** Scan every client chunk for mock/MSW code. */
export function findForbiddenClientCode(nextDir) {
  const violations = [];
  for (const file of expandGlob(nextDir, 'static/**/*.js')) {
    const contents = readFileSync(file, 'utf8');
    for (const marker of FORBIDDEN_CLIENT_MARKERS) {
      if (marker.pattern.test(contents)) {
        violations.push({ file: relative(nextDir, file).split(sep).join('/'), id: marker.id });
      }
    }
  }
  return violations;
}

/** Measure one budget. Returns { sizeBytes, detail }. */
export function measureBudget(budget, build, rootDir, nextDir) {
  switch (budget.kind) {
    case 'shared':
      return { sizeBytes: sumSizes(nextDir, build.shared), detail: `${build.shared.size} root chunk(s)` };
    case 'route': {
      const chunks = build.routes.get(budget.route);
      if (!chunks) {
        const known = [...build.routes.keys()].sort().join(', ');
        throw new BundleConfigError(`budget "${budget.name}": route ${budget.route} not in build (known: ${known})`);
      }
      return { sizeBytes: sumSizes(nextDir, chunks), detail: `${chunks.size} route chunk(s)` };
    }
    case 'largestFirstLoad': {
      const sharedSize = sumSizes(nextDir, build.shared);
      let largest = { route: null, size: sharedSize };
      for (const [route, chunks] of build.routes) {
        if (route.startsWith('/_')) continue; // framework-internal routes
        const size = sharedSize + sumSizes(nextDir, chunks);
        if (largest.route === null || size > largest.size) largest = { route, size };
      }
      return { sizeBytes: largest.size, detail: `largest: ${largest.route ?? '(no routes)'}` };
    }
    case 'glob': {
      const files = expandGlob(rootDir, budget.path);
      if (files.length === 0) {
        throw new BundleConfigError(`budget "${budget.name}": glob ${budget.path} matched no files`);
      }
      let total = 0;
      for (const file of files) total += gzipSync(readFileSync(file), { level: 9 }).length;
      return { sizeBytes: total, detail: `${files.length} file(s)` };
    }
    default:
      throw new BundleConfigError(`unknown budget kind ${budget.kind}`);
  }
}

/** Compare a measurement against its limit and the baseline. */
export function evaluate(budget, sizeBytes, baselineEntry) {
  const baselineBytes = baselineEntry && Number.isFinite(baselineEntry.sizeBytes) ? baselineEntry.sizeBytes : 0;
  const deltaBytes = baselineBytes > 0 ? sizeBytes - baselineBytes : null;
  const allowedGrowth =
    baselineBytes > 0
      ? Math.max(budget.minRegressionBytes, Math.round((baselineBytes * budget.maxRegressionPercent) / 100))
      : null;

  const failures = [];
  if (sizeBytes > budget.limitBytes) {
    failures.push(`over limit by ${formatBytes(sizeBytes - budget.limitBytes)}`);
  }
  if (deltaBytes !== null && allowedGrowth !== null && deltaBytes > allowedGrowth) {
    failures.push(`grew ${formatBytes(deltaBytes)} vs baseline (allowed ${formatBytes(allowedGrowth)})`);
  }
  return { deltaBytes, allowedGrowth, failures, hasBaseline: baselineBytes > 0 };
}

function currentCommit(rootDir) {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function parseArgs(argv) {
  const args = { updateBaseline: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--update-baseline') args.updateBaseline = true;
    else if (['--dir', '--config', '--baseline', '--report'].includes(arg)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new BundleConfigError(`${arg} needs a value`);
      args[arg.slice(2)] = value;
      i += 1;
    } else throw new BundleConfigError(`unknown argument ${arg}`);
  }
  return args;
}

/** Run the gate. Returns an exit code; never calls process.exit. */
export function run(argv = [], { log = console.log, error = console.error } = {}) {
  let args;
  try {
    args = parseArgs(argv);
    const rootDir = resolve(args.dir ?? DEFAULT_ROOT);
    const nextDir = join(rootDir, '.next');
    const configPath = resolve(rootDir, args.config ?? '.size-limit.json');
    const baselinePath = resolve(rootDir, args.baseline ?? 'bundle-baseline.json');
    const reportPath = resolve(rootDir, args.report ?? 'bundle-size-report.json');

    const budgets = validateConfig(readJson(configPath, '.size-limit.json'));
    const baseline = existsSync(baselinePath) ? readJson(baselinePath, 'bundle-baseline.json') : { results: [] };
    const baselineByName = new Map((Array.isArray(baseline.results) ? baseline.results : []).map((r) => [r.name, r]));
    const build = loadBuild(nextDir);

    const results = budgets.map((budget) => {
      const { sizeBytes, detail } = measureBudget(budget, build, rootDir, nextDir);
      const verdict = evaluate(budget, sizeBytes, baselineByName.get(budget.name));
      return {
        name: budget.name,
        kind: budget.kind,
        ...(budget.route ? { route: budget.route } : {}),
        sizeBytes,
        limit: budget.limit,
        limitBytes: budget.limitBytes,
        baselineBytes: baselineByName.get(budget.name)?.sizeBytes ?? 0,
        deltaBytes: verdict.deltaBytes,
        detail,
        status: verdict.failures.length === 0 ? 'pass' : 'fail',
        failures: verdict.failures,
      };
    });

    const forbidden = findForbiddenClientCode(nextDir);

    const lines = results.map((r) => {
      const delta = r.deltaBytes === null ? 'no baseline' : `${r.deltaBytes >= 0 ? '+' : ''}${formatBytes(r.deltaBytes)}`;
      const mark = r.status === 'pass' ? 'PASS' : 'FAIL';
      const why = r.failures.length ? `  <- ${r.failures.join('; ')}` : '';
      return `  ${mark}  ${r.name}: ${formatBytes(r.sizeBytes)} / ${r.limit} (${delta}; ${r.detail})${why}`;
    });
    log('[bundle] gzip sizes vs .size-limit.json');
    lines.forEach((line) => log(line));
    for (const v of forbidden) error(`  FAIL  mock code in client bundle: ${v.file} [${v.id}]`);

    const failed = results.some((r) => r.status === 'fail') || forbidden.length > 0;
    const report = {
      generatedAt: new Date().toISOString(),
      commit: currentCommit(rootDir),
      status: failed ? 'fail' : 'pass',
      results,
      forbiddenClientCode: forbidden,
    };
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    if (process.env.GITHUB_STEP_SUMMARY) {
      const rows = results
        .map((r) => `| ${r.status === 'pass' ? '✅' : '❌'} | ${r.name} | ${formatBytes(r.sizeBytes)} | ${r.limit} | ${r.deltaBytes === null ? '—' : formatBytes(r.deltaBytes)} |`)
        .join('\n');
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### Bundle budget\n\n| | Budget | gzip | Limit | Δ baseline |\n|---|---|---|---|---|\n${rows}\n\n`,
      );
    }

    if (args.updateBaseline) {
      if (forbidden.length > 0 || results.some((r) => r.sizeBytes > r.limitBytes)) {
        error('[bundle] refusing to write a baseline that is over a hard limit or contains mock code.');
        return EXIT_BUDGET;
      }
      const next = {
        note: 'Re-baselined with `node scripts/check-bundle-size.mjs --update-baseline`. Commit it in the PR that intentionally changes bundle size; reviewers sign off on the diff. See BUNDLE_BUDGET.md.',
        lastUpdated: report.generatedAt,
        commit: report.commit,
        results: results.map(({ name, sizeBytes, limit, limitBytes }) => ({ name, sizeBytes, limit, limitBytes })),
      };
      writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
      log(`[bundle] baseline written to ${relative(process.cwd(), baselinePath) || baselinePath}`);
      return EXIT_OK;
    }

    if (failed) {
      error('[bundle] budget check failed. See frontend/BUNDLE_BUDGET.md for how to fix or re-baseline.');
      return EXIT_BUDGET;
    }
    log('[bundle] OK');
    return EXIT_OK;
  } catch (err) {
    if (err instanceof BundleConfigError) {
      error(`[bundle] configuration error (failing closed): ${err.message}`);
      return EXIT_CONFIG;
    }
    throw err;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = run(process.argv.slice(2));
}

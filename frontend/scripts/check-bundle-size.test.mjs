/**
 * Tests for the bundle budget gate (#1759). Plain `node:test`, no deps:
 *   node --test frontend/scripts/*.test.mjs
 *
 * Each case builds a synthetic `.next/` tree shaped like Next 16 output
 * (build-manifest.json, app-path-routes-manifest.json and per-route
 * page_client-reference-manifest.js), filled with random base64 so sizes are
 * realistic and distinct.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import {
  EXIT_BUDGET,
  EXIT_CONFIG,
  EXIT_OK,
  expandGlob,
  normalizeChunkPath,
  parseClientReferenceManifest,
  parseLimit,
  run,
  validateConfig,
} from './check-bundle-size.mjs';

const KB = 1024;

function write(file, contents) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

/** Poorly-compressible JS-ish payload of `bytes` raw bytes (+ optional code). */
function chunk(bytes, extra = '') {
  return `/*${randomBytes(bytes).toString('base64').slice(0, bytes)}*/${extra}`;
}

function rscManifest(appPath, entry, clientChunks = []) {
  const clientModules = Object.fromEntries(
    clientChunks.map((c, i) => [`[project]/mod${i}.tsx`, { id: i, name: '*', chunks: [`/_next/${c}`], async: false }]),
  );
  return (
    'globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\n' +
    `globalThis.__RSC_MANIFEST[${JSON.stringify(appPath)}] = ${JSON.stringify({
      moduleLoading: { prefix: '' },
      clientModules,
      entryJSFiles: { [`[project]/src/app${appPath}`]: entry },
    })};`
  );
}

/**
 * Build a fixture frontend dir. Sizes are raw kB per chunk.
 */
function fixture({ shared = 60, home = 10, joinRoom = 12, config, baseline, homeExtra = '' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'bundle-gate-'));
  const next = join(root, '.next');
  write(join(next, 'static/chunks/framework.js'), chunk(shared * KB));
  write(join(next, 'static/chunks/home.js'), chunk(home * KB, homeExtra));
  write(join(next, 'static/chunks/join.js'), chunk(joinRoom * KB));
  write(join(next, 'static/chunks/lazy.js'), chunk(5 * KB));
  write(
    join(next, 'build-manifest.json'),
    JSON.stringify({ rootMainFiles: ['static/chunks/framework.js'], polyfillFiles: [] }),
  );
  write(
    join(next, 'app-path-routes-manifest.json'),
    JSON.stringify({
      '/page': '/',
      '/join-room/page': '/join-room',
      '/api/health/route': '/api/health',
      '/_not-found/page': '/_not-found',
    }),
  );
  write(join(next, 'server/app/page_client-reference-manifest.js'), rscManifest('/page', ['static/chunks/home.js'], ['static/chunks/framework.js']));
  write(
    join(next, 'server/app/join-room/page_client-reference-manifest.js'),
    rscManifest('/join-room/page', ['static/chunks/join.js']),
  );
  write(join(next, 'server/app/_not-found/page_client-reference-manifest.js'), rscManifest('/_not-found/page', []));

  write(
    join(root, '.size-limit.json'),
    JSON.stringify(
      config ?? [
        { name: 'shared', kind: 'shared', limit: '100 kB' },
        { name: 'home', kind: 'route', route: '/', limit: '20 kB' },
        { name: 'join', kind: 'route', route: '/join-room', limit: '20 kB' },
        { name: 'largest', kind: 'largestFirstLoad', limit: '200 kB' },
        { name: 'total', kind: 'glob', path: '.next/static/**/*.js', limit: '500 kB' },
      ],
    ),
  );
  if (baseline) write(join(root, 'bundle-baseline.json'), JSON.stringify(baseline));
  return root;
}

function runIn(root, extra = []) {
  const out = [];
  const err = [];
  const code = run(['--dir', root, ...extra], { log: (m) => out.push(m), error: (m) => err.push(m) });
  return { code, out: out.join('\n'), err: err.join('\n'), root };
}

function report(root) {
  return JSON.parse(readFileSync(join(root, 'bundle-size-report.json'), 'utf8'));
}

test('passes and writes a report when every budget holds', () => {
  const root = fixture();
  try {
    const { code, out } = runIn(root);
    assert.equal(code, EXIT_OK, out);
    const r = report(root);
    assert.equal(r.status, 'pass');
    const byName = Object.fromEntries(r.results.map((x) => [x.name, x]));
    const gz = (name) => gzipSync(readFileSync(join(root, '.next/static/chunks', name)), { level: 9 }).length;
    assert.equal(byName.shared.sizeBytes, gz('framework.js'));
    // Route budgets exclude shared rootMainFiles even when a client module lists them.
    assert.equal(byName.home.sizeBytes, gz('home.js'));
    // Largest first load = shared + heaviest route, skipping framework-internal routes.
    assert.match(byName.largest.detail, /largest: \/join-room/);
    assert.equal(byName.largest.sizeBytes, gz('framework.js') + gz('join.js'));
    // The glob budget counts every JS file, including lazily loaded chunks.
    assert.equal(
      byName.total.sizeBytes,
      gz('framework.js') + gz('home.js') + gz('join.js') + gz('lazy.js'),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails when a budget exceeds its hard limit', () => {
  const root = fixture({ home: 30 });
  try {
    const { code, out } = runIn(root);
    assert.equal(code, EXIT_BUDGET);
    assert.match(out, /FAIL {2}home: .*over limit by/);
    assert.equal(report(root).status, 'fail');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('regression gate: growth beyond the allowed % over baseline fails even under the limit', () => {
  const root = fixture({
    home: 15,
    baseline: { results: [{ name: 'home', sizeBytes: 10 * KB }] },
  });
  try {
    const { code, out } = runIn(root);
    assert.equal(code, EXIT_BUDGET);
    assert.match(out, /grew .* vs baseline \(allowed 1\.0 kB\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('regression gate: small growth within tolerance passes; shrinking passes', () => {
  const root = fixture({
    home: 10,
    baseline: { results: [{ name: 'home', sizeBytes: 10 * KB - 200 }, { name: 'join', sizeBytes: 50 * KB }] },
  });
  try {
    assert.equal(runIn(root).code, EXIT_OK);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('--update-baseline writes sizes, and refuses when over a hard limit', () => {
  const ok = fixture();
  const bad = fixture({ home: 30 });
  try {
    assert.equal(runIn(ok, ['--update-baseline']).code, EXIT_OK);
    const written = JSON.parse(readFileSync(join(ok, 'bundle-baseline.json'), 'utf8'));
    assert.equal(written.results.length, 5);
    assert.ok(written.results.every((r) => r.sizeBytes > 0));
    assert.equal(runIn(ok).code, EXIT_OK, 'fresh baseline must pass');

    assert.equal(runIn(bad, ['--update-baseline']).code, EXIT_BUDGET);
    assert.equal(existsSync(join(bad, 'bundle-baseline.json')), false);
  } finally {
    rmSync(ok, { recursive: true, force: true });
    rmSync(bad, { recursive: true, force: true });
  }
});

test('fails when MSW code leaks into a client chunk (SW-FE-001 / SW-FE-1462)', () => {
  const root = fixture({ homeExtra: 'console.warn("[MSW] Mocking enabled.")' });
  try {
    const { code, err } = runIn(root);
    assert.equal(code, EXIT_BUDGET);
    assert.match(err, /mock code in client bundle: static\/chunks\/home\.js \[msw-log-prefix\]/);
    assert.deepEqual(report(root).forbiddenClientCode, [{ file: 'static/chunks/home.js', id: 'msw-log-prefix' }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails closed when there is no build output', () => {
  const root = fixture();
  rmSync(join(root, '.next'), { recursive: true, force: true });
  try {
    const { code, err } = runIn(root);
    assert.equal(code, EXIT_CONFIG);
    assert.match(err, /Run `next build` first/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails closed on an unknown route, a missing chunk, or an empty glob', () => {
  const unknownRoute = fixture({ config: [{ name: 'x', kind: 'route', route: '/nope', limit: '1 kB' }] });
  const emptyGlob = fixture({ config: [{ name: 'x', kind: 'glob', path: '.next/static/**/*.css', limit: '1 kB' }] });
  const missingChunk = fixture();
  rmSync(join(missingChunk, '.next/static/chunks/join.js'));
  try {
    assert.match(runIn(unknownRoute).err, /route \/nope not in build \(known: .*\/join-room/);
    assert.equal(runIn(unknownRoute).code, EXIT_CONFIG);
    assert.match(runIn(emptyGlob).err, /matched no files/);
    assert.equal(runIn(emptyGlob).code, EXIT_CONFIG);
    assert.match(runIn(missingChunk).err, /chunk listed in a manifest is missing/);
    assert.equal(runIn(missingChunk).code, EXIT_CONFIG);
  } finally {
    for (const dir of [unknownRoute, emptyGlob, missingChunk]) rmSync(dir, { recursive: true, force: true });
  }
});

test('fails closed on invalid or empty config and unknown CLI args', () => {
  const root = fixture({ config: [] });
  try {
    assert.equal(runIn(root).code, EXIT_CONFIG);
    writeFileSync(join(root, '.size-limit.json'), '{not json');
    assert.match(runIn(root).err, /not valid JSON/);
    assert.equal(runIn(root, ['--frobnicate']).code, EXIT_CONFIG);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validateConfig rejects bad budgets', () => {
  const bad = [
    [{ kind: 'shared', limit: '1 kB' }],
    [{ name: 'a', kind: 'mystery', limit: '1 kB' }],
    [{ name: 'a', kind: 'route', route: 'no-slash', limit: '1 kB' }],
    [{ name: 'a', kind: 'glob', path: '../../etc/*', limit: '1 kB' }],
    [{ name: 'a', kind: 'shared', limit: '1 kB', maxRegressionPercent: -1 }],
    [
      { name: 'dup', kind: 'shared', limit: '1 kB' },
      { name: 'dup', kind: 'shared', limit: '1 kB' },
    ],
  ];
  for (const config of bad) {
    assert.throws(() => validateConfig(config), { name: 'BundleConfigError' }, JSON.stringify(config));
  }
});

test('parseLimit understands size-limit style units (1 kB = 1024 B)', () => {
  assert.equal(parseLimit('120 kB'), 122880);
  assert.equal(parseLimit('1500 kB'), 1536000);
  assert.equal(parseLimit('1.5 MB'), 1572864);
  assert.equal(parseLimit('500 B'), 500);
  for (const bad of ['120', 'lots', '0 kB', '-1 kB', 120]) {
    assert.throws(() => parseLimit(bad), { name: 'BundleConfigError' });
  }
});

test('manifests are parsed as data, never executed', () => {
  const hostile =
    'globalThis.__RSC_MANIFEST = {};\nglobalThis.__RSC_MANIFEST["/page"] = (() => { throw new Error("executed") })();';
  assert.throws(() => parseClientReferenceManifest(hostile, 'x.js'), /not JSON/);
  assert.throws(() => parseClientReferenceManifest('globalThis.__RSC_MANIFEST = {};', 'x.js'), /exactly one/);
  assert.deepEqual(
    parseClientReferenceManifest('globalThis.__RSC_MANIFEST["/p"] = {"entryJSFiles":{}};\n', 'x.js'),
    { entryJSFiles: {} },
  );
});

test('normalizeChunkPath handles prefixes, deployment ids, and junk', () => {
  assert.equal(normalizeChunkPath('/_next/static/chunks/a.js?dpl=abc'), 'static/chunks/a.js');
  assert.equal(normalizeChunkPath('https://cdn.example/_next/static/chunks/a.js'), 'static/chunks/a.js');
  assert.equal(normalizeChunkPath('static/chunks/a.js'), 'static/chunks/a.js');
  assert.equal(normalizeChunkPath('elsewhere/a.js'), null);
});

test('expandGlob matches * within a segment and ** across segments', () => {
  const root = fixture();
  try {
    const all = expandGlob(root, '.next/static/**/*.js').map((f) => f.slice(root.length + 1));
    assert.deepEqual(all, [
      '.next/static/chunks/framework.js',
      '.next/static/chunks/home.js',
      '.next/static/chunks/join.js',
      '.next/static/chunks/lazy.js',
    ]);
    assert.equal(expandGlob(root, '.next/static/*.js').length, 0);
    assert.equal(expandGlob(root, '.next/build-manifest.json').length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

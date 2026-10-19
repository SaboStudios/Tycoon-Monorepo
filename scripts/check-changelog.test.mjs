/**
 * Tests for the CHANGELOG + PR template gate (#1762).
 *   node --test scripts/check-changelog.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXIT_CONFIG,
  EXIT_FAIL,
  EXIT_OK,
  checkChangelogEntry,
  checkPrBody,
  escapeWorkflowData,
  evaluate,
  findUnreleasedRange,
  lintChangelog,
  parseAddedLines,
  requiredChangelogs,
  run,
} from './check-changelog.mjs';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

const GOOD_BODY = `## Summary
Adds consent gating to analytics.

Closes #1761

## Changelog
- frontend/CHANGELOG.md: consent banner

## Test plan
- npx vitest run test/ConsentBanner.test.tsx (11 passed)

## Rollback
Revert the PR; no data migration.
`;

const CHANGELOG = `# Changelog

## [Unreleased]

### Added

- Existing entry.

## [0.1.0] - 2026-01-01

### Added

- Initial release.
`;

test('the committed PR template itself passes structure checks once filled in', () => {
  const template = readFileSync(join(REPO_ROOT, '.github/PULL_REQUEST_TEMPLATE.md'), 'utf8');
  // Untouched template: required sections exist but are empty; no issue link.
  const untouched = checkPrBody(template).errors.join('\n');
  assert.match(untouched, /"## Summary" section is empty/);
  assert.match(untouched, /must link an issue/);
  assert.doesNotMatch(untouched, /missing the/);
});

test('every package template carries the required sections', () => {
  for (const name of ['frontend.md', 'backend.md', 'shop-api.md', 'contract.md']) {
    const template = readFileSync(join(REPO_ROOT, '.github/PULL_REQUEST_TEMPLATE', name), 'utf8');
    assert.doesNotMatch(checkPrBody(template).errors.join('\n'), /missing the/, name);
  }
});

test('every existing CHANGELOG.md in the repo passes the lint', () => {
  const files = execFileSync('git', ['ls-files', '*CHANGELOG.md', '**/CHANGELOG.md'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  assert.ok(files.length >= 4);
  for (const file of files) {
    const content = readFileSync(join(REPO_ROOT, file), 'utf8');
    const errors = lintChangelog(content).filter((e) => !/first "## " section must be/.test(e));
    assert.deepEqual(errors, [], file);
  }
});

test('requiredChangelogs maps paths to the owning package changelog', () => {
  const required = requiredChangelogs([
    'frontend/src/app/page.tsx',
    'frontend/docs/SW-FE-1.md',
    'frontend/test/a.test.tsx',
    'backend/src/main.ts',
    'shop-api/src/purchases.ts',
    'contract/contracts/tycoon-token/src/lib.rs',
    'contract/Cargo.toml',
    '.github/workflows/frontend-ci.yml',
    'scripts/backup.sh',
    'README.md',
    'frontend/CHANGELOG.md',
  ]);
  assert.deepEqual([...required.keys()].sort(), [
    'CHANGELOG.md',
    'backend/CHANGELOG.md',
    'contract/CHANGELOG.md',
    'contract/contracts/tycoon-token/CHANGELOG.md',
    'frontend/CHANGELOG.md',
    'shop-api/CHANGELOG.md',
  ]);
  assert.deepEqual(required.get('frontend/CHANGELOG.md').files, ['frontend/src/app/page.tsx']);
});

test('docs- and test-only changes need no changelog', () => {
  assert.equal(requiredChangelogs(['docs/ENVIRONMENT.md', 'frontend/e2e/x.spec.ts', 'backend/test/y.e2e-spec.ts']).size, 0);
});

test('parseAddedLines reads unified=0 hunks', () => {
  const diff = [
    'diff --git a/CHANGELOG.md b/CHANGELOG.md',
    '--- a/CHANGELOG.md',
    '+++ b/CHANGELOG.md',
    '@@ -5,0 +6,2 @@ ## [Unreleased]',
    '+- New thing.',
    '+- Another.',
    '@@ -20 +22 @@',
    '-old',
    '+new',
  ].join('\n');
  assert.deepEqual([...parseAddedLines(diff)], [6, 7, 22]);
  assert.equal(parseAddedLines('').size, 0);
});

test('checkChangelogEntry requires a new bullet inside Unreleased', () => {
  const range = findUnreleasedRange(CHANGELOG);
  assert.deepEqual(range, { start: 3, end: 8 });
  assert.equal(checkChangelogEntry(CHANGELOG, new Set([7])), null);
  assert.match(checkChangelogEntry(CHANGELOG, new Set([12])), /under "## \[Unreleased\]"/); // released section
  assert.match(checkChangelogEntry(CHANGELOG, new Set([5])), /bullet/); // heading, not a bullet
  assert.match(checkChangelogEntry('# Changelog\n\n## [0.1.0] - 2026-01-01\n', new Set([1])), /no "## \[Unreleased\]"/);
});

test('lintChangelog enforces Keep a Changelog shape', () => {
  assert.deepEqual(lintChangelog(CHANGELOG), []);
  assert.deepEqual(lintChangelog('# Changelog\n\n## Unreleased\n\n### Policy\n'), []);
  const errors = lintChangelog('# Notes\n\n## [0.2] - soon\n\n### Stuff\n').join('\n');
  assert.match(errors, /"# Changelog"/);
  assert.match(errors, /must be "## \[Unreleased\]"/);
  assert.match(errors, /\[1\.2\.3\] - YYYY-MM-DD/);
  assert.match(errors, /"### Stuff" is not one of/);
});

test('checkPrBody accepts a filled template', () => {
  assert.deepEqual(checkPrBody(GOOD_BODY), { errors: [], noChangelogReason: null });
});

test('checkPrBody rejects missing/empty sections, missing issue, empty and oversized bodies', () => {
  assert.match(checkPrBody('').errors[0], /empty/);
  assert.match(checkPrBody('x'.repeat(70000)).errors[0], /exceeds/);
  const noRollback = GOOD_BODY.replace(/## Rollback[\s\S]*$/, '');
  assert.match(checkPrBody(noRollback).errors.join('\n'), /missing the "## Rollback"/);
  const emptySummary = GOOD_BODY.replace('Adds consent gating to analytics.\n\nCloses #1761', '<!-- what and why -->').replace(
    '## Rollback',
    'Refs #1761\n\n## Rollback',
  );
  assert.match(checkPrBody(emptySummary).errors.join('\n'), /"## Summary" section is empty/);
  const commentedIssue = GOOD_BODY.replace('Closes #1761', '<!-- Closes #1761 -->');
  assert.match(checkPrBody(commentedIssue).errors.join('\n'), /must link an issue/);
});

test('checkPrBody flags secrets without echoing them', () => {
  const token = `ghp_${'a'.repeat(36)}`;
  const { errors } = checkPrBody(`${GOOD_BODY}\n${token}\n`);
  assert.match(errors.join('\n'), /looks like a secret \(github-token\)/);
  assert.doesNotMatch(errors.join('\n'), new RegExp(token));
});

test('"No changelog:" needs a real reason', () => {
  const withReason = GOOD_BODY.replace('- frontend/CHANGELOG.md: consent banner', 'No changelog: CI-only change to a workflow comment');
  assert.equal(checkPrBody(withReason).noChangelogReason, 'CI-only change to a workflow comment');
  const tooShort = GOOD_BODY.replace('- frontend/CHANGELOG.md: consent banner', 'No changelog: n/a');
  assert.equal(checkPrBody(tooShort).noChangelogReason, null);
});

function entry(content, added) {
  return { content, addedLines: new Set(added) };
}

test('evaluate: missing changelog update fails; label / "No changelog:" / bot skip it', () => {
  const files = ['frontend/src/app/page.tsx'];
  const changelogs = new Map([['frontend/CHANGELOG.md', entry(CHANGELOG, [])]]);

  assert.match(evaluate({ files, changelogs, body: GOOD_BODY }).errors.join('\n'), /frontend\/CHANGELOG\.md was not updated/);
  assert.deepEqual(evaluate({ files, changelogs, body: GOOD_BODY, labels: ['skip-changelog'] }).errors, []);
  const optOut = GOOD_BODY.replace('- frontend/CHANGELOG.md: consent banner', 'No changelog: internal refactor with no behaviour change');
  assert.deepEqual(evaluate({ files, changelogs, body: optOut }).errors, []);
  assert.deepEqual(evaluate({ files, changelogs, body: '', author: 'dependabot[bot]' }).errors, []);
});

test('evaluate: a bot-looking name that is not an exact bot login gets no bypass', () => {
  const errors = evaluate({ files: [], changelogs: new Map(), body: '', author: 'dependabot' }).errors;
  assert.match(errors.join('\n'), /empty/);
});

test('evaluate: missing changelog file fails closed; valid entry passes', () => {
  const files = ['shop-api/src/x.ts'];
  assert.match(
    evaluate({ files, changelogs: new Map([['shop-api/CHANGELOG.md', { content: null, addedLines: new Set() }]]), body: GOOD_BODY }).errors.join('\n'),
    /shop-api\/CHANGELOG\.md is missing/,
  );
  assert.deepEqual(
    evaluate({ files, changelogs: new Map([['shop-api/CHANGELOG.md', entry(CHANGELOG, [7])]]), body: GOOD_BODY }).errors,
    [],
  );
});

test('evaluate: lints touched changelogs and scans added lines for secrets', () => {
  const bad = CHANGELOG.replace('- Existing entry.', `- Leaked AKIA${'A'.repeat(16)} key.`);
  const errors = evaluate({
    files: ['frontend/src/x.ts'],
    changelogs: new Map([['frontend/CHANGELOG.md', entry(bad, [7])]]),
    body: GOOD_BODY,
  }).errors.join('\n');
  assert.match(errors, /secret \(aws-access-key\)/);
});

test('escapeWorkflowData neutralises workflow-command injection in file names', () => {
  const hostile = 'x\n::set-env name=NODE_OPTIONS::--require=/tmp/evil.js';
  assert.equal(escapeWorkflowData(hostile).includes('\n'), false);
  assert.equal(escapeWorkflowData('100%'), '100%25');
});

// ── Integration: real git repo ───────────────────────────────────────────────

function sh(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function repoWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'pr-compliance-'));
  sh(dir, 'init', '-q', '-b', 'main');
  sh(dir, 'config', 'user.email', 'ci@example.invalid');
  sh(dir, 'config', 'user.name', 'CI');
  sh(dir, 'config', 'commit.gpgsign', 'false');
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  sh(dir, 'add', '-A');
  sh(dir, 'commit', '-q', '-m', 'base');
  sh(dir, 'checkout', '-q', '-b', 'feature');
  return dir;
}

function commit(dir, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  sh(dir, 'add', '-A');
  sh(dir, 'commit', '-q', '-m', 'change');
}

function runCli(dir, argv, env) {
  const out = [];
  const err = [];
  const code = run(['--repo', dir, '--base', 'main', ...argv], env, { log: (m) => out.push(m), error: (m) => err.push(m) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('CLI: fails without a changelog entry, passes with one, dry-run never fails', () => {
  const dir = repoWith({ 'frontend/CHANGELOG.md': CHANGELOG, 'frontend/src/a.ts': 'export const a = 1;\n' });
  try {
    commit(dir, { 'frontend/src/a.ts': 'export const a = 2;\n' });
    const failing = runCli(dir, [], { PR_BODY: GOOD_BODY });
    assert.equal(failing.code, EXIT_FAIL);
    assert.match(failing.err, /::error title=PR compliance::frontend\/CHANGELOG\.md was not updated/);
    assert.equal(runCli(dir, ['--dry-run'], { PR_BODY: GOOD_BODY }).code, EXIT_OK);

    commit(dir, { 'frontend/CHANGELOG.md': CHANGELOG.replace('- Existing entry.', '- Existing entry.\n- New entry.') });
    const passing = runCli(dir, [], { PR_BODY: GOOD_BODY });
    assert.equal(passing.code, EXIT_OK, passing.err);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI: an entry added under a released version does not count', () => {
  const dir = repoWith({ 'backend/CHANGELOG.md': CHANGELOG, 'backend/src/a.ts': '1\n' });
  try {
    commit(dir, {
      'backend/src/a.ts': '2\n',
      'backend/CHANGELOG.md': CHANGELOG.replace('- Initial release.', '- Initial release.\n- Sneaky backdated entry.'),
    });
    const result = runCli(dir, [], { PR_BODY: GOOD_BODY });
    assert.equal(result.code, EXIT_FAIL);
    assert.match(result.err, /under "## \[Unreleased\]"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI: fails closed on bad refs and unknown args', () => {
  const dir = repoWith({ 'README.md': 'x\n' });
  try {
    assert.equal(runCli(dir, ['--head', 'no-such-ref'], { PR_BODY: GOOD_BODY }).code, EXIT_CONFIG);
    assert.equal(runCli(dir, ['--head', '--upload-pack=evil'], {}).code, EXIT_CONFIG);
    assert.equal(run(['--repo', dir], {}, { log() {}, error() {} }), EXIT_CONFIG); // no --base
    assert.equal(runCli(dir, ['--wat'], {}).code, EXIT_CONFIG);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

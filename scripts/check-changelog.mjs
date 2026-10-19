#!/usr/bin/env node
/**
 * CHANGELOG + PR template compliance gate (#1762).
 *
 * For a pull request it checks that:
 *   1. every package touched by a non-exempt change has a new bullet under
 *      the `## [Unreleased]` section of that package's CHANGELOG.md;
 *   2. every CHANGELOG.md touched by the PR follows the Keep a Changelog shape;
 *   3. the PR description follows .github/PULL_REQUEST_TEMPLATE.md: it has
 *      Summary / Changelog / Test plan / Rollback sections with content, links
 *      an issue, and contains no obvious secrets.
 *
 * Opt-outs (the reason must be given in the PR's Changelog section):
 *   - PR body line `No changelog: <reason of at least 10 chars>`. This works
 *     for fork PRs, which cannot set labels.
 *   - The `skip-changelog` label (maintainers).
 *   Dependency bots (BOT_AUTHORS) skip both checks: they cannot fill in the
 *   template or write changelog prose. Maintainers add the entry on merge.
 *
 * Usage:
 *   node scripts/check-changelog.mjs --base origin/main --head HEAD --body-file pr.md
 *   node scripts/check-changelog.mjs --base origin/main --dry-run   # report, exit 0
 * CI passes PR_BODY / PR_LABELS / PR_AUTHOR via env, never via shell text.
 *
 * Exit codes: 0 ok, 1 non-compliant, 2 misconfiguration (fails closed).
 * Dependency-free (Node >= 20). See CONTRIBUTING.md#changelog-and-pr-template.
 */

import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXIT_OK = 0;
export const EXIT_FAIL = 1;
export const EXIT_CONFIG = 2;

export const SKIP_LABEL = 'skip-changelog';
export const BOT_AUTHORS = new Set(['dependabot[bot]', 'renovate[bot]', 'github-actions[bot]']);
export const MAX_BODY_LENGTH = 65536;
export const REQUIRED_SECTIONS = ['Summary', 'Changelog', 'Test plan', 'Rollback'];
export const ALLOWED_SUBSECTIONS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security', 'Docs', 'Policy'];

/** First match wins. Maps a changed path to the CHANGELOG that must record it. */
export const PACKAGE_RULES = [
  { pkg: 'contract crate', pattern: /^contract\/contracts\/([^/]+)\//, changelog: (m) => `contract/contracts/${m[1]}/CHANGELOG.md` },
  { pkg: 'contract', pattern: /^contract\//, changelog: () => 'contract/CHANGELOG.md' },
  { pkg: 'frontend', pattern: /^frontend\//, changelog: () => 'frontend/CHANGELOG.md' },
  { pkg: 'backend', pattern: /^backend\//, changelog: () => 'backend/CHANGELOG.md' },
  { pkg: 'shop-api', pattern: /^shop-api\//, changelog: () => 'shop-api/CHANGELOG.md' },
  { pkg: 'repo root', pattern: /^/, changelog: () => 'CHANGELOG.md' },
];

/** Changes that never need a changelog entry on their own. */
export const EXEMPT_PATTERNS = [
  /(^|\/)CHANGELOG\.md$/,
  /\.md$/i, // docs and runbooks
  /(^|\/)(test|tests|__tests__|e2e|integration-tests)\//,
  /\.(test|spec|e2e-spec)\.[cm]?[jt]sx?$/,
  /\.test\.mjs$/,
  /(^|\/)\.github\/PULL_REQUEST_TEMPLATE/,
];

/** Credential shapes that must never appear in a PR body or changelog. */
export const SECRET_PATTERNS = [
  { id: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: 'github-token', pattern: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  { id: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'slack-token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: 'stripe-live-key', pattern: /\b(sk|rk)_live_[A-Za-z0-9]{16,}\b/ },
  { id: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
];

export class ComplianceConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ComplianceConfigError';
  }
}

/** Escape untrusted text for GitHub workflow-command output. */
export function escapeWorkflowData(text) {
  return String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

export function isExempt(file) {
  return EXEMPT_PATTERNS.some((pattern) => pattern.test(file));
}

/** Map of changelog path -> non-exempt files that require it. */
export function requiredChangelogs(files) {
  const required = new Map();
  for (const file of files) {
    if (isExempt(file)) continue;
    for (const rule of PACKAGE_RULES) {
      const match = rule.pattern.exec(file);
      if (match) {
        const changelog = rule.changelog(match);
        if (!required.has(changelog)) required.set(changelog, { pkg: rule.pkg, files: [] });
        required.get(changelog).files.push(file);
        break;
      }
    }
  }
  return required;
}

/** 1-based line numbers added in the new file, from `git diff --unified=0`. */
export function parseAddedLines(diff) {
  const added = new Set();
  let line = 0;
  for (const raw of diff.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (line === 0 || raw.startsWith('+++') || raw.startsWith('---')) continue;
    if (raw.startsWith('+')) {
      added.add(line);
      line += 1;
    } else if (raw.startsWith(' ')) {
      line += 1;
    }
  }
  return added;
}

const UNRELEASED_HEADING = /^## \[?Unreleased\]?\s*$/i;

/** { start, end } (1-based, inclusive) of the Unreleased section, or null. */
export function findUnreleasedRange(content) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((l) => UNRELEASED_HEADING.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start: start + 1, end };
}

/** Keep a Changelog shape checks for one CHANGELOG.md. */
export function lintChangelog(content) {
  const errors = [];
  const lines = content.split(/\r?\n/);
  if (!/^# Changelog\b/.test(lines.find((l) => l.trim() !== '') ?? '')) {
    errors.push('first heading must be "# Changelog"');
  }
  const h2 = lines.map((l, i) => ({ l, i })).filter(({ l }) => /^## /.test(l));
  if (h2.length === 0 || !UNRELEASED_HEADING.test(h2[0].l)) {
    errors.push('the first "## " section must be "## [Unreleased]"');
  }
  for (const { l, i } of h2) {
    if (UNRELEASED_HEADING.test(l)) continue;
    if (!/^## \[\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\] - \d{4}-\d{2}-\d{2}\s*$/.test(l)) {
      errors.push(`line ${i + 1}: release headings must look like "## [1.2.3] - YYYY-MM-DD"`);
    }
  }
  lines.forEach((l, i) => {
    const sub = /^### (.+?)\s*$/.exec(l);
    if (sub && !ALLOWED_SUBSECTIONS.includes(sub[1])) {
      errors.push(`line ${i + 1}: "### ${sub[1]}" is not one of ${ALLOWED_SUBSECTIONS.join(', ')}`);
    }
  });
  return errors;
}

/** Error string if no new bullet was added under Unreleased, else null. */
export function checkChangelogEntry(content, addedLines) {
  const range = findUnreleasedRange(content);
  if (!range) return 'has no "## [Unreleased]" section';
  const lines = content.split(/\r?\n/);
  for (const n of addedLines) {
    if (n > range.start && n <= range.end && /^\s*[-*] \S/.test(lines[n - 1] ?? '')) return null;
  }
  return 'needs a new "- ..." bullet under "## [Unreleased]"';
}

/** Split a PR body into { heading -> text } for `##`/`###` headings, comments removed. */
export function parseSections(body) {
  const withoutComments = body.replace(/<!--[\s\S]*?(?:-->|$)/g, '');
  const sections = new Map();
  let current = null;
  for (const line of withoutComments.split(/\r?\n/)) {
    const heading = /^#{2,3}\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current) sections.get(current).push(line);
  }
  return new Map([...sections].map(([k, v]) => [k, v.join('\n').trim()]));
}

const ISSUE_LINK =
  /\b(close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs?|part of)\s*:?\s+(#\d+|https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+|SW-[A-Z]+-\d+)/i;
const NO_CHANGELOG = /^\s*No changelog:\s*(.{10,})$/im;

export function findSecrets(text) {
  return SECRET_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ id }) => id);
}

/** PR description checks. Never echoes body text into messages. */
export function checkPrBody(body) {
  const errors = [];
  if (typeof body !== 'string' || body.trim() === '') {
    return { errors: ['PR description is empty; use .github/PULL_REQUEST_TEMPLATE.md'], noChangelogReason: null };
  }
  if (body.length > MAX_BODY_LENGTH) {
    return { errors: [`PR description exceeds ${MAX_BODY_LENGTH} characters`], noChangelogReason: null };
  }
  const sections = parseSections(body);
  for (const name of REQUIRED_SECTIONS) {
    const text = sections.get(name.toLowerCase());
    if (text === undefined) errors.push(`PR description is missing the "## ${name}" section`);
    else if (text.replace(/^\s*[-*]\s*\[[ xX]\]\s*$/gm, '').trim() === '') {
      errors.push(`PR description "## ${name}" section is empty`);
    }
  }
  if (!ISSUE_LINK.test(body.replace(/<!--[\s\S]*?(?:-->|$)/g, ''))) {
    errors.push('PR description must link an issue, e.g. "Closes #123"');
  }
  for (const id of findSecrets(body)) {
    errors.push(`PR description contains what looks like a secret (${id}); remove it and rotate the credential`);
  }
  const changelogSection = sections.get('changelog') ?? '';
  const noChangelog = NO_CHANGELOG.exec(changelogSection);
  return { errors, noChangelogReason: noChangelog ? noChangelog[1].trim() : null };
}

/**
 * Pure evaluation. `changelogs` maps path -> { content: string|null, addedLines: Set<number> }.
 */
export function evaluate({ files, changelogs, body, labels = [], author = '' }) {
  const errors = [];
  const notes = [];
  const isBot = BOT_AUTHORS.has(author);

  let noChangelogReason = null;
  if (isBot) {
    notes.push(`PR-body checks skipped for ${author}`);
  } else {
    const result = checkPrBody(body ?? '');
    errors.push(...result.errors);
    noChangelogReason = result.noChangelogReason;
  }

  const required = requiredChangelogs(files);
  const skipByLabel = labels.includes(SKIP_LABEL);
  if (skipByLabel || noChangelogReason) {
    notes.push(
      skipByLabel ? `changelog requirement skipped by "${SKIP_LABEL}" label` : 'changelog requirement skipped: "No changelog:" given',
    );
  } else if (!isBot) {
    for (const [path, { pkg, files: touched }] of required) {
      const entry = changelogs.get(path);
      if (!entry || entry.content === null) {
        errors.push(`${path} is missing: create it (see CONTRIBUTING.md) and add an entry for the ${pkg} change (${touched.length} file(s))`);
        continue;
      }
      if (entry.addedLines.size === 0) {
        errors.push(`${path} was not updated, but the PR changes ${pkg} (e.g. ${touched[0]})`);
        continue;
      }
      const entryError = checkChangelogEntry(entry.content, entry.addedLines);
      if (entryError) errors.push(`${path} ${entryError}`);
    }
  }

  for (const [path, entry] of changelogs) {
    if (!entry || entry.content === null || entry.addedLines.size === 0) continue;
    for (const problem of lintChangelog(entry.content)) errors.push(`${path}: ${problem}`);
    const lines = entry.content.split(/\r?\n/);
    const addedText = [...entry.addedLines].map((n) => lines[n - 1] ?? '').join('\n');
    for (const id of findSecrets(addedText)) errors.push(`${path}: added lines contain what looks like a secret (${id})`);
  }

  return { errors, notes, required };
}

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    throw new ComplianceConfigError(`git ${args[0]} failed: ${String(error.stderr ?? error.message).trim().split('\n')[0]}`);
  }
}

function parseArgs(argv) {
  const args = { base: null, head: 'HEAD', dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (['--base', '--head', '--body-file', '--repo'].includes(arg)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new ComplianceConfigError(`${arg} needs a value`);
      args[arg.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = value;
      i += 1;
    } else throw new ComplianceConfigError(`unknown argument ${arg}`);
  }
  if (!args.base) throw new ComplianceConfigError('--base <ref> is required (e.g. origin/main or the PR base SHA)');
  for (const ref of [args.base, args.head]) {
    if (!/^[\w./-]{1,200}$/.test(ref) || ref.startsWith('-')) throw new ComplianceConfigError('refs must be plain branch names or SHAs');
  }
  return args;
}

/** CLI entry. Returns an exit code. */
export function run(argv, env = process.env, io = { log: console.log, error: console.error }) {
  try {
    const args = parseArgs(argv);
    const cwd = resolve(args.repo ?? fileURLToPath(new URL('..', import.meta.url)));
    const range = `${args.base}...${args.head}`;
    const files = git(['diff', '--name-only', '--no-renames', range], cwd).split('\n').filter(Boolean);

    const body = args.bodyFile ? readFileSync(args.bodyFile, 'utf8') : (env.PR_BODY ?? '');
    const labels = (env.PR_LABELS ?? '').split(/[\n,]/).map((l) => l.trim()).filter(Boolean);
    const author = (env.PR_AUTHOR ?? '').trim();

    const paths = new Set([...requiredChangelogs(files).keys(), ...files.filter((f) => /(^|\/)CHANGELOG\.md$/.test(f))]);
    const changelogs = new Map();
    for (const path of paths) {
      let content = null;
      try {
        content = execFileSync('git', ['show', `${args.head}:${path}`], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      } catch {
        content = null;
      }
      const diff = content === null ? '' : git(['diff', '--unified=0', '--no-renames', range, '--', path], cwd);
      changelogs.set(path, { content, addedLines: parseAddedLines(diff) });
    }

    const { errors, notes, required } = evaluate({ files, changelogs, body, labels, author });

    io.log(`[pr-compliance] ${files.length} changed file(s); changelogs required: ${[...required.keys()].join(', ') || 'none'}`);
    for (const note of notes) io.log(`[pr-compliance] note: ${escapeWorkflowData(note)}`);
    for (const error of errors) io.error(`::error title=PR compliance::${escapeWorkflowData(error)}`);

    if (env.GITHUB_STEP_SUMMARY) {
      const lines = errors.length
        ? errors.map((e) => `- ❌ ${e.replace(/[<>]/g, '')}`).join('\n')
        : '- ✅ CHANGELOG and PR template compliant';
      appendFileSync(env.GITHUB_STEP_SUMMARY, `### PR compliance\n\n${lines}\n\nSee CONTRIBUTING.md → "Changelog and PR template".\n`);
    }

    if (errors.length === 0) {
      io.log('[pr-compliance] OK');
      return EXIT_OK;
    }
    if (args.dryRun) {
      io.log(`[pr-compliance] dry run: ${errors.length} problem(s) would fail CI`);
      return EXIT_OK;
    }
    io.error(`[pr-compliance] ${errors.length} problem(s). See CONTRIBUTING.md → "Changelog and PR template".`);
    return EXIT_FAIL;
  } catch (error) {
    if (error instanceof ComplianceConfigError) {
      io.error(`::error title=PR compliance::configuration error (failing closed): ${escapeWorkflowData(error.message)}`);
      return EXIT_CONFIG;
    }
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = run(process.argv.slice(2));
}

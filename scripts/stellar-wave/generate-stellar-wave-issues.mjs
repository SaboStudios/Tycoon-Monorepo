#!/usr/bin/env node
/**
 * Generates 125 Stellar Wave issue markdown files:
 *   stellar-wave-issues/frontend/*.md (42)
 *   stellar-wave-issues/backend/*.md  (42)
 *   stellar-wave-issues/contract/*.md (41)
 *
 * Usage: node scripts/stellar-wave/generate-stellar-wave-issues.mjs
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIssueBody, slugify } from './issue-builder.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT = join(ROOT, 'stellar-wave-issues');

const FE_DOMAINS = [
  'Landing hero',
  'Join room flow',
  'Shop grid',
  'Purchase modal',
  'NEAR wallet connect',
  'Game board shell',
  'Trade modal',
  'Settings forms',
  'Auth pages',
  'i18n routing',
  'Keyboard shortcuts',
  'Card modals',
  'Guest marketing',
  'CSP / security headers',
];

const FE_ACTIONS = [
  'accessibility and focus order',
  'TypeScript strictness and null guards',
  'Vitest / RTL coverage',
  'performance budget (CLS / LCP)',
  'error and empty states',
  'telemetry hooks (privacy-safe)',
  'security hardening review',
  'MSW fixtures parity with API',
];

const BE_DOMAINS = [
  'Auth & JWT',
  'Shop & purchases',
  'Games & matchmaking',
  'Webhooks & signatures',
  'Metrics & health',
  'Redis / cache layer',
  'Uploads & validation',
  'Notifications',
  'Waitlist & CSV import',
  'Admin analytics',
  'NEAR integration',
  'Privacy & data export',
  'Rate limiting & throttles',
  'OpenAPI / codegen',
];

const BE_ACTIONS = [
  'observability (logs, traces, metrics)',
  'pagination and stable sorting',
  'idempotency and replay tests',
  'DTO validation and error mapping',
  'audit trail hooks',
  'operational runbooks',
];

const CT_DOMAINS = [
  'tycoon-token',
  'tycoon-game',
  'tycoon-reward-system',
  'tycoon-collectibles',
  'tycoon-boost-system',
  'workspace hygiene',
  'integration-tests',
  'cross-contract authorization',
  'upgrade / migration keys',
  'gas and storage budgets',
  'Soroban SDK alignment',
  'event schemas (contractevent)',
  'emergency pause patterns',
  'CLI / localnet docs',
];

const CT_ACTIONS = [
  'security review checklist',
  'unit / integration coverage',
  'simulation scenarios',
  'documentation and acceptance criteria',
  'deprecation path for legacy entrypoints',
  'formalize admin-only vs public entrypoints',
];

function pairs(domains, actions, limit) {
  const out = [];
  outer: for (const d of domains) {
    for (const a of actions) {
      out.push([d, a]);
      if (out.length >= limit) break outer;
    }
  }
  return out.slice(0, limit);
}

function areaLabel(key) {
  if (key === 'frontend') return 'Frontend';
  if (key === 'backend') return 'Backend';
  return 'Contract (Soroban / Stellar)';
}

function extraReq(areaKey) {
  if (areaKey === 'contract') {
    return 'No unaudited oracle or privileged pattern in production without security review. Follow Stellar / Soroban best practices.';
  }
  if (areaKey === 'backend') {
    return 'No secrets in logs; align with existing Nest modules and env validation. Stellar Wave changes should be backward-compatible unless versioned.';
  }
  return 'Match existing Next.js / Tailwind patterns; avoid new heavy client dependencies without bundle review.';
}

function acceptance(areaKey) {
  const base = [
    'PR references **Stellar Wave** and the issue id (e.g. SW-FE-001).',
    'CI green for the affected package (`frontend`, `backend`, or `contract`).',
  ];
  if (areaKey === 'contract') {
    base.push('`cargo check` passes for the workspace members touched.');
  } else if (areaKey === 'backend') {
    base.push('Relevant Jest specs added or updated; migration notes if schema changes.');
  } else {
    base.push('`npm run typecheck` (and `npm run test` when UI behavior changes).');
  }
  return base;
}

function tasks(areaKey, domain, action) {
  const pkg =
    areaKey === 'frontend'
      ? '`frontend/`'
      : areaKey === 'backend'
        ? '`backend/`'
        : '`contract/`';
  const testTarget =
    areaKey === 'contract'
      ? 'on-chain behavior or contract interfaces'
      : areaKey === 'backend'
        ? 'API behavior and regressions'
        : 'UI behavior and regressions';
  return [
    `Scope and implement in ${pkg}: **${domain}** — ${action}.`,
    `Add or update automated tests for ${testTarget}.`,
    'Document rollout / feature flag / migration steps in the PR body.',
  ];
}

function description(areaKey, domain, action) {
  const surface =
    areaKey === 'frontend'
      ? 'Next.js client'
      : areaKey === 'backend'
        ? 'NestJS API'
        : 'Stellar Soroban contracts and tooling';
  return `Improve **${domain}** on the ${surface}: ${action}. This item is part of the **Stellar Wave** engineering batch; keep changes small, reviewable, and covered by tests where feasible.`;
}

function buildIssues(areaKey, limit) {
  const domains =
    areaKey === 'frontend'
      ? FE_DOMAINS
      : areaKey === 'backend'
        ? BE_DOMAINS
        : CT_DOMAINS;
  const actions =
    areaKey === 'frontend'
      ? FE_ACTIONS
      : areaKey === 'backend'
        ? BE_ACTIONS
        : CT_ACTIONS;
  const label = areaLabel(areaKey);
  const prefix =
    areaKey === 'frontend' ? 'FE' : areaKey === 'backend' ? 'BE' : 'CT';
  const list = pairs(domains, actions, limit);
  return list.map(([domain, action], i) => {
    const n = String(i + 1).padStart(3, '0');
    const id = `SW-${prefix}-${n}`;
    const title = `[Stellar Wave · ${label}] ${id}: ${domain} — ${action}`;
    return {
      id,
      areaKey,
      filename: `${id}-${slugify(`${domain}-${action}`)}.md`,
      title,
      body: buildIssueBody({
        area: label,
        title,
        description: description(areaKey, domain, action),
        tasks: tasks(areaKey, domain, action),
        additional: extraReq(areaKey),
        acceptance: acceptance(areaKey),
      }),
    };
  });
}

function writeArea(areaKey, issues) {
  const dir = join(OUT, areaKey);
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  for (const issue of issues) {
    writeFileSync(join(dir, issue.filename), `# ${issue.title}\n\n${issue.body}`, 'utf8');
  }
}

function writeManifest(issues) {
  const path = join(OUT, 'manifest.json');
  const slim = issues.map(({ id, areaKey, filename, title }) => ({
    id,
    area: areaKey,
    title,
    path: join('stellar-wave-issues', areaKey, filename),
  }));
  writeFileSync(path, JSON.stringify(slim, null, 2), 'utf8');
}

function main() {
  const fe = buildIssues('frontend', 42);
  const be = buildIssues('backend', 42);
  const ct = buildIssues('contract', 41);
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeArea('frontend', fe);
  writeArea('backend', be);
  writeArea('contract', ct);
  const all = [...fe, ...be, ...ct].map((x) => ({
    id: x.id,
    area: x.areaKey,
    title: x.title,
    file: join('stellar-wave-issues', x.areaKey, x.filename),
  }));
  writeManifest([...fe, ...be, ...ct]);
  console.log(`Wrote ${all.length} issues under ${OUT}`);
  console.log(`Manifest: ${join(OUT, 'manifest.json')}`);
  console.log(`Next: ./scripts/stellar-wave/push-stellar-wave-issues.sh`);
}

main();

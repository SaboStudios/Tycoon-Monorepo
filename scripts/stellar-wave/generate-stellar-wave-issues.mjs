#!/usr/bin/env node
/**
 * Generates 375 Stellar Wave issue markdown files:
 *   stellar-wave-issues/frontend/*.md (125)
 *   stellar-wave-issues/backend/*.md  (125)
 *   stellar-wave-issues/contract/*.md (125)
 *
 * Usage: node scripts/stellar-wave/generate-stellar-wave-issues.mjs
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIssueBody, slugify } from './issue-builder.mjs';
import {
  scanFrontend,
  scanBackend,
  scanContract,
  deletionsForIssues,
} from './repo-scan.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT = join(ROOT, 'stellar-wave-issues');
const PER_AREA = 125;

const FE_ACTIONS = [
  'accessibility and focus order',
  'TypeScript strictness and null guards',
  'Vitest / RTL coverage',
  'performance budget (CLS / LCP)',
  'error and empty states',
  'telemetry hooks (privacy-safe)',
  'security hardening review',
  'MSW fixtures parity with API',
  'Storybook visual regression',
  'i18n key coverage',
  'keyboard shortcut bindings',
  'bundle size audit',
];

const BE_ACTIONS = [
  'observability (logs, traces, metrics)',
  'pagination and stable sorting',
  'idempotency and replay tests',
  'DTO validation and error mapping',
  'audit trail hooks',
  'operational runbooks',
  'e2e spec coverage',
  'OpenAPI schema alignment',
  'rate-limit and throttle review',
  'migration rollback notes',
];

const CT_ACTIONS = [
  'security review checklist',
  'unit / integration coverage',
  'simulation scenarios',
  'documentation and acceptance criteria',
  'deprecation path for legacy entrypoints',
  'formalize admin-only vs public entrypoints',
  'storage rent budget review',
  'cross-contract auth matrix',
  'event schema contractevent audit',
  'upgrade / migration key governance',
];

function areaLabel(key) {
  if (key === 'frontend') return 'Frontend';
  if (key === 'backend') return 'Backend';
  return 'Contract';
}

function makeIssue(areaKey, title, topic, opts = {}) {
  const label = areaLabel(areaKey);
  return {
    areaKey,
    title,
    topic,
    extraDescription: opts.extraDescription ?? null,
    extraAdditional: opts.extraAdditional ?? null,
    body: buildIssueBody({
      area: label,
      topic,
      extraDescription: opts.extraDescription,
      extraAdditional: opts.extraAdditional,
    }),
  };
}

function dedupeByTitle(issues) {
  const seen = new Set();
  return issues.filter((i) => {
    if (seen.has(i.title)) return false;
    seen.add(i.title);
    return true;
  });
}

function buildFrontendIssues(scan) {
  const issues = [];

  for (const route of scan.routes) {
    const name = route.replace(/^frontend\/src\/app\//, '').replace(/\/page\.tsx$/, '') || 'root';
    for (const action of FE_ACTIONS.slice(0, 2)) {
      const title = `Route ${name} — ${action}`;
      issues.push(
        makeIssue('frontend', title, title, {
          extraDescription: `Scope: \`${route}\`.`,
        })
      );
    }
  }

  for (const comp of scan.components) {
    for (const action of FE_ACTIONS.slice(2, 5)) {
      const title = `Component area ${comp}/ — ${action}`;
      issues.push(
        makeIssue('frontend', title, title, {
          extraDescription: `Scope: \`frontend/src/components/${comp}/\`.`,
        })
      );
    }
  }

  for (const hook of scan.hooks.slice(0, 20)) {
    const h = basename(hook, extname(hook));
    const title = `Hook ${h} — test and edge-case coverage`;
    issues.push(
      makeIssue('frontend', title, title, {
        extraDescription: `Scope: \`${hook}\`.`,
      })
    );
  }

  for (const lib of scan.libDirs) {
    for (const action of ['API error mapping', 'tree-shake audit', 'strict exports']) {
      const title = `Lib ${lib}/ — ${action}`;
      issues.push(
        makeIssue('frontend', title, title, {
          extraDescription: `Scope: \`frontend/src/lib/${lib}/\`.`,
        })
      );
    }
  }

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
    'PWA offline shell',
    'Game waiting room',
    'AI play mode',
    'Privacy policy page',
    'Analytics taxonomy',
    'Toast manager',
  ];
  for (const d of FE_DOMAINS) {
    for (const a of FE_ACTIONS) {
      const title = `${d} — ${a}`;
      issues.push(makeIssue('frontend', title, title));
    }
  }

  issues.push(
    makeIssue(
      'frontend',
      'Consolidate duplicate frontend docs',
      'consolidate duplicate frontend docs',
      {
        extraDescription:
          '`frontend/docs/` has overlapping doc ids; merge or renumber before bulk import.',
      }
    )
  );

  issues.push(
    makeIssue(
      'frontend',
      'Remove legacy app/page.tsx redirect — single home entry',
      'remove legacy app/page.tsx redirect',
      {
        extraDescription: 'Canonical home is `(home)/page.tsx`; legacy `page.tsx` adds routing confusion.',
      }
    )
  );

  return dedupeByTitle(issues).slice(0, PER_AREA);
}

function buildBackendIssues(scan, deletions) {
  const issues = [];

  for (const d of deletions.filter((x) => x.area === 'backend')) {
    const title = `Re-integrate removed ${d.path}`;
    issues.push(
      makeIssue('backend', title, title, {
        extraDescription: `Removed in cleanup: ${d.reason} Target: \`${d.restoreInto}\`.`,
        extraAdditional:
          'Do not re-add nested standalone apps with spaces in folder names; merge into canonical Nest modules.',
      })
    );
  }

  for (const mod of scan.modules) {
    for (const action of BE_ACTIONS.slice(0, 4)) {
      const title = `Module ${mod} — ${action}`;
      issues.push(
        makeIssue('backend', title, title, {
          extraDescription: `Scope: \`backend/src/modules/${mod}/\`.`,
        })
      );
    }
  }

  issues.push(
    makeIssue(
      'backend',
      'Wire UploadsModule into app.module.ts',
      'wire UploadsModule into app.module',
      {
        extraDescription:
          '`backend/src/modules/uploads/` exists but is not imported in `app.module.ts`.',
      }
    )
  );

  issues.push(
    makeIssue(
      'backend',
      'Merge perks and perks-boosts domain boundaries',
      'merge perks and perks-boosts domain boundaries',
      {
        extraDescription: 'Two overlapping perk/boost stacks increase maintenance cost.',
      }
    )
  );

  issues.push(
    makeIssue(
      'backend',
      'Align root package.json Nest version with backend/',
      'align root package.json Nest version with backend',
      {
        extraDescription: 'Root uses Nest ^10; `backend/package.json` uses Nest ^11.',
      }
    )
  );

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
    'Ledger reconciliation',
    'Email delivery',
    'Tour analytics',
    'Community chest',
    'Coupons & gifts',
    'Skins & board styles',
  ];

  for (const d of BE_DOMAINS) {
    for (const a of BE_ACTIONS) {
      const title = `${d} — ${a}`;
      issues.push(makeIssue('backend', title, title));
    }
  }

  for (const mig of scan.migrations.slice(0, 15)) {
    const title = `Migration ${basename(mig)} — verify up/down and prod rollout`;
    issues.push(
      makeIssue('backend', title, title, {
        extraDescription: `Scope: \`${mig}\`.`,
      })
    );
  }

  return dedupeByTitle(issues).slice(0, PER_AREA);
}

function buildContractIssues(scan, deletions) {
  const issues = [];

  for (const d of deletions.filter((x) => x.area === 'contract')) {
    const title = `Document removal of ${d.path}`;
    issues.push(
      makeIssue('contract', title, title, {
        extraDescription: `${d.reason} Reference: \`${d.restoreInto}\`.`,
      })
    );
  }

  for (const crate of scan.crates) {
    for (const action of CT_ACTIONS) {
      const title = `Crate ${crate} — ${action}`;
      issues.push(
        makeIssue('contract', title, title, {
          extraDescription: `Scope: \`contract/contracts/${crate}/\`.`,
        })
      );
    }
  }

  for (const { crate, path } of scan.rsFiles.slice(0, 40)) {
    const file = basename(path);
    const title = `${crate} / ${file} — review and test coverage`;
    issues.push(
      makeIssue('contract', title, title, {
        extraDescription: `Scope: \`${path}\`.`,
      })
    );
  }

  for (const t of scan.integration.slice(0, 20)) {
    const title = `Integration test ${basename(t)} — expand scenarios`;
    issues.push(
      makeIssue('contract', title, title, {
        extraDescription: `Scope: \`${t}\`.`,
      })
    );
  }

  const CT_DOMAINS = [
    'tycoon-token',
    'tycoon-game',
    'tycoon-reward-system',
    'tycoon-collectibles',
    'tycoon-boost-system',
    'tycoon-lib fees',
    'workspace hygiene',
    'integration-tests',
    'cross-contract authorization',
    'upgrade / migration keys',
    'gas and storage budgets',
    'Soroban SDK alignment',
    'event schemas (contractevent)',
    'emergency pause patterns',
    'CLI / localnet docs',
    'deploy scripts',
    'testnet contract addresses',
    'CEI security audit',
    'boost cap stacking',
    'reward withdraw flow',
  ];

  for (const d of CT_DOMAINS) {
    for (const a of CT_ACTIONS.slice(0, 4)) {
      const title = `${d} — ${a}`;
      issues.push(makeIssue('contract', title, title));
    }
  }

  return dedupeByTitle(issues).slice(0, PER_AREA);
}

/** Assign stable filenames after dedupe/slice */
function finalizeIssues(issues, areaKey) {
  const used = new Set();
  return issues.map((issue, i) => {
    const n = String(i + 1).padStart(3, '0');
    let base = slugify(issue.title);
    let filename = `${n}-${base}.md`;
    let k = 2;
    while (used.has(filename)) {
      filename = `${n}-${base}-${k}.md`;
      k += 1;
    }
    used.add(filename);
    return { ...issue, areaKey, index: i + 1, filename };
  });
}

function padToCount(issues, areaKey, target) {
  if (issues.length >= target) return issues.slice(0, target);
  const filler = [];
  let i = issues.length;
  while (issues.length + filler.length < target) {
    i += 1;
    const title = `Engineering hygiene — ${areaLabel(areaKey)} batch ${i}`;
    filler.push(makeIssue(areaKey, title, title));
  }
  return [...issues, ...filler].slice(0, target);
}

function writeArea(areaKey, issues) {
  const dir = join(OUT, areaKey);
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  for (const issue of issues) {
    writeFileSync(join(dir, issue.filename), issue.body, 'utf8');
  }
}

function writeManifest(issues) {
  const slim = issues.map(({ index, areaKey, filename, title }) => ({
    index,
    area: areaKey,
    title,
    path: join('stellar-wave-issues', areaKey, filename),
  }));
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(slim, null, 2), 'utf8');
}

function main() {
  const scanFe = scanFrontend(ROOT);
  const scanBe = scanBackend(ROOT);
  const scanCt = scanContract(ROOT);
  const deletions = deletionsForIssues(ROOT);

  let fe = finalizeIssues(padToCount(buildFrontendIssues(scanFe), 'frontend', PER_AREA), 'frontend');
  let be = finalizeIssues(padToCount(buildBackendIssues(scanBe, deletions), 'backend', PER_AREA), 'backend');
  let ct = finalizeIssues(padToCount(buildContractIssues(scanCt, deletions), 'contract', PER_AREA), 'contract');

  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeArea('frontend', fe);
  writeArea('backend', be);
  writeArea('contract', ct);
  writeManifest([...fe, ...be, ...ct]);

  console.log(`Wrote ${fe.length + be.length + ct.length} issues under ${OUT}`);
  console.log(`  frontend: ${fe.length}`);
  console.log(`  backend:  ${be.length}`);
  console.log(`  contract: ${ct.length}`);
  console.log(`Manifest: ${join(OUT, 'manifest.json')}`);
  console.log(`Next: npm run issues:stellar-wave:push`);
}

main();

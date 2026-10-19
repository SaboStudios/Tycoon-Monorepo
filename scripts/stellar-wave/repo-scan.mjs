/**
 * Walks the monorepo and returns scan results for issue generation.
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename, extname } from 'node:path';

export function walkFiles(root, { exts, maxDepth = 8, skipDirs = new Set() }) {
  const out = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (skipDirs.has(e.name) || e.name.startsWith('.')) continue;
        if (['node_modules', 'dist', 'build', '.next', 'target', 'coverage'].includes(e.name))
          continue;
        walk(p, depth + 1);
      } else if (e.isFile()) {
        if (!exts || exts.includes(extname(e.name))) out.push(p);
      }
    }
  }
  walk(root, 0);
  return out;
}

const ROOT_SKIP = new Set([
  'node_modules',
  '.git',
  'target',
  'dist',
  'build',
  '.next',
  'coverage',
  'test_snapshots',
]);

export function scanFrontend(root) {
  const base = join(root, 'frontend');
  const routes = walkFiles(join(base, 'src/app'), {
    exts: ['.tsx', '.ts'],
    maxDepth: 6,
  }).filter((p) => basename(p) === 'page.tsx' || basename(p) === 'layout.tsx');

  const components = [];
  const compRoot = join(base, 'src/components');
  if (existsSync(compRoot)) {
    for (const d of readdirSync(compRoot, { withFileTypes: true })) {
      if (d.isDirectory()) components.push(d.name);
    }
  }

  const hooks = walkFiles(join(base, 'src/hooks'), { exts: ['.ts', '.tsx'], maxDepth: 2 });
  const libDirs = existsSync(join(base, 'src/lib'))
    ? readdirSync(join(base, 'src/lib'), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];
  const tests = walkFiles(join(base, 'test'), { exts: ['.ts', '.tsx'], maxDepth: 3 });
  const e2e = walkFiles(join(base, 'e2e'), { exts: ['.ts', '.tsx'], maxDepth: 3 });

  return {
    routes: routes.map((p) => relative(root, p)),
    components,
    hooks: hooks.map((p) => relative(root, p)),
    libDirs,
    tests: tests.map((p) => relative(root, p)),
    e2e: e2e.map((p) => relative(root, p)),
  };
}

export function scanBackend(root) {
  const base = join(root, 'backend/src');
  const modulesRoot = join(base, 'modules');
  const modules = existsSync(modulesRoot)
    ? readdirSync(modulesRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

  const nestedProtos = [];
  for (const name of readdirSync(base, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    if (name.name === 'modules' || name.name === 'common' || name.name === 'config') continue;
    if (name.name === 'database' || name.name === 'health' || name.name === 'scripts') continue;
    nestedProtos.push(relative(root, join(base, name.name)));
  }

  const migrations = walkFiles(join(base, 'database'), { exts: ['.ts'], maxDepth: 4 }).filter(
    (p) => p.includes('migration') || basename(p).match(/^\d+/)
  );

  return {
    modules,
    nestedProtos,
    migrations: migrations.map((p) => relative(root, p)).slice(0, 40),
  };
}

export function scanContract(root) {
  const contractsRoot = join(root, 'contract/contracts');
  const crates = existsSync(contractsRoot)
    ? readdirSync(contractsRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

  const rsFiles = [];
  for (const crate of crates) {
    const src = join(contractsRoot, crate, 'src');
    if (!existsSync(src)) continue;
    walkFiles(src, { exts: ['.rs'], maxDepth: 3 }).forEach((f) =>
      rsFiles.push({ crate, path: relative(root, f) })
    );
  }

  const integration = walkFiles(join(root, 'contract/integration-tests'), {
    exts: ['.rs'],
    maxDepth: 4,
  }).map((p) => relative(root, p));

  return { crates, rsFiles, integration };
}

export function deletionsForIssues(root) {
  /** Paths removed from repo; each becomes a restoration issue. */
  return [
    {
      path: 'shop-api/shop-api/',
      reason: 'Exact nested duplicate of shop-api/src (purchases, idempotency, migrations).',
      restoreInto: 'shop-api/src/',
      area: 'backend',
    },
    {
      path: 'backend/src/modules/notfications/',
      reason: 'Typo duplicate of fetch-notification; Mongoose stack not wired in app.module.',
      restoreInto: 'backend/src/modules/fetch-notification/',
      area: 'backend',
    },
    {
      path: 'backend/src/shared-middleware/',
      reason: 'Zero consumers in monorepo; overlaps backend/src/common/.',
      restoreInto: 'backend/src/common/middleware/',
      area: 'backend',
    },
    {
      path: 'backend/src/modules/community-chest/change-chest.module.ts',
      reason: 'Orphan module; real module is community-chest.module.ts.',
      restoreInto: 'backend/src/modules/community-chest/',
      area: 'backend',
    },
    {
      path: 'contract/archive/hello-world/',
      reason: 'Archived experimental crate excluded from workspace.',
      restoreInto: 'contract/integration-tests/ (reference only)',
      area: 'contract',
    },
    {
      path: 'contract/contracts/tycoon-main-game/',
      reason: 'Excluded from Cargo workspace; superseded by tycoon-game.',
      restoreInto: 'contract/contracts/tycoon-game/',
      area: 'contract',
    },
    {
      path: 'src/',
      reason: 'Orphan root Nest app duplicates backend modules; nest-cli at repo root is misleading.',
      restoreInto: 'backend/src/modules/users/, backend/src/modules/auth/',
      area: 'backend',
    },
    {
      path: 'backend/src/User Management (Admin)/',
      reason: 'Standalone Nest prototype not imported in app.module; overlaps users module.',
      restoreInto: 'backend/src/modules/users/ + admin guards',
      area: 'backend',
    },
    {
      path: 'backend/src/Theme Marketplace Integration/',
      reason: 'Standalone Express shop prototype; shop/skins exist in main Nest backend.',
      restoreInto: 'backend/src/modules/shop/, skins/, board-styles/',
      area: 'backend',
    },
    {
      path: 'backend/src/Admin Shop Management APIs/',
      reason: 'Standalone Express admin CRUD; duplicates shop module.',
      restoreInto: 'backend/src/modules/shop/',
      area: 'backend',
    },
    {
      path: 'backend/src/Shop Analytics and Revenue Dashboard(Admin)/',
      reason: 'Standalone analytics app; overlaps admin-analytics module.',
      restoreInto: 'backend/src/modules/admin-analytics/',
      area: 'backend',
    },
  ];
}

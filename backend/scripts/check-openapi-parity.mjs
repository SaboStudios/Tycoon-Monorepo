#!/usr/bin/env node
/**
 * OpenAPI parity checker.
 *
 * Regenerates the OpenAPI spec from the NestJS app and compares it against the
 * committed artifact (backend/openapi.json). Fails closed (non-zero exit) when
 * the committed spec drifts from the generated one, so CI catches stale specs
 * on PRs and main.
 *
 * Usage:
 *   node backend/scripts/check-openapi-parity.mjs
 *   node backend/scripts/check-openapi-parity.mjs --spec backend/openapi.json
 *
 * Env:
 *   OPENAPI_SPEC_PATH  override the committed spec path (default: backend/openapi.json)
 *   OPENAPI_GENERATE   command used to regenerate the spec
 *                      (default: bun run generate-openapi)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(scriptDir, '..');

function parseArgs(argv) {
  const args = { spec: process.env.OPENAPI_SPEC_PATH || 'openapi.json' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--spec' && argv[i + 1]) {
      args.spec = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--spec=')) {
      args.spec = arg.slice('--spec='.length);
    }
  }
  return args;
}

function resolveSpecPath(spec) {
  if (isAbsolute(spec)) return spec;
  const fromCwd = resolve(process.cwd(), spec);
  if (existsSync(fromCwd)) return fromCwd;
  return resolve(backendDir, spec);
}

function fail(message) {
  console.error(`\n[openapi-parity] ${message}\n`);
  process.exit(1);
}

function normalize(spec) {
  // Deterministic, order-insensitive comparison of the JSON document.
  return JSON.stringify(spec, Object.keys(spec).sort(), 2);
}

function main() {
  const { spec } = parseArgs(process.argv.slice(2));
  const specPath = resolveSpecPath(spec);

  if (!existsSync(specPath)) {
    fail(
      `Committed OpenAPI spec not found at ${specPath}.\n` +
        'Run `bun run generate-openapi` and commit the artifact.',
    );
  }

  const generateCmd = process.env.OPENAPI_GENERATE || 'bun run generate-openapi';
  console.log(`[openapi-parity] Regenerating spec via: ${generateCmd}`);

  const result = spawnSync(generateCmd, {
    cwd: backendDir,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    fail(`Failed to run generator: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`Generator exited with code ${result.status}. Cannot verify parity.`);
  }

  let committed;
  let generated;
  try {
    committed = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    fail(`Committed spec at ${specPath} is not valid JSON: ${err.message}`);
  }
  try {
    generated = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    fail(`Generated spec at ${specPath} is not valid JSON: ${err.message}`);
  }

  if (normalize(committed) !== normalize(generated)) {
    fail(
      'OpenAPI spec drift detected.\n' +
        `Committed artifact: ${specPath}\n` +
        'Run `bun run generate-openapi` locally and commit the updated spec.',
    );
  }

  console.log('[openapi-parity] OK: committed spec matches generated spec.');
}

main();

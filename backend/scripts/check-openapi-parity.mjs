#!/usr/bin/env node
/**
 * check-openapi-parity.mjs
 *
 * CI guard for issue #1514 — OpenAPI spec vs frontend client/DTO drift.
 *
 * What it checks:
 *   1. The generated openapi.json exists and is valid JSON.
 *   2. Every path/method pair that the frontend client calls is present in
 *      the OpenAPI spec.
 *   3. The /auth/login response body uses `accessToken` (camelCase), NOT
 *      `access_token` (snake_case) — the specific drift that triggered #1514.
 *   4. The /auth/refresh response body also uses `accessToken`.
 *
 * Usage (local):
 *   node scripts/check-openapi-parity.mjs
 *
 * CI: runs after `npm run build:openapi` which regenerates openapi.json.
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more checks failed (details printed to stdout)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ───────────────────────────────────────────────────────────────────

const OPENAPI_PATH = resolve(__dirname, '../openapi.json');

/**
 * Endpoints the frontend client is known to call.
 * Format: [method, path-in-spec]
 *
 * These are the API paths as they appear in the OpenAPI spec (without the
 * global /api/v1 prefix, which is set as a server base-path).
 * Extend this list whenever a new endpoint is wired up in client.ts.
 */
const REQUIRED_PATHS = [
  ['post', '/auth/login'],
  ['post', '/auth/refresh'],
  ['post', '/auth/logout'],
  ['get',  '/users/me'],
];

/**
 * Fields that MUST appear in the auth login/refresh response schema.
 * The canonical backend DTO uses camelCase; snake_case is the historical bug.
 */
const AUTH_RESPONSE_REQUIRED_FIELDS = ['accessToken', 'refreshToken'];
const AUTH_RESPONSE_FORBIDDEN_FIELDS = ['access_token', 'refresh_token'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

let errors = 0;

function pass(msg) {
  console.log(`  ✅  ${msg}`);
}

function fail(msg) {
  console.error(`  ❌  ${msg}`);
  errors++;
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

/**
 * Recursively resolve a $ref inside the spec document.
 * Only supports local #/components/... refs.
 */
function resolveRef(spec, ref) {
  if (!ref.startsWith('#/')) {
    fail(`Unsupported external $ref: ${ref}`);
    return null;
  }
  const parts = ref.slice(2).split('/');
  let node = spec;
  for (const part of parts) {
    node = node?.[part];
    if (node === undefined) {
      fail(`$ref ${ref} could not be resolved — missing key: ${part}`);
      return null;
    }
  }
  return node;
}

/**
 * Collect all property names from a schema object, following $refs.
 */
function collectProperties(spec, schema) {
  if (!schema) return new Set();

  if (schema.$ref) {
    const resolved = resolveRef(spec, schema.$ref);
    return collectProperties(spec, resolved);
  }

  if (schema.allOf) {
    const merged = new Set();
    for (const sub of schema.allOf) {
      for (const p of collectProperties(spec, sub)) merged.add(p);
    }
    return merged;
  }

  return new Set(Object.keys(schema.properties ?? {}));
}

// ─── Load spec ────────────────────────────────────────────────────────────────

section('Loading openapi.json');

let spec;
try {
  const raw = readFileSync(OPENAPI_PATH, 'utf-8');
  spec = JSON.parse(raw);
  pass(`Loaded ${OPENAPI_PATH}`);
} catch (err) {
  fail(`Cannot read/parse openapi.json: ${err.message}`);
  fail('Run `npm run build:openapi` in backend/ first, then commit openapi.json');
  process.exit(1);
}

// Normalise: strip trailing slash from servers base-url
const serverBasePath = (spec.servers?.[0]?.url ?? '').replace(/\/$/, '');
const paths = spec.paths ?? {};

// ─── Check 1: required endpoint paths exist ──────────────────────────────────

section('Check 1 — required API paths present in spec');

for (const [method, apiPath] of REQUIRED_PATHS) {
  // Spec paths are keyed relative to the server base-path
  const specKey = apiPath; // e.g. /auth/login
  const pathObj = paths[specKey];

  if (!pathObj) {
    fail(`Path not found in spec: ${method.toUpperCase()} ${specKey}`);
    continue;
  }
  if (!pathObj[method]) {
    fail(`Method not found: ${method.toUpperCase()} ${specKey} (path exists but method missing)`);
    continue;
  }
  pass(`${method.toUpperCase()} ${specKey}`);
}

// ─── Check 2: /auth/login response uses camelCase token fields ────────────────

section('Check 2 — /auth/login response uses camelCase token fields');

function checkAuthResponseFields(methodPath, method) {
  const pathObj = paths[methodPath];
  if (!pathObj || !pathObj[method]) {
    fail(`${method.toUpperCase()} ${methodPath} not found — cannot check response schema`);
    return;
  }

  const responses = pathObj[method].responses ?? {};
  // Accept 200 or 201
  const successResponse = responses['200'] ?? responses['201'];
  if (!successResponse) {
    fail(`${method.toUpperCase()} ${methodPath} has no 200/201 response`);
    return;
  }

  const jsonSchema =
    successResponse.content?.['application/json']?.schema;

  if (!jsonSchema) {
    fail(`${method.toUpperCase()} ${methodPath} 200/201 has no application/json schema`);
    return;
  }

  const properties = collectProperties(spec, jsonSchema);

  for (const field of AUTH_RESPONSE_REQUIRED_FIELDS) {
    if (properties.has(field)) {
      pass(`${method.toUpperCase()} ${methodPath} → response has "${field}"`);
    } else {
      fail(
        `${method.toUpperCase()} ${methodPath} → response is MISSING "${field}". ` +
        `Frontend client.ts reads localStorage.getItem('accessToken') and expects this field name.`
      );
    }
  }

  for (const field of AUTH_RESPONSE_FORBIDDEN_FIELDS) {
    if (properties.has(field)) {
      fail(
        `${method.toUpperCase()} ${methodPath} → response contains forbidden snake_case field "${field}". ` +
        `Use "${field.replace('_t', 'T').replace('_r', 'R')}" instead.`
      );
    } else {
      pass(`${method.toUpperCase()} ${methodPath} → response does NOT contain forbidden "${field}"`);
    }
  }
}

checkAuthResponseFields('/auth/login', 'post');
checkAuthResponseFields('/auth/refresh', 'post');

// ─── Check 3: openapi.json version matches package.json ──────────────────────

section('Check 3 — spec info.version is present');

if (spec.info?.version) {
  pass(`spec version: ${spec.info.version}`);
} else {
  fail('spec info.version is missing');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(64));
if (errors === 0) {
  console.log('✅  All OpenAPI parity checks passed.');
  process.exit(0);
} else {
  console.error(`❌  ${errors} check(s) failed. Fix the drift before merging.`);
  console.error(
    '\nTip: run `cd backend && npm run build:openapi` to regenerate openapi.json,\n' +
    'then commit the updated file.'
  );
  process.exit(1);
}

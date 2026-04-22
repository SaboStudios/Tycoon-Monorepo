/**
 * SW-BE-006: Auth & JWT — operational runbooks
 *
 * "Runbook contract" tests — ensure the documented env vars, audit event
 * names, and DB column names referenced in docs/AUTH_JWT_RUNBOOK.md are
 * actually present in the codebase. If any of these fail, the runbook has
 * drifted from the implementation and must be updated.
 *
 * All tests are pure static/unit checks — no DB, no HTTP, no I/O.
 */

import * as fs from 'fs';
import * as path from 'path';
import { AuthAuditEvent } from './audit/auth-audit.events';
import { jwtConfig } from '../../config/jwt.config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const root = path.resolve(__dirname, '../../..');

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(root, 'src', relPath), 'utf8');
}

function readDoc(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

// ---------------------------------------------------------------------------
// 1. Audit event catalogue — runbook must document every event in the enum
// ---------------------------------------------------------------------------

describe('Runbook contract: audit events (SW-BE-006)', () => {
  const runbook = readDoc('docs/AUTH_JWT_RUNBOOK.md');

  const allEvents = Object.values(AuthAuditEvent);

  it('AuthAuditEvent enum is non-empty', () => {
    expect(allEvents.length).toBeGreaterThan(0);
  });

  allEvents.forEach((event) => {
    it(`runbook documents event "${event}"`, () => {
      expect(runbook).toContain(event);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Environment variables — runbook must document every JWT config key
// ---------------------------------------------------------------------------

describe('Runbook contract: environment variables (SW-BE-006)', () => {
  const runbook = readDoc('docs/AUTH_JWT_RUNBOOK.md');
  const envExample = readDoc('.env.example');

  const jwtEnvVars = [
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'JWT_REFRESH_EXPIRES_IN',
    'JWT_CLOCK_SKEW_SECONDS',
  ];

  jwtEnvVars.forEach((varName) => {
    it(`runbook documents env var "${varName}"`, () => {
      expect(runbook).toContain(varName);
    });

    it(`".env.example" contains "${varName}"`, () => {
      expect(envExample).toContain(varName);
    });
  });

  it('jwtConfig reads JWT_SECRET from process.env', () => {
    // jwtConfig is a factory — call it with a mock env
    const original = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret-for-runbook-spec';
    const cfg = jwtConfig();
    expect(cfg.secret).toBe('test-secret-for-runbook-spec');
    process.env.JWT_SECRET = original;
  });

  it('jwtConfig reads JWT_CLOCK_SKEW_SECONDS from process.env', () => {
    const original = process.env.JWT_CLOCK_SKEW_SECONDS;
    process.env.JWT_CLOCK_SKEW_SECONDS = '120';
    const cfg = jwtConfig();
    expect(cfg.clockTolerance).toBe(120);
    process.env.JWT_CLOCK_SKEW_SECONDS = original;
  });

  it('jwtConfig defaults clockTolerance to 60 when env var is absent', () => {
    const original = process.env.JWT_CLOCK_SKEW_SECONDS;
    delete process.env.JWT_CLOCK_SKEW_SECONDS;
    const cfg = jwtConfig();
    expect(cfg.clockTolerance).toBe(60);
    process.env.JWT_CLOCK_SKEW_SECONDS = original;
  });
});

// ---------------------------------------------------------------------------
// 3. refresh_tokens columns — runbook table must match the entity definition
// ---------------------------------------------------------------------------

describe('Runbook contract: refresh_tokens schema (SW-BE-006)', () => {
  const runbook = readDoc('docs/AUTH_JWT_RUNBOOK.md');
  const entitySrc = readSrc('modules/auth/entities/refresh-token.entity.ts');

  const documentedColumns = [
    'tokenHash',
    'userId',
    'expiresAt',
    'isRevoked',
    'lastUsedAt',
    'ipAddress',
    'userAgent',
  ];

  documentedColumns.forEach((col) => {
    it(`entity defines column "${col}"`, () => {
      expect(entitySrc).toContain(col);
    });

    it(`runbook documents column "${col}"`, () => {
      expect(runbook).toContain(col);
    });
  });
});

// ---------------------------------------------------------------------------
// 4. AuthAuditService — security event set matches documented WARN events
// ---------------------------------------------------------------------------

describe('Runbook contract: security event severity (SW-BE-006)', () => {
  const auditSrc = readSrc('modules/auth/audit/auth-audit.service.ts');

  // These events must be routed to WARN per the runbook
  const warnEvents: string[] = [
    AuthAuditEvent.LOGIN_FAILED,
    AuthAuditEvent.LOGIN_SUSPENDED,
    AuthAuditEvent.TOKEN_REUSE_DETECTED,
    AuthAuditEvent.TOKEN_REFRESH_FAILED,
    AuthAuditEvent.WALLET_LOGIN_FAILED,
  ];

  warnEvents.forEach((event) => {
    it(`"${event}" is in the SECURITY_EVENTS set in AuthAuditService`, () => {
      expect(auditSrc).toContain(`'${event}'`);
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Runbook self-consistency — key sections are present
// ---------------------------------------------------------------------------

describe('Runbook self-consistency (SW-BE-006)', () => {
  const runbook = readDoc('docs/AUTH_JWT_RUNBOOK.md');

  const requiredSections = [
    'Token Reuse / Replay Attack',
    'Force-Logout a Specific User',
    'Rotate the JWT Secret',
    'Clock Skew Errors',
    'Audit Log Reference',
    'Monitoring & Alerting',
    'Rollback Procedure',
    'Migration Notes',
  ];

  requiredSections.forEach((section) => {
    it(`runbook contains section "${section}"`, () => {
      expect(runbook).toContain(section);
    });
  });

  it('runbook references SW-BE-006', () => {
    expect(runbook).toContain('SW-BE-006');
  });

  it('runbook does not contain placeholder secrets', () => {
    // The runbook must not accidentally document a real secret value
    expect(runbook).not.toMatch(/JWT_SECRET\s*=\s*[a-f0-9]{32,}/);
  });
});

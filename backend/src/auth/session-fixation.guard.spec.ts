import { Injectable, Logger, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

import { SessionFixationGuard } from './session-fixation.guard';

describe('SessionFixationGuard nonce age (#2116)', () => {
  const guard = new SessionFixationGuard();
  const MAX_AGE_MS = 5 * 60 * 1000;

  const run = (session: Record<string, any>) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ session, app: { get: () => undefined } }),
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
    return guard.canActivate(context);
  };

  it('rotates when nonceCreatedAt is missing', () => {
    const session: Record<string, any> = { nonce: 'stale-nonce' };
    expect(run(session)).toBe(true);
    expect(session.nonce).not.toBe('stale-nonce');
    expect(typeof session.nonceCreatedAt).toBe('number');
  });

  it('rotates when the nonce age is negative', () => {
    const session: Record<string, any> = {
      nonce: 'future-nonce',
      nonceCreatedAt: Date.now() + 60_000,
    };
    expect(run(session)).toBe(true);
    expect(session.nonce).not.toBe('future-nonce');
    expect(session.nonceCreatedAt).toBeLessThanOrEqual(Date.now());
  });

  it('accepts a nonce inside the allowed window', () => {
    const createdAt = Date.now() - 60_000;
    const session: Record<string, any> = { nonce: 'fresh-nonce', nonceCreatedAt: createdAt };
    expect(run(session)).toBe(true);
    expect(session.nonce).toBe('fresh-nonce');
    expect(session.nonceCreatedAt).toBe(createdAt);
  });

  it('rotates a normally old nonce', () => {
    const session: Record<string, any> = {
      nonce: 'old-nonce',
      nonceCreatedAt: Date.now() - MAX_AGE_MS - 1_000,
    };
    expect(run(session)).toBe(true);
    expect(session.nonce).not.toBe('old-nonce');
  });
});

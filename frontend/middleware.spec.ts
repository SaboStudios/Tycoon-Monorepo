import { describe, expect, it } from 'vitest';
import { buildCsp } from './middleware';

describe('buildCsp', () => {
  const policy = buildCsp();
  const directives = new Map(
    policy.split('; ').map((directive) => {
      const [name, ...sources] = directive.split(' ');
      return [name, sources];
    }),
  );

  it('does not allow inline scripts', () => {
    expect(directives.get('script-src')).toEqual(["'self'"]);
    expect(policy).not.toContain('unsafe-inline');
  });

  it('lists explicit image hosts instead of a bare https: scheme', () => {
    const imgSrc = directives.get('img-src') ?? [];
    expect(imgSrc).toContain("'self'");
    expect(imgSrc).toContain('data:');
    expect(imgSrc).not.toContain('https:');
    expect(imgSrc).toContain('https://placehold.co');
  });

  it('keeps object-src and frame-ancestors locked down', () => {
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
  });
});

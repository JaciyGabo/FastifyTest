import { describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/env.js';

const STRONG_JWT_SECRET = 'prod-jwt-secret-with-more-than-32-characters';
const STRONG_COOKIE_SECRET = 'prod-cookie-secret-with-more-than-32-characters';

describe('loadEnv secrets', () => {
  it('accepts the development defaults outside production', () => {
    expect(() => loadEnv({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('refuses to start in production with the development default secrets', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(
      /JWT_SECRET is the development default/,
    );
  });

  it('refuses to start in production with secrets shorter than 32 characters', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'short-but-valid-16',
        COOKIE_SECRET: STRONG_COOKIE_SECRET,
      }),
    ).toThrow(/JWT_SECRET must be at least 32 characters/);
  });

  it('accepts unique long secrets in production', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        JWT_SECRET: STRONG_JWT_SECRET,
        COOKIE_SECRET: STRONG_COOKIE_SECRET,
      }),
    ).not.toThrow();
  });
});

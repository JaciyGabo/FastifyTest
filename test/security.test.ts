import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';

describe('Security headers and CORS', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('includes security headers set by helmet', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/live' });

    expect(response.headers['x-frame-options']).toBeDefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('includes CORS headers when Origin is provided', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';

describe('health endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live returns ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/live' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('GET /health/ready returns ok with uptime and timestamp', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    const body = response.json<{
      status: string;
      uptime: number;
      timestamp: string;
      database: string;
    }>();

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
    expect(body.uptime).toBeTypeOf('number');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});

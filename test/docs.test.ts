import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';

describe('Swagger documentation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /docs returns swagger ui html', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/' });

    expect([200, 302]).toContain(response.statusCode);
  });

  it('GET /docs/json returns valid OpenAPI 3 specification', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);
    const spec = response.json<{ openapi: string; info: { title: string } }>();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBe('Fastify Test API');
  });
});

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { NotFoundError } from '../src/shared/errors/app-error.js';

describe('Error handling', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();

    // Register test routes to trigger specific error scenarios
    app.get('/test/app-error', async () => {
      throw new NotFoundError('Custom resource not found', 'RESOURCE_NOT_FOUND', { id: 42 });
    });

    app.post(
      '/test/validation',
      {
        schema: {
          body: z.object({
            email: z.string().email(),
            count: z.number().int().positive(),
          }),
        },
      },
      async (request) => {
        return request.body;
      },
    );

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('handles 404 with structured JSON response', async () => {
    const response = await app.inject({ method: 'GET', url: '/non-existent-route' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'Route GET:/non-existent-route not found',
    });
  });

  it('handles AppError with status, code and custom details', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/app-error' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      statusCode: 404,
      error: 'RESOURCE_NOT_FOUND',
      message: 'Custom resource not found',
      details: { id: 42 },
    });
  });

  it('handles validation errors with structured details', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test/validation',
      payload: {
        email: 'invalid-email',
        count: -5,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{
      statusCode: number;
      error: string;
      message: string;
      details: unknown[];
    }>();
    expect(body.statusCode).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.details)).toBe(true);
  });
});

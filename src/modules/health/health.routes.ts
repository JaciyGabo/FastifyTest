import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

/**
 * Health endpoints for orchestrators (Docker, Kubernetes, load balancers).
 * - live:  the process is up and able to respond.
 * - ready: the app can serve traffic (dependency checks such as the DB are added later).
 */
export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/live',
    {
      schema: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Checks if the HTTP server process is running.',
        response: {
          200: z.object({
            status: z.literal('ok'),
          }),
        },
      },
    },
    async () => {
      return { status: 'ok' as const };
    },
  );

  app.get(
    '/ready',
    {
      schema: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description: 'Checks if the server is ready to accept traffic.',
        response: {
          200: z.object({
            status: z.literal('ok'),
            uptime: z.number(),
            timestamp: z.string(),
          }),
        },
      },
    },
    async () => {
      return {
        status: 'ok' as const,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    },
  );
};

import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

/**
 * Health endpoints for orchestrators (Docker, Kubernetes, load balancers).
 * - live:  the process is up and able to respond.
 * - ready: the app can serve traffic (verifies database readiness via SELECT 1).
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
        description: 'Checks if the server and database are ready to accept traffic.',
        response: {
          200: z.object({
            status: z.literal('ok'),
            uptime: z.number(),
            timestamp: z.string(),
            database: z.literal('connected'),
          }),
          503: z.object({
            status: z.literal('unhealthy'),
            error: z.string(),
            timestamp: z.string(),
          }),
        },
      },
    },
    async (_request, reply) => {
      try {
        await app.db.execute(sql`SELECT 1`);
        return {
          status: 'ok' as const,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          database: 'connected' as const,
        };
      } catch (err) {
        app.log.error({ err }, 'Readiness check failed: database unreachable');
        return reply.status(503).send({
          status: 'unhealthy' as const,
          error: 'Database connection failed',
          timestamp: new Date().toISOString(),
        });
      }
    },
  );
};

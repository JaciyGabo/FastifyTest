import type { FastifyPluginAsync } from 'fastify';

/**
 * Health endpoints for orchestrators (Docker, Kubernetes, load balancers).
 * - live:  the process is up and able to respond.
 * - ready: the app can serve traffic (dependency checks such as the DB are added later).
 */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/live', async () => {
    return { status: 'ok' };
  });

  app.get('/ready', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });
};

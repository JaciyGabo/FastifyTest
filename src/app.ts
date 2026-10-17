import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

/**
 * Builds and configures the Fastify application without starting the HTTP server.
 * Keeping construction separate from `listen()` lets tests use `app.inject()`.
 */
export async function buildApp(options: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify(options);

  app.get('/', async () => {
    return { mensaje: '¡Hola! El servidor está funcionando' };
  });

  return app;
}

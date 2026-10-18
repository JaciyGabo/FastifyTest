import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import { healthRoutes } from './modules/health/health.routes.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { securityPlugin } from './plugins/security.js';
import { swaggerPlugin } from './plugins/swagger.js';

/**
 * Builds and configures the Fastify application without starting the HTTP server.
 * Keeping construction separate from `listen()` lets tests use `app.inject()`.
 */
export async function buildApp(options: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify(options).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(securityPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(swaggerPlugin);

  app.get('/', async () => {
    return { mensaje: '¡Hola! El servidor está funcionando' };
  });

  await app.register(healthRoutes, { prefix: '/health' });

  return app;
}

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { NotFoundError } from '../../shared/errors/app-error.js';
import { sanitizeUser } from '../auth/auth.service.js';
import { userProfileResponseSchema } from './users.schema.js';

export const usersRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/me',
    {
      schema: {
        tags: ['Users'],
        summary: 'Get current authenticated user profile',
        description: 'Requires a valid Bearer JWT access token in the Authorization header.',
        security: [{ bearerAuth: [] }],
        response: {
          200: userProfileResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const user = await app.usersRepo.findById(request.user.id);
      if (!user) {
        throw new NotFoundError('User profile not found', 'USER_NOT_FOUND');
      }

      return reply.status(200).send({ user: sanitizeUser(user) });
    },
  );
};

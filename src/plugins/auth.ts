import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '../config/env.js';
import { AuthRepository } from '../modules/auth/auth.repository.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { UsersRepository } from '../modules/users/users.repository.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (
      roles: Array<'user' | 'admin'>,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    usersRepo: UsersRepository;
    authService: AuthService;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: number; email: string; role: 'user' | 'admin' };
    user: { id: number; email: string; role: 'user' | 'admin' };
  }
}

export const authPlugin = fp(async (app) => {
  await app.register(cookie, {
    secret: env.COOKIE_SECRET,
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });

  const usersRepo = new UsersRepository(app.db);
  const authRepo = new AuthRepository(app.db);
  const authService = new AuthService(usersRepo, authRepo);

  app.decorate('usersRepo', usersRepo);
  app.decorate('authService', authService);

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({
        statusCode: 401,
        error: 'UNAUTHORIZED',
        message: 'Authentication required or invalid token',
      });
    }
  });

  app.decorate('authorize', (roles: Array<'user' | 'admin'>) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user;
      if (!user || !roles.includes(user.role)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'FORBIDDEN',
          message: 'Insufficient permissions to perform this action',
        });
      }
    };
  });
});

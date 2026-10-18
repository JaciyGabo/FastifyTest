import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../shared/errors/app-error.js';
import { authResponseSchema, loginBodySchema, registerBodySchema } from './auth.schema.js';

const COOKIE_NAME = 'refreshToken';

function setRefreshCookie(reply: FastifyReply, userId: number, token: string): void {
  const value = `${userId}.${token}`;
  reply.setCookie(COOKIE_NAME, value, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth',
    maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60,
    signed: true,
  });
}

function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth',
  });
}

function parseRefreshCookie(request: FastifyRequest): { userId: number; rawToken: string } {
  const rawCookie = request.cookies[COOKIE_NAME];
  if (!rawCookie) {
    throw new UnauthorizedError('Refresh token cookie missing', 'UNAUTHORIZED');
  }

  const unsigned = request.unsignCookie(rawCookie);
  if (!unsigned.valid || !unsigned.value) {
    throw new UnauthorizedError('Invalid refresh token signature', 'UNAUTHORIZED');
  }

  const [userIdStr, rawToken] = unsigned.value.split('.');
  const userId = Number(userIdStr);
  if (!userId || !rawToken) {
    throw new UnauthorizedError('Malformed refresh token cookie', 'UNAUTHORIZED');
  }

  return { userId, rawToken };
}

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/register',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Register a new user',
        description:
          'Creates a new user account with argon2 password hashing and issues JWT tokens.',
        body: registerBodySchema,
        response: {
          201: authResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user, refreshToken } = await app.authService.register(request.body);

      const accessToken = app.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      setRefreshCookie(reply, user.id, refreshToken);
      return reply.status(201).send({ user, accessToken });
    },
  );

  app.post(
    '/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Authenticate user',
        description:
          'Validates email and password, returning an access token and setting a refresh cookie.',
        body: loginBodySchema,
        response: {
          200: authResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user, refreshToken } = await app.authService.login(request.body);

      const accessToken = app.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      setRefreshCookie(reply, user.id, refreshToken);
      return reply.status(200).send({ user, accessToken });
    },
  );

  app.post(
    '/refresh',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Rotate refresh token and issue new access token',
        description:
          'Uses httpOnly refresh token cookie to rotate tokens and generate a fresh access token.',
        response: {
          200: authResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { userId, rawToken } = parseRefreshCookie(request);

      const { user, newRefreshToken } = await app.authService.refresh({
        userId,
        refreshToken: rawToken,
      });

      const accessToken = app.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      setRefreshCookie(reply, user.id, newRefreshToken);
      return reply.status(200).send({ user, accessToken });
    },
  );

  app.post(
    '/logout',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Logout user',
        description:
          'Clears httpOnly refresh cookie and revokes the refresh token in the database.',
        response: {
          200: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const { userId, rawToken } = parseRefreshCookie(request);
        await app.authService.logout({ userId, refreshToken: rawToken });
      } catch {
        // If cookie is missing or invalid, still clear cookie cleanly
      }

      clearRefreshCookie(reply);
      return reply.status(200).send({ message: 'Logged out successfully' });
    },
  );
};

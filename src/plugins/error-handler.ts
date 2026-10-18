import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

import { AppError } from '../shared/errors/app-error.js';

interface MaybeHttpError {
  statusCode?: number;
  name?: string;
  message?: string;
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}

export const errorHandlerPlugin = fp(async (app) => {
  app.setErrorHandler((error: unknown, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.validation,
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      });
    }

    const httpError = isObject(error) ? (error as MaybeHttpError) : undefined;

    if (httpError?.statusCode === 429) {
      return reply.status(429).send({
        statusCode: 429,
        error: 'TOO_MANY_REQUESTS',
        message: httpError.message ?? 'Rate limit exceeded, retry later',
      });
    }

    if (httpError?.statusCode && httpError.statusCode < 500) {
      return reply.status(httpError.statusCode).send({
        statusCode: httpError.statusCode,
        error: httpError.name ?? 'CLIENT_ERROR',
        message: httpError.message ?? 'Client error',
      });
    }

    request.log.error({ err: error }, 'Unhandled server error');
    return reply.status(500).send({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred',
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: `Route ${request.method}:${request.url} not found`,
    });
  });
});

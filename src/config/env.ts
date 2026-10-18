import { existsSync } from 'node:fs';
import { z } from 'zod';

// Load variables from a local .env file when present (never overrides real env vars).
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_TIME_WINDOW: z.string().default('1 minute'),

  // Database (MySQL)
  DATABASE_HOST: z.string().default('127.0.0.1'),
  DATABASE_PORT: z.coerce.number().int().positive().default(3306),
  DATABASE_USER: z.string().default('fastify_user'),
  DATABASE_PASSWORD: z.string().default('fastify_password'),
  DATABASE_NAME: z.string().default('fastify_db'),
  DATABASE_ROOT_PASSWORD: z.string().default('root_password'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates environment variables. Throws with a readable
 * message if any variable is missing or invalid, so the app fails fast.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}

export const env = loadEnv();

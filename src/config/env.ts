import { existsSync } from 'node:fs';
import { z } from 'zod';

// Load variables from a local .env file when present (never overrides real env vars).
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// Development-only secrets. They are fine locally but must never reach production.
const DEV_JWT_SECRET = 'development-jwt-secret-key-must-be-at-least-32-characters-long';
const DEV_COOKIE_SECRET = 'development-cookie-secret-key-must-be-at-least-32-characters-long';
const PRODUCTION_SECRET_MIN_LENGTH = 32;

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

  // Authentication & Secrets
  JWT_SECRET: z.string().min(16).default(DEV_JWT_SECRET),
  COOKIE_SECRET: z.string().min(16).default(DEV_COOKIE_SECRET),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
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

  if (result.data.NODE_ENV === 'production') {
    const problems = findInsecureProductionSecrets(result.data);
    if (problems.length > 0) {
      throw new Error(`Insecure secrets for NODE_ENV=production:\n- ${problems.join('\n- ')}`);
    }
  }

  return result.data;
}

/** Returns one message per secret that is a dev default or too short for production. */
export function findInsecureProductionSecrets(
  config: Pick<Env, 'JWT_SECRET' | 'COOKIE_SECRET'>,
): string[] {
  const checks: Array<[name: string, value: string, devDefault: string]> = [
    ['JWT_SECRET', config.JWT_SECRET, DEV_JWT_SECRET],
    ['COOKIE_SECRET', config.COOKIE_SECRET, DEV_COOKIE_SECRET],
  ];

  return checks.flatMap(([name, value, devDefault]) => {
    const problems: string[] = [];
    if (value === devDefault) {
      problems.push(`${name} is the development default; set a unique value`);
    }
    if (value.length < PRODUCTION_SECRET_MIN_LENGTH) {
      problems.push(`${name} must be at least ${PRODUCTION_SECRET_MIN_LENGTH} characters`);
    }
    return problems;
  });
}

export const env = loadEnv();

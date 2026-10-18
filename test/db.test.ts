import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { users } from '../src/db/schema/index.js';

describe('Database connection & Drizzle ORM', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    // Cleanup any test user created during tests
    if (app.db) {
      await app.db.delete(users).where(eq(users.email, 'test_db@example.com'));
    }
    await app.close();
  });

  it('provides app.db and app.dbPool instances', () => {
    expect(app.db).toBeDefined();
    expect(app.dbPool).toBeDefined();
  });

  it('can insert and query records using Drizzle ORM', async () => {
    // Clean up if already exists
    await app.db.delete(users).where(eq(users.email, 'test_db@example.com'));

    await app.db.insert(users).values({
      email: 'test_db@example.com',
      passwordHash: 'hashed_password_sample',
      role: 'user',
    });

    const results = await app.db
      .select()
      .from(users)
      .where(eq(users.email, 'test_db@example.com'))
      .limit(1);

    expect(results).toHaveLength(1);
    const found = results[0];
    expect(found?.email).toBe('test_db@example.com');
    expect(found?.role).toBe('user');
    expect(found?.createdAt).toBeInstanceOf(Date);
  });
});

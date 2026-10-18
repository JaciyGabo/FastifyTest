import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { users } from '../src/db/schema/index.js';

describe('Authentication & User Flow', () => {
  let app: FastifyInstance;
  const testEmail = `auth_test_${Date.now()}@example.com`;
  const testPassword = 'StrongPassword123!';

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    // Clean up if existed
    await app.db.delete(users).where(eq(users.email, testEmail));
  });

  afterAll(async () => {
    if (app.db) {
      await app.db.delete(users).where(eq(users.email, testEmail));
    }
    await app.close();
  });

  let accessToken = '';
  let refreshCookie = '';

  it('POST /auth/register creates a user and returns accessToken + httpOnly cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: testEmail,
        password: testPassword,
        role: 'user',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{
      user: { id: number; email: string; role: string };
      accessToken: string;
    }>();
    expect(body.user.email).toBe(testEmail);
    expect(body.user.role).toBe('user');
    expect(typeof body.accessToken).toBe('string');
    accessToken = body.accessToken;

    const cookies = res.cookies;
    const refCookie = cookies.find((c) => c.name === 'refreshToken');
    expect(refCookie).toBeDefined();
    expect(refCookie?.httpOnly).toBe(true);
    expect(refCookie?.path).toBe('/auth');
    refreshCookie = `${refCookie?.name}=${refCookie?.value}`;
  });

  it('POST /auth/register rejects duplicate email with 409 Conflict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: testEmail,
        password: testPassword,
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toHaveProperty('error', 'EMAIL_ALREADY_EXISTS');
  });

  it('POST /auth/login fails on wrong credentials with 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: testEmail,
        password: 'wrong-password-123',
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toHaveProperty('error', 'INVALID_CREDENTIALS');
  });

  it('POST /auth/login succeeds with correct credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: testEmail,
        password: testPassword,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ user: { email: string }; accessToken: string }>();
    expect(body.user.email).toBe(testEmail);
    expect(typeof body.accessToken).toBe('string');

    const cookies = res.cookies;
    const refCookie = cookies.find((c) => c.name === 'refreshToken');
    expect(refCookie).toBeDefined();
    refreshCookie = `${refCookie?.name}=${refCookie?.value}`;
  });

  it('GET /users/me rejects unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
    });

    expect(res.statusCode).toBe(401);
  });

  it('GET /users/me returns authenticated user profile with valid JWT Bearer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ user: { email: string; role: string } }>();
    expect(body.user.email).toBe(testEmail);
    expect(body.user.role).toBe('user');
  });

  it('POST /auth/refresh rotates the refresh token and issues a new access token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: refreshCookie,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ user: { email: string }; accessToken: string }>();
    expect(typeof body.accessToken).toBe('string');
    expect(body.user.email).toBe(testEmail);

    const newCookie = res.cookies.find((c) => c.name === 'refreshToken');
    expect(newCookie).toBeDefined();

    // Verify old refresh token is now invalidated / revoked (Token Rotation)
    const secondRefreshRes = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: refreshCookie,
      },
    });
    expect(secondRefreshRes.statusCode).toBe(401);

    refreshCookie = `${newCookie?.name}=${newCookie?.value}`;
  });

  it('POST /auth/logout clears the refresh cookie and revokes the token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: {
        cookie: refreshCookie,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ message: 'Logged out successfully' });

    // Ensure the token can no longer be used to refresh
    const retryRes = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: refreshCookie,
      },
    });
    expect(retryRes.statusCode).toBe(401);
  });
});

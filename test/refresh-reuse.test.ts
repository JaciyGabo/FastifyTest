import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { users } from '../src/db/schema/index.js';

describe('Refresh token reuse detection', () => {
  let app: FastifyInstance;
  const email = `refresh_reuse_${Date.now()}@example.com`;
  const otherEmail = `refresh_other_${Date.now()}@example.com`;
  const password = 'StrongPassword123!';

  const cookieFrom = (res: { cookies: Array<{ name: string; value: string }> }) => {
    const cookie = res.cookies.find((c) => c.name === 'refreshToken');
    if (!cookie) throw new Error('refreshToken cookie missing');
    return `${cookie.name}=${cookie.value}`;
  };

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.db.delete(users).where(eq(users.email, email));
    await app.db.delete(users).where(eq(users.email, otherEmail));
    await app.close();
  });

  it('revokes every session when a rotated refresh token is replayed', async () => {
    const registered = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password },
    });
    expect(registered.statusCode).toBe(201);
    const original = cookieFrom(registered);

    // Legitimate rotation: the original token is revoked and a new one is issued.
    const rotated = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: original },
    });
    expect(rotated.statusCode).toBe(200);
    const current = cookieFrom(rotated);

    // Replaying the revoked token fails and invalidates the newer session too.
    const replay = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: original },
    });
    expect(replay.statusCode).toBe(401);

    const afterReplay = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: current },
    });
    expect(afterReplay.statusCode).toBe(401);
  });

  it('does not revoke sessions when an unknown token with a valid signature is presented', async () => {
    const registered = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: otherEmail, password },
    });
    const userId = registered.json<{ user: { id: number } }>().user.id;
    const valid = cookieFrom(registered);

    // Correctly signed, but the token was never issued: nothing should be revoked.
    const forged = app.signCookie(`${userId}.${'a'.repeat(80)}`);
    const attempt = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: `refreshToken=${encodeURIComponent(forged)}` },
    });
    expect(attempt.statusCode).toBe(401);

    const stillValid = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: valid },
    });
    expect(stillValid.statusCode).toBe(200);
  });
});

import { and, eq, gt, isNull } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { refreshTokens, type NewRefreshToken, type RefreshToken } from '../../db/schema/index.js';

export class AuthRepository {
  constructor(private readonly db: Database) {}

  async createRefreshToken(data: NewRefreshToken): Promise<RefreshToken> {
    const [result] = await this.db.insert(refreshTokens).values(data);
    const insertId = result.insertId;

    const [token] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.id, insertId))
      .limit(1);

    if (!token) {
      throw new Error('Failed to retrieve newly created refresh token');
    }
    return token;
  }

  /** Finds a token regardless of its state, so reuse of a revoked token can be detected. */
  async findRefreshTokenByHash(
    userId: number,
    tokenHash: string,
  ): Promise<RefreshToken | undefined> {
    const results = await this.db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.tokenHash, tokenHash)))
      .limit(1);

    return results[0];
  }

  async findValidRefreshToken(
    userId: number,
    tokenHash: string,
  ): Promise<RefreshToken | undefined> {
    const now = new Date();
    const results = await this.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, now),
        ),
      )
      .limit(1);

    return results[0];
  }

  async revokeRefreshToken(id: number): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, id));
  }

  async revokeAllUserTokens(userId: number): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }
}

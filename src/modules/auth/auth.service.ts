import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';

import { env } from '../../config/env.js';
import type { User } from '../../db/schema/index.js';
import { ConflictError, UnauthorizedError } from '../../shared/errors/app-error.js';
import type { UsersRepository } from '../users/users.repository.js';
import type { AuthRepository } from './auth.repository.js';

export interface UserWithoutPassword {
  id: number;
  email: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

export function sanitizeUser(user: User): UserWithoutPassword {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class AuthService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly authRepo: AuthRepository,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private calculateExpiryDate(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);
    return expiresAt;
  }

  async register(params: {
    email: string;
    password: string;
  }): Promise<{ user: UserWithoutPassword; refreshToken: string }> {
    const existing = await this.usersRepo.findByEmail(params.email.toLowerCase());
    if (existing) {
      throw new ConflictError('A user with this email already exists', 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await argon2.hash(params.password);
    const user = await this.usersRepo.create({
      email: params.email.toLowerCase(),
      passwordHash,
      role: 'user',
    });

    const rawRefreshToken = randomBytes(40).toString('hex');
    await this.authRepo.createRefreshToken({
      userId: user.id,
      tokenHash: this.hashToken(rawRefreshToken),
      expiresAt: this.calculateExpiryDate(),
    });

    return {
      user: sanitizeUser(user),
      refreshToken: rawRefreshToken,
    };
  }

  async login(params: {
    email: string;
    password: string;
  }): Promise<{ user: UserWithoutPassword; refreshToken: string }> {
    const user = await this.usersRepo.findByEmail(params.email.toLowerCase());
    if (!user) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const isValid = await argon2.verify(user.passwordHash, params.password);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const rawRefreshToken = randomBytes(40).toString('hex');
    await this.authRepo.createRefreshToken({
      userId: user.id,
      tokenHash: this.hashToken(rawRefreshToken),
      expiresAt: this.calculateExpiryDate(),
    });

    return {
      user: sanitizeUser(user),
      refreshToken: rawRefreshToken,
    };
  }

  async refresh(params: {
    userId: number;
    refreshToken: string;
  }): Promise<{ user: UserWithoutPassword; newRefreshToken: string }> {
    const tokenHash = this.hashToken(params.refreshToken);
    const validRecord = await this.authRepo.findValidRefreshToken(params.userId, tokenHash);

    if (!validRecord) {
      // A revoked token that is presented again means it was copied or stolen after
      // rotation. Revoke every session of the user so the attacker's token stops working.
      const known = await this.authRepo.findRefreshTokenByHash(params.userId, tokenHash);
      if (known?.revokedAt) {
        await this.authRepo.revokeAllUserTokens(params.userId);
      }

      throw new UnauthorizedError(
        'Invalid, expired or revoked refresh token',
        'INVALID_REFRESH_TOKEN',
      );
    }

    // Revoke used refresh token (Token Rotation)
    await this.authRepo.revokeRefreshToken(validRecord.id);

    const user = await this.usersRepo.findById(params.userId);
    if (!user) {
      throw new UnauthorizedError('User not found', 'USER_NOT_FOUND');
    }

    // Generate and store new refresh token
    const newRawRefreshToken = randomBytes(40).toString('hex');
    await this.authRepo.createRefreshToken({
      userId: user.id,
      tokenHash: this.hashToken(newRawRefreshToken),
      expiresAt: this.calculateExpiryDate(),
    });

    return {
      user: sanitizeUser(user),
      newRefreshToken: newRawRefreshToken,
    };
  }

  async logout(params: { userId: number; refreshToken?: string }): Promise<void> {
    if (params.refreshToken) {
      const tokenHash = this.hashToken(params.refreshToken);
      const record = await this.authRepo.findValidRefreshToken(params.userId, tokenHash);
      if (record) {
        await this.authRepo.revokeRefreshToken(record.id);
        return;
      }
    }
    // Revoke all tokens for the user if specific token not given or already revoked
    await this.authRepo.revokeAllUserTokens(params.userId);
  }
}

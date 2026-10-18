import { z } from 'zod';

export const userPublicSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  role: z.enum(['user', 'admin']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const registerBodySchema = z.object({
  email: z.string().email('Valid email address required'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  role: z.enum(['user', 'admin']).optional().default('user'),
});

export const loginBodySchema = z.object({
  email: z.string().email('Valid email address required'),
  password: z.string().min(1, 'Password required'),
});

export const authResponseSchema = z.object({
  user: userPublicSchema,
  accessToken: z.string(),
});

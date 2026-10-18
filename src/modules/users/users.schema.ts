import { z } from 'zod';

import { userPublicSchema } from '../auth/auth.schema.js';

export const userProfileResponseSchema = z.object({
  user: userPublicSchema,
});

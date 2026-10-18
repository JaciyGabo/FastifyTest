import { eq } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { users, type NewUser, type User } from '../../db/schema/index.js';

export class UsersRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<User | undefined> {
    const results = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return results[0];
  }

  async findById(id: number): Promise<User | undefined> {
    const results = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return results[0];
  }

  async create(data: NewUser): Promise<User> {
    const [result] = await this.db.insert(users).values(data);
    const insertId = result.insertId;

    const user = await this.findById(insertId);
    if (!user) {
      throw new Error('Failed to retrieve newly created user');
    }
    return user;
  }
}

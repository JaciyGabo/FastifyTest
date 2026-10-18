import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

import { env } from '../config/env.js';
import * as schema from './schema/index.js';

export type Database = MySql2Database<typeof schema>;

let pool: mysql.Pool | null = null;
let db: Database | null = null;

export function getDbPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: env.DATABASE_HOST,
      port: env.DATABASE_PORT,
      user: env.DATABASE_USER,
      password: env.DATABASE_PASSWORD,
      database: env.DATABASE_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
    });
  }
  return pool;
}

export function getDb(): Database {
  if (!db) {
    const connectionPool = getDbPool();
    db = drizzle({ client: connectionPool, schema, mode: 'default' });
  }
  return db;
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

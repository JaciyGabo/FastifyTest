import fp from 'fastify-plugin';
import type mysql from 'mysql2/promise';

import { closeDbPool, getDb, getDbPool, type Database } from '../db/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    dbPool: mysql.Pool;
  }
}

export const dbPlugin = fp(async (app) => {
  const db = getDb();
  const dbPool = getDbPool();

  app.decorate('db', db);
  app.decorate('dbPool', dbPool);

  app.addHook('onClose', async () => {
    await closeDbPool();
  });
});

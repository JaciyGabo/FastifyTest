import { migrate } from 'drizzle-orm/mysql2/migrator';

import { closeDbPool, getDb } from './client.js';

export async function runMigrations(): Promise<void> {
  const db = getDb();
  await migrate(db, { migrationsFolder: './drizzle' });
}

// If executed directly as a script
const isDirectExecution =
  process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js');

if (isDirectExecution) {
  runMigrations()
    .then(() => {
      console.log('Database migrations executed successfully.');
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await closeDbPool();
    });
}

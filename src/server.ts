import closeWithGrace from 'close-with-grace';

import { buildApp } from './app.js';
import { env } from './config/env.js';
import { buildLoggerOptions } from './config/logger.js';

const app = await buildApp({ logger: buildLoggerOptions(env) });

// Gracefully close on SIGINT/SIGTERM or fatal errors: stop accepting new connections,
// let in-flight requests finish and run onClose hooks (e.g. DB pool) before exiting.
closeWithGrace({ delay: 10_000, logger: app.log }, async ({ signal, err }) => {
  if (err) {
    app.log.error({ err }, 'Server closing due to an error');
  } else {
    app.log.info({ signal }, 'Shutdown signal received, closing server');
  }

  await app.close();
});

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

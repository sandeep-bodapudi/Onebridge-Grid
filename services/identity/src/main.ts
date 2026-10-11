import 'reflect-metadata';
import { redactMongoUri } from '@onebridge/shared';
import { createApp } from './app.js';
import { loadAndValidateEnv } from './config/env.js';

export async function bootstrap() {
  const config = loadAndValidateEnv();
  const app = await createApp({ envConfig: config });

  await app.listen(config.port);
  console.log(
    `[OneBridge Identity] Started on port ${config.port} | Mongo: ${redactMongoUri(
      config.mongoUri
    )} | Env: ${config.nodeEnv}`
  );
  return app;
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  bootstrap().catch((err) => {
    console.error('[OneBridge Identity] Fatal startup error:', err);
    process.exit(1);
  });
}

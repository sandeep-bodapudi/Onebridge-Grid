import { connectMongo } from '@onebridge/shared';
import { createApp } from './app.js';
import { loadAndValidateEnv } from './config/env.js';

async function bootstrap() {
  const config = loadAndValidateEnv();
  const connectionHandle = await connectMongo(config.mongoUri);

  const app = await createApp({ envConfig: config, connectionHandle });

  await app.listen(config.port, '0.0.0.0');
  console.log(`[SocialService] Running on port ${config.port}`);
}

bootstrap().catch((err) => {
  console.error('[SocialService] Failed to bootstrap:', err);
  process.exit(1);
});

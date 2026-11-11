import { env } from './env';
import { createApp } from './app';
import { db } from './db';

const server = createApp().listen(env.port, () => {
  console.log(`Rentora API listening on http://localhost:${env.port}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    server.close(() => db.$disconnect().finally(() => process.exit(0)));
  });
}

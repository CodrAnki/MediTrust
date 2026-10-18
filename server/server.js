import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { migrateLegacyReferenceImages } from './services/referenceImageService.js';
import app from './app.js';
import { shutdownOcrWorker } from './services/ocrService.js';

async function start() {
  await connectDB();

  // Idempotent: turns the legacy Medicine.image field into approved ReferenceImage records.
  try {
    const migrated = await migrateLegacyReferenceImages();
    if (migrated) console.log(`Migrated ${migrated} legacy reference image(s).`);
  } catch (err) {
    console.error('Legacy reference image migration skipped:', err.message);
  }

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`MediTrust API listening on http://localhost:${env.port}`);
    // eslint-disable-next-line no-console
    console.log(`CORS allowed origin(s): ${env.clientUrls.join(', ')}`);
  });

  // Graceful shutdown: stop accepting requests and release the OCR worker thread.
  const shutdown = () => {
    server.close(async () => { await shutdownOcrWorker(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start();


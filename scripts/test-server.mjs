// Isolated, in-memory PostgreSQL-compatible test database. Never uses .env or live data.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, open } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function startTestServer() {
  const database = await PGlite.create();
  const socket = new PGLiteSocketServer({ db: database, host: '127.0.0.1', port: 55439, maxConnections: 30 });
  await socket.start();
  const env = { ...process.env, DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55439/postgres', SITE_URL: 'http://localhost:3137', ADMIN_PASSWORD: 'test-password-only-2026', TRUST_PROXY: '0', DB_POOL_MAX: '1', PORT: '3137', HOSTNAME: '127.0.0.1' };
  let app;
  const close = async () => { app?.kill(); await socket.stop(); await database.close(); };
  try {
    // Execute the actual migration runner twice to exercise idempotency.
    for (let i = 0; i < 2; i++) await promisify(execFile)(process.execPath, ['scripts/migrate.mjs'], { env });
    await mkdir('output', { recursive: true });
    const log = await open('output/test-server.log', 'w');
    app = spawn(process.execPath, ['scripts/start.mjs'], { env, stdio: ['ignore', log.fd, log.fd], windowsHide: true });
    await log.close();
    for (let i = 0; i < 60; i++) {
      if (app.exitCode !== null) throw new Error('Test app exited; inspect output/test-server.log');
      try { if ((await fetch(env.SITE_URL + '/api/health')).ok) return { close, database, origin: env.SITE_URL }; } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Test server startup timed out');
  } catch (error) { await close(); throw error; }
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await startTestServer();
  console.log('Isolated empty-site preview: ' + server.origin);
  process.on('SIGINT', async () => { await server.close(); process.exit(); });
}

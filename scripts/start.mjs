import 'dotenv/config';
import { cp, mkdir } from 'node:fs/promises';
// Next standalone does not copy static assets automatically.
await mkdir(new URL('../.next/standalone/.next/', import.meta.url), { recursive: true });
await cp(new URL('../.next/static/', import.meta.url), new URL('../.next/standalone/.next/static/', import.meta.url), { recursive: true });
process.env.HOSTNAME ||= '127.0.0.1';
await import('../.next/standalone/server.js');

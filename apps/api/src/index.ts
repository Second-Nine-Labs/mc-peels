/**
 * Vercel entrypoint. Vercel's Hono framework preset auto-detects a default
 * export of a Hono app at src/index.ts and turns its routes into Vercel
 * Functions — no vercel.json or api/ directory needed.
 *
 * Local Node dev uses src/dev.ts, which wraps this same app in
 * @hono/node-server.
 */
import { createApp } from './http/app';

const app = createApp();

export default app;

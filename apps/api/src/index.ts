/**
 * Vercel entrypoint. Vercel's Hono framework preset requires the entrypoint to
 * (a) import `hono` directly and (b) default-export the Hono app instance, so
 * the actual app construction stays in ./http/app and this file just wires it
 * up. Local Node dev uses src/dev.ts, which serves this same app.
 */
import { Hono } from 'hono';
import { createApp } from './http/app.js';

const app = createApp();

// Guards the Vercel contract and keeps the direct `hono` import load-bearing.
if (!(app instanceof Hono)) {
  throw new Error('createApp() must return a Hono instance');
}

export default app;

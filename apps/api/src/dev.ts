/**
 * Local development server (npm run dev:api). Not used on Vercel — there the
 * default export from src/index.ts is the entrypoint.
 */
import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './index';
import { env } from './env';

serve({ fetch: app.fetch, port: env().PORT }, (info) => {
  console.log(`MC Peels API listening on http://localhost:${info.port}`);
  console.log(`  REST: http://localhost:${info.port}/api/v1`);
  console.log(`  MCP:  http://localhost:${info.port}/mcp`);
});

import 'dotenv/config';
import { serve } from '@hono/node-server';
import { env } from './env';
import { createApp } from './http/app';

const app = createApp();

serve({ fetch: app.fetch, port: env().PORT }, (info) => {
  console.log(`MC Peels API listening on http://localhost:${info.port}`);
  console.log(`  REST: http://localhost:${info.port}/api/v1`);
  console.log(`  MCP:  http://localhost:${info.port}/mcp`);
});

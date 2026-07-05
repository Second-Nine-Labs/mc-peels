import { StreamableHTTPTransport } from '@hono/mcp';
import { Hono } from 'hono';
import { verifyMcpToken } from '../auth/tokens.js';
import { buildMcpServer } from './server.js';

/**
 * Streamable-HTTP MCP endpoint, stateless: a fresh server + transport per
 * request, scoped to the user resolved from the mcp_ bearer token.
 */
export const mcpRoute = new Hono();

mcpRoute.all('/', async (c) => {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  const identity = token ? await verifyMcpToken(token) : null;
  if (!identity) {
    return c.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message:
            'Unauthorized. Pass an MC Peels personal access token (mcp_...) as a Bearer token. ' +
            'Mint one via POST /api/v1/tokens.',
        },
        id: null,
      },
      401,
    );
  }

  const server = buildMcpServer(identity.userId);
  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  const response = await transport.handleRequest(c);
  return response ?? c.body(null, 202);
});

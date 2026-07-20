import { StreamableHTTPTransport } from '@hono/mcp';
import { Hono } from 'hono';
import { verifyOAuthAccessToken } from '../auth/oauth.js';
import { verifyMcpToken } from '../auth/tokens.js';
import { buildMcpServer } from './server.js';

/**
 * Streamable-HTTP MCP endpoint, stateless: a fresh server + transport per
 * request, scoped to the user resolved from the bearer token — either a
 * personal access token (mcp_) or an OAuth access token (mcpa_).
 */
export const mcpRoute = new Hono();

mcpRoute.all('/', async (c) => {
  const header = c.req.header('Authorization');
  // trim(): tokens arrive by human paste; a stray newline must not 401.
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
  const identity = token
    ? (await verifyMcpToken(token)) ?? (await verifyOAuthAccessToken(token))
    : null;
  if (!identity) {
    return c.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message:
            'Unauthorized. Pass an MC Peels token as a Bearer token: a personal access token ' +
            '(mcp_..., minted in Household → Agent access) or an OAuth access token (mcpa_...).',
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

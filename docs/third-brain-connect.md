# Connecting an agent host to MC Peels (the "Connect MC Peels" seam)

The contract between MC Peels and any agent host (Third Brain's Chief of Staff
first) that wants per-user MCP access. One page, one redirect, no OAuth server.

## Flow

1. **Send the user to the connect page:**

   ```
   https://mc-peels.secondninelabs.com/connect
       ?name=Chief+of+Staff                  (display name; becomes the token's label)
       &redirect_uri=https://brainos.secondninelabs.com/integrations/mcpeels/callback
       &state=<opaque CSRF value>            (optional, echoed back verbatim)
   ```

2. **User signs in (inline) and taps "Connect".** MC Peels mints a personal
   access token (`mcp_` + 43 base64url chars) tied to that user.

3. **MC Peels redirects back with the token in the URL FRAGMENT** (fragments
   never reach servers or logs — read it client-side):

   ```
   <redirect_uri>#token=mcp_...&state=<echoed state>
   ```

   On cancel: `<redirect_uri>#error=access_denied&state=<echoed state>`.

4. **Store the token** (encrypted at rest) and verify `state` matches what you
   sent.

## Using the token

Call the MCP server with it as the bearer — this is exactly the per-user
`authorization_token` an MCP client forwards:

```
POST https://mc-peels-api-9zt9.vercel.app/mcp
Authorization: Bearer mcp_...
```

Transport: Streamable HTTP. Household + dietary profile resolve server-side
from the token; agents never pass filters. Tools: `mcpeels_create_cart`,
`mcpeels_list_retailers`, `mcpeels_get_cart`, `mcpeels_list_recent_carts`,
`mcpeels_get_household`.

Invalid/revoked tokens get a JSON-RPC error `-32001` with HTTP 401 — treat that
as "prompt the user to reconnect."

## Security rules

- `redirect_uri` must be **https** (plain http allowed only for localhost) and
  its **origin must be allowlisted** via `EXPO_PUBLIC_CONNECT_REDIRECT_ORIGINS`
  (comma-separated origins) on the web app; default allowlist is
  `https://brainos.secondninelabs.com`. Unlisted origins are hard-rejected —
  no token is minted.
- localhost redirect URIs are always allowed (agent-host local development).
- Tokens are shown/transferred once; only a SHA-256 hash is stored. Users can
  revoke any token in the app (Household tab → Agent access), which 401s the
  MCP server immediately.
- Without a `redirect_uri`, the page falls back to a copy-the-token screen —
  the paste model keeps working as a manual path.

## Notes for the Third Brain implementation

- The callback page reads `location.hash`, not query params.
- A connected user might not have a household yet (`not_found` from tools) —
  surface "finish setting up your household in MC Peels" rather than an error.
- Purchases are never autonomous: every cart tool returns an `instacart_url`
  a human must open and check out on Instacart (PRD section 3).

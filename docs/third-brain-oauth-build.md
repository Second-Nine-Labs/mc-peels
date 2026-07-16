# Build: OAuth "Sign in with MC Peels" (Third Brain's connect flow)

**Why:** the `mcp_` personal-access-token flow made a family member mint/copy/paste
a token, and end-to-end it never authenticated (`api_tokens.last_used_at` was
null on every token). We're replacing it with one-click OAuth. Third Brain's
half is already built to this contract (`household-os/docs/mcpeels-oauth-connect.md`);
this is MC Peels' half.

**End-user experience:** tap Connect in Third Brain → land here, sign in once →
tap Allow → bounced back. No token ever shown.

**Good news:** MC Peels already validates Supabase bearer tokens on `/api/v1`
(`verifySupabaseToken`, `c.get('userId')`), and the consent UI already exists in
`apps/mobile/app/connect.tsx`. This is mostly wiring, not new auth.

---

## Tasks

### 1. Redirect allowlist (trivial)
Reuse the existing `EXPO_PUBLIC_CONNECT_REDIRECT_ORIGINS` / `checkRedirect` from
`connect.tsx`. Ensure `https://brainos.secondninelabs.com` stays allowlisted.
The callback path Third Brain uses is
`https://brainos.secondninelabs.com/api/mcpeels/callback` (localhost allowed for dev).

### 2. `GET /oauth/authorize` — reuse `connect.tsx`
Almost identical to today's connect screen. Params (standard OAuth):
`response_type=code`, `client_id=third-brain`, `redirect_uri`, `scope=groceries`,
`state`, `code_challenge`, `code_challenge_method=S256`.

- Validate `redirect_uri` with the existing origin allowlist. Reject unlisted → no code.
- Sign in + one-line consent — reuse the inline Supabase sign-in already there.
- **On Allow:** mint a **one-time authorization code** (random, ≤60s TTL) bound to
  `{ user_id, code_challenge, redirect_uri, scope }`; redirect
  `→ redirect_uri?code=<code>&state=<echoed>`.
- **On Deny:** `→ redirect_uri?error=access_denied&state=<echoed>`.

The only change from `connect.tsx`'s current `approve()`: instead of
`api.createToken()` + `#token=...` fragment, create a code and redirect with
`?code=...` (query, not fragment).

### 3. `POST /oauth/token` — new Hono route (next to `api.post('/tokens')` in `http/app.ts`)
Accepts `application/x-www-form-urlencoded`. Two grants:

- **`grant_type=authorization_code`** — fields `code`, `redirect_uri`, `client_id`,
  `code_verifier`. Verify: code exists, unexpired, single-use, `redirect_uri`
  matches, and `base64url(sha256(code_verifier)) === code_challenge`. →
  ```json
  { "access_token": "...", "refresh_token": "...", "token_type": "Bearer", "expires_in": 3600, "scope": "groceries" }
  ```
- **`grant_type=refresh_token`** — fields `refresh_token`, `client_id`. Validate →
  `{ "access_token": "...", "expires_in": 3600 }` (rotate `refresh_token` or not — Third Brain handles both).
- **Errors:** `400 { "error": "invalid_grant" | "invalid_request" }`.
  `invalid_grant` on refresh signals Third Brain the grant is dead → it drops the
  connection and the user reconnects.

`client_id=third-brain` is a **public PKCE client** — no client secret required
(PKCE is the proof). If you'd rather use a confidential client, tell us and we'll
set `MCPEELS_CLIENT_SECRET` on our side.

### 4. Make `/mcp` accept the OAuth access token
In `apps/api/src/mcp/route.ts`, the bearer check currently calls `verifyMcpToken`.
Extend it to also resolve the OAuth access token → `userId`, then the rest is
unchanged. Pick the access-token type — two options:

- **(Recommended, scoped)** MC-Peels-signed JWT carrying `sub = user_id`, ~1h
  expiry. `/mcp` verifies the signature and reads `user_id`. Clean, revocable,
  minimal scope.
- **(Fastest, broader)** Reuse the Supabase session: access_token = Supabase
  access token, refresh_token = Supabase refresh token; `/mcp` validates with the
  existing `verifySupabaseToken`; `/oauth/token` refresh proxies Supabase's refresh.
  Least code, but hands Third Brain a full Supabase session — acceptable for a
  low-stakes family grocery app; **do not** reuse this shape for anything that can
  move money.

On expired/invalid access token → **HTTP 401** so Third Brain refreshes.

### 5. Storage (new tables)
- `oauth_authorization_codes` — `code_hash`, `user_id`, `code_challenge`,
  `redirect_uri`, `scope`, `expires_at`, `consumed_at`. Reuse the `hashToken`
  SHA-256 helper. Delete/mark consumed on use.
- `oauth_refresh_tokens` — `token_hash`, `user_id`, `scope`, `created_at`,
  `revoked_at`. Hashed at rest, revocable (this is the long-lived secret).
- Access tokens are stateless if you go the JWT route (nothing to store).

### 6. Retire the old path (optional, later)
`mcp_` tokens (`api_tokens`, `POST /api/v1/tokens`, `verifyMcpToken`) are no
longer the connect mechanism. Leave them or remove once OAuth is verified end-to-end.

---

## Token shapes (what Third Brain expects, verbatim)

`/oauth/token` success:
```json
{ "access_token": "<opaque to us>", "refresh_token": "<opaque>", "token_type": "Bearer", "expires_in": 3600, "scope": "groceries" }
```
Refresh may omit `refresh_token` (we keep the old one) or rotate it (we store the new one).

## Scope
`groceries` = build/read carts + read household + dietary profile. **No money
movement** — checkout stays on Instacart, done by the human. Keep it that way.

## Test handshake (once built)
1. Hit `GET /oauth/authorize?response_type=code&client_id=third-brain&redirect_uri=http://localhost:3000/api/mcpeels/callback&scope=groceries&state=abc&code_challenge=<S256>&code_challenge_method=S256`, sign in, Allow → confirm redirect carries `?code&state`.
2. `POST /oauth/token` with that code + verifier → confirm a token pair back.
3. `POST /mcp` with `Authorization: Bearer <access_token>` + `{"jsonrpc":"2.0","id":1,"method":"tools/list"}` → confirm the tool list (this is where the old flow failed — `-32001`).

When all three pass, ping the Third Brain side and we deploy.

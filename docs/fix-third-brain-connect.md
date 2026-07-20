# FIX: Third Brain can't connect to MC Peels — two bugs, one owed feature

**Date:** July 20, 2026
**From:** the Third Brain session (household-os repo)
**Status:** blocking a real user — the owner tried to connect the Second 9 Labs
family and hit a dead end both ways (OAuth button → "Unmatched Route"; minted
token → nowhere to authenticate).

Read `docs/third-brain-oauth-build.md` first if you haven't — it's the build
brief for the OAuth half and is still accurate. This doc is the *live-failure*
report: what's broken in prod right now, with evidence, and what "fixed" means.

---

## STATUS — July 20, 2026 (MC Peels side): both bugs addressed, one human step left

**Bug 2 diagnosis.** The server was never broken. Verified live: the deployed
API is built from current `main` (`d701411`; zero API-file diff vs. local), and
a *well-formed* unknown `mcp_` token gets a clean `-32001` from `/mcp` — which
means the deployed verify path queried a live `api_tokens` table and found no
row (a dead/wrong `DATABASE_URL` would 500, since `verifyMcpToken` throws
before the -32001 is reachable). Mints demonstrably land in the same database
through the same `getDb()`. Ergo: **the string presented to `/mcp` was never
the string that was hashed at mint.** The mint screen (Household → Agent
access) displayed the token as bare selectable text with **no Copy button**,
and 32-byte base64url tokens contain `-` ~75% of the time — browser
double-click word-selection *stops at hyphens*, so a hand-selected copy
silently drops characters. Both dead tokens ("cheef keef" Jul 15, "Chief of
Staff" Jul 20) fit this failure.

**Shipped in response (branch `feat/third-brain-auth` → main):**

1. **PAT path made un-manglable** — Copy button on the mint screen
   (`navigator.clipboard`, exact bytes), `userSelect: 'all'` on the token text,
   new tokens are hex (no `-`, double-click-safe), `/mcp` trims pasted
   whitespace, and a **paste-check box** (`POST /api/v1/tokens/verify`) lets a
   user confirm their clipboard against the DB *before* giving it to an agent
   (doesn't touch `last_used_at`).
2. **The OAuth half built per the brief** — `/oauth/authorize` consent screen
   (Expo web route; validates client, PKCE S256, redirect allowlist; inline
   sign-in; Allow → one-time 60s code via `POST /api/v1/oauth/code` →
   `?code=&state=` redirect), `POST /oauth/token` (authorization_code +
   refresh_token grants, urlencoded or JSON, RFC error shapes, rotation on
   refresh), `/mcp` accepts the resulting `mcpa_` access tokens (1h, opaque,
   stored hashed, revocable) alongside `mcp_` PATs. Tables
   `oauth_authorization_codes` / `oauth_access_tokens` /
   `oauth_refresh_tokens` migrated (`0005_oauth.sql`, applied).

**Verified:** typecheck + 167 API tests green (incl. RFC 7636 S256 vector);
authorize screen renders Third Brain's exact prod URL locally (sign-in +
consent, hard-stops on bad origin / missing PKCE); all three grant lookups run
clean against the migrated prod DB.

**Left for a human (needs a signed-in account):** mint a fresh token with the
new Copy button and paste-check it, then run acceptance 1 (paste into Third
Brain → tools list, `last_used_at` set) and acceptance 4 (one-tap OAuth
connect → bananas → Instacart link).

---

## What a user experiences today

1. In Third Brain → Settings → **Connect MC Peels** → browser opens
   `https://mc-peels.secondninelabs.com/oauth/authorize?...` → the Expo app
   renders **"Unmatched Route"**. Dead end.
2. So they open MC Peels themselves, mint a personal access token
   (Household → Agent access), and… Third Brain's deployed build had no paste
   field (removed during the OAuth pivot). Dead end #2.
3. Third Brain has now restored a paste-token fallback (branch
   `mcpeels-token-fallback`, deploying shortly). **But that only helps if your
   `/mcp` actually accepts minted tokens — see Bug 2, which is unproven at
   best and broken at worst.**

---

## Bug 1 — the OAuth endpoints from the build brief were never built

Verified live, July 20:

| Check | Result |
|---|---|
| `GET mc-peels.secondninelabs.com/oauth/authorize?...` | 200, but it's the Expo shell rendering **"Unmatched Route"** — no route exists |
| `POST mc-peels-api-9zt9.vercel.app/oauth/token` | **404** |
| `POST mc-peels-api-9zt9.vercel.app/mcp` (no auth) | `-32001` "Pass an MC Peels personal access token (mcp_...)" — still PAT-only |

The exact authorize URL Third Brain sends (already live in its prod build):

```
https://mc-peels.secondninelabs.com/oauth/authorize
  ?response_type=code
  &client_id=third-brain
  &redirect_uri=https%3A%2F%2Fbrainos.secondninelabs.com%2Fapi%2Fmcpeels%2Fcallback
  &scope=groceries
  &state=<random>
  &code_challenge=<S256>
  &code_challenge_method=S256
```

**Fix:** build the three pieces in `docs/third-brain-oauth-build.md`:
`GET /oauth/authorize` (reuse the `connect.tsx` sign-in/consent screen — the
change is "mint a one-time code and redirect with `?code=` in the query"
instead of "mint a PAT and put `#token=` in the fragment"), `POST /oauth/token`
(auth-code + refresh grants), and `/mcp` accepting the resulting access token.
The brief has exact request/response shapes, storage tables, and a 3-step test
handshake. Until this ships, keep Bug 1's landing page from being a dead end:
even routing `/oauth/authorize` to a "coming soon — use a token from Household
→ Agent access instead" screen beats "Unmatched Route".

---

## Bug 2 — no minted token has EVER successfully authenticated against `/mcp`

This is the scarier one, and it predates the OAuth pivot — it's why the
original paste flow "never worked" back on July 15.

**Evidence (from the MC-Peels Supabase project `bltrwuailnxhefyefzyk`,
`api_tokens` table, checked July 20):**

| name | created_at (UTC) | last_used_at |
|---|---|---|
| "Chief of Staff" | 2026-07-20 01:07 | **null** |
| "cheef keef" | 2026-07-15 03:18 | **null** |

Every token ever minted — across multiple days and attempts, including ones
the owner definitely pasted into Third Brain and exercised through chat — has
`last_used_at: null`. `verifyMcpToken()` sets `last_used_at` on any successful
match (`apps/api/src/auth/tokens.ts`), so **null everywhere means the verify
path has never once matched a presented token.** Meanwhile Anthropic's MCP
connector reported "Authentication error while communicating with MCP server"
when forwarding a stored token.

The code *reads* correct — `createApiToken` and `verifyMcpToken` use the same
`hashToken` (SHA-256 of the full `mcp_…` string), and `/mcp`'s bearer
extraction (`apps/api/src/mcp/route.ts`) strips `Bearer ` properly. Correct
code + zero successful matches ever ⇒ suspect the *deployment*, not the
source. Check, in order:

1. **Is the deployed API running this code?** Confirm the Vercel deployment of
   `mc-peels-api-9zt9` is built from current `main` (not a stale build from
   before `verifyMcpToken` / the `/mcp` auth path existed).
2. **Is the deployed API's `DATABASE_URL` pointing at the same database the
   app mints into?** Mints demonstrably land in Supabase project
   `bltrwuailnxhefyefzyk` (rows above). If the API's env var points anywhere
   else (old project, direct vs. pooler doesn't matter, but *project* does),
   verify will never find the hash.
3. **Prove it end-to-end with a fresh mint, no UI in the loop:**

```bash
# 1. Mint via the API directly (Supabase bearer = a signed-in user's access token)
curl -s -X POST https://mc-peels-api-9zt9.vercel.app/api/v1/tokens \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"diag"}'
# → grab .token from the response

# 2. Immediately present it to /mcp
curl -s https://mc-peels-api-9zt9.vercel.app/mcp \
  -H "Authorization: Bearer <the mcp_ token from step 1>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
# EXPECTED: a tools list (mcpeels_create_cart, …)
# ACTUAL (historically): -32001 Unauthorized

# 3. Check the DB: that token's last_used_at should now be set.
```

If step 2 fails, diff what step 1 stored (`token_hash`) against
`sha256(<token from step 1>)` computed locally — that tells you whether the
mismatch is at mint time (storing a different string than returned) or at
verify time (env/deployment).

One more candidate while you're in there: the **UI mint path**. If
Household → Agent access mints through anything other than
`POST /api/v1/tokens` (or re-renders and mints twice, displaying one token
while a different row's hash is stored), the user copies a string whose hash
isn't in the table. The API-only test above isolates this: if API-minted
tokens verify fine but app-minted ones don't, the bug is in the app screen.

---

## What Third Brain has done on its side (context, no action needed from you)

- **July 15:** rebuilt connect as OAuth-only per the contract; deployed. That's
  why the button exists and 404s against you.
- **July 20:** restored the paste-token path *alongside* OAuth (branch
  `mcpeels-token-fallback`): members can paste an `mcp_…` token in Settings;
  it's stored encrypted and forwarded verbatim as the MCP bearer
  (`Authorization: Bearer mcp_…` via Anthropic's MCP connector). The OAuth
  client code stays live and will take over the moment your endpoints exist —
  no further Third Brain change needed.
- Graceful degradation is in place: when `/mcp` rejects auth, Chief tells the
  member to reconnect instead of erroring. So a broken token fails *politely*
  — but it still fails. Bug 2 is the gate.

## Acceptance — "fixed" means all four

1. A token minted in the app (Household → Agent access) immediately returns a
   tools list from `POST /mcp` with `Authorization: Bearer <token>`, and its
   `last_used_at` gets set. **(Bug 2 — do this first; it unblocks the owner
   TODAY via the paste path.)**
2. `GET /oauth/authorize` with Third Brain's URL above renders sign-in +
   consent — never "Unmatched Route."
3. The 3-step OAuth handshake test at the bottom of
   `docs/third-brain-oauth-build.md` passes.
4. End-to-end: Third Brain Settings → Connect MC Peels → sign in → Allow →
   back in Third Brain → "grab me some organic bananas" in chat returns an
   Instacart link.

Ping the Third Brain side when 1 lands (owner can test immediately) and again
when 2–3 land (Third Brain flips back to the one-tap path with zero deploys).

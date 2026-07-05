# MC Peels

A standalone, multi-tenant food-and-grocery service. A household member says what they
want in plain language — *"go buy organic bananas, blueberries, and grass-fed beef"* —
and MC Peels turns that into an Instacart cart at their preferred store, pre-filtered to
the household's dietary rules, and hands back a one-tap checkout link.

Two front doors over one core:

1. **Consumer app** (iOS / Android / web) — Expo, in [`apps/mobile`](apps/mobile).
2. **MCP server** — for Third Brain's Chief of Staff and any future agent client, served
   by the backend in [`apps/api`](apps/api).

Full product spec: [`mc-peels-prd.md`](mc-peels-prd.md). REST contract: [`docs/api-contract.md`](docs/api-contract.md).

## The hard constraint

The Instacart **Developer Platform API** is a *cart-assembly* API, not a checkout API
(PRD §3). MC Peels builds a shopping-list page and returns its URL; a human opens it,
picks the store, reviews the cart, and pays **on Instacart with their own account**.

- Human-in-the-loop checkout is mandatory and permanent.
- MC Peels never sees or stores anyone's Instacart credentials or payment details.
- One server-side partner API key, used only to build link pages.
- Cart `status` is best-effort local state — Instacart does not report order state back.

## Architecture

```
                  ┌──────────────────────────────────────────┐
                  │            MC Peels backend (Hono)        │
Expo app ──REST──▶│  NL parse (Anthropic) → dietary profile  │
                  │  → retailer resolve → Instacart wrapper ──┼──▶ Instacart Dev Platform API
Chief of ──MCP──▶ │            (partner API key)              │    (returns checkout URL)
Staff             │  Supabase Postgres via Drizzle ORM        │
                  └──────────────────────────────────────────┘
```

- **Backend** — TypeScript, [Hono](https://hono.dev), deployable to Vercel
  (`apps/api/api/index.ts`) or run locally (`npm run dev:api`).
- **Database / auth** — Supabase (Postgres + Auth), Drizzle ORM. Schema in
  [`apps/api/src/db/schema.ts`](apps/api/src/db/schema.ts), migrations in `apps/api/drizzle/`.
- **NL parsing** — Anthropic API turns free text into structured line items; the
  deterministic profile applier ([`apps/api/src/profile/apply.ts`](apps/api/src/profile/apply.ts))
  maps household rules to Instacart brand/health filters.
- **MCP server** — mounted at `/mcp` (Streamable HTTP), authenticated with per-user
  `mcp_…` personal access tokens minted via `POST /api/v1/tokens`.
  Tools: `mcpeels_create_cart`, `mcpeels_list_retailers`, `mcpeels_get_cart`,
  `mcpeels_list_recent_carts`, `mcpeels_get_household`.

### The line-item design (phase-2 hook)

Every line item carries a `source` tag (`direct_request` in v1). Phase 2 adds
`recipe:<id>` sources so a cart builder can group per-recipe or consolidate a whole week
into one deduplicated cart — same model, selectable grouping (PRD §7).

## Getting started

### 1. Provision

- **Supabase**: create a project. You need the project URL, the anon key (for the app),
  the database connection string (use the *pooled* connection for serverless), and
  either the legacy JWT secret or nothing (the backend falls back to JWKS verification).
- **Instacart**: create a Developer Platform account and a **development** API key
  (<https://docs.instacart.com/developer_platform_api/>). Development keys build links
  against `connect.dev.instacart.tools`.
- **Anthropic**: an API key for request parsing.

### 2. Backend

```bash
npm install                       # root; installs the api workspace
cp apps/api/.env.example apps/api/.env   # fill it in
npm run db:migrate -w apps/api    # apply migrations to your Supabase database
npm run dev:api                   # http://localhost:3000
```

Sanity check: `curl http://localhost:3000/health`.

### 3. Mobile / web app

```bash
cd apps/mobile
npm install
cp .env.example .env              # EXPO_PUBLIC_SUPABASE_URL, _ANON_KEY, _API_URL
npx expo start                    # press w for web, or use iOS/Android
```

### 4. MCP (Chief of Staff or any agent)

Sign in, mint a token (`POST /api/v1/tokens`), then point an MCP client at
`https://<api-host>/mcp` with `Authorization: Bearer mcp_…`. The household and dietary
profile are resolved server-side from the token — agents never pass or manage filters.

## Development

```bash
npm run typecheck   # apps/api strict TS
npm test            # vitest unit suite (profile applier, Instacart wrapper, tokens)
```

## Honesty requirements (do not weaken these)

- **Allergens**: Instacart health filters are preference signals for item selection,
  **not** safety guarantees. UI copy and agent responses must never imply MC Peels
  certifies a product allergen-free; the human review at checkout is the final safety
  gate (PRD §8).
- **Quantities are user-determined**: if the user didn't state one, none is invented.
- **Purchases are never autonomous** — MCP tools return links; humans check out.

## Notes

- Branding is not locked ("MC Peels" vs "MC Peaches" / "MC Pears" — PRD §13); package
  names are kept generic to stay easy to rename.
- Retailer pinning: the products-link API has no documented retailer parameter; MC Peels
  appends a best-effort `retailer_key` hint to the URL and the shopper confirms the
  store on Instacart's landing page.

# MC Peels REST API contract (v1)

Base path: `/api/v1`. All endpoints require `Authorization: Bearer <supabase access token>`
unless noted. JSON bodies and responses use `snake_case`.

Errors are always:

```json
{ "error": { "code": "not_found", "message": "Cart not found" } }
```

Codes: `unauthorized` (401), `forbidden` (403), `not_found` (404), `validation_error` (400),
`conflict` (409), `upstream_error` (502), `internal_error` (500).

## Identity

### GET /api/v1/me
Returns the authenticated user and their memberships.

```json
{
  "user": { "id": "uuid", "email": "teej@example.com" },
  "memberships": [
    {
      "household_id": "uuid",
      "role": "owner",
      "household": {
        "id": "uuid",
        "name": "Shaffer Household",
        "postal_code": "10001",
        "country_code": "US",
        "preferred_retailer_key": "kroger",
        "created_at": "2026-07-04T00:00:00Z"
      }
    }
  ]
}
```

Clients should treat the single membership as the active household; if a user has
several, pass explicit `household_id` values to the endpoints below.

## Households

### POST /api/v1/households
Body: `{ "name": string, "postal_code": string, "country_code": "US" | "CA" }`.
Creates the household, makes the caller `owner`, and creates an empty dietary profile.
Returns `201` with the household object (same shape as in `/me`).

### GET /api/v1/households/:id
Member-only. Returns:

```json
{
  "household": { "...": "household fields" },
  "members": [ { "user_id": "uuid", "role": "owner", "joined_at": "..." } ],
  "dietary_profile": { "...": "see dietary profile shape" }
}
```

### PATCH /api/v1/households/:id
Member-only. Body: any of `name`, `postal_code`, `country_code`, `preferred_retailer_key`
(nullable to clear). Returns the updated household.

### POST /api/v1/households/:id/invites
Member-only. Returns `201` `{ "code": "8-char code", "expires_at": "..." }` (expires in 7 days).

### POST /api/v1/households/join
Body: `{ "code": string }`. Joins the caller as `member`. Returns the household.
`404` if the code is invalid/expired, `409` if already a member.

## Dietary profile

Shape (both GET response and PUT body):

```json
{
  "prefer_organic": true,
  "preferred_brands": ["Stonyfield"],
  "excluded_ingredients": ["seed oils"],
  "allergens": ["peanuts"],
  "health_filters": ["GLUTEN_FREE"],
  "notes": "free text for the parser"
}
```

`health_filters` values must be from: `ORGANIC`, `GLUTEN_FREE`, `FAT_FREE`, `VEGAN`,
`KOSHER`, `SUGAR_FREE`, `LOW_FAT`.

### GET /api/v1/households/:id/dietary-profile
### PUT /api/v1/households/:id/dietary-profile
Member-only. PUT replaces the whole profile; returns the saved profile.

> UI copy requirement (PRD section 8): wherever allergens are edited or shown, the app must
> state that filters are preference signals, not safety guarantees, and that the human
> review at Instacart checkout is the final safety gate.

## Retailers

### GET /api/v1/retailers?household_id=uuid&postal_code=10001&country_code=US
`postal_code`/`country_code` default to the household's values (`household_id` required
if the user has multiple households; otherwise inferred).

```json
{ "retailers": [ { "retailer_key": "kroger", "name": "Kroger", "retailer_logo_url": "https://..." } ] }
```

## Carts (the core flow)

### POST /api/v1/carts
Runs the full pipeline: parse -> apply dietary profile -> resolve retailer -> build
Instacart link -> persist. Body:

```json
{
  "household_id": "uuid (optional if single membership)",
  "request_text": "go buy organic bananas, blueberries, and grass-fed beef",
  "line_items": [ { "name": "bananas", "quantity": 2, "unit": "lb" } ],
  "retailer_key": "optional override"
}
```

Exactly one of `request_text` / `line_items` is required. Returns `201`:

```json
{
  "cart_id": "uuid",
  "request_id": "uuid",
  "instacart_url": "https://customers.dev.instacart.tools/store/shopping_lists/...",
  "retailer": { "retailer_key": "kroger", "name": "Kroger", "retailer_logo_url": "..." },
  "resolved_line_items": [
    {
      "name": "bananas",
      "quantity": null,
      "unit": null,
      "display_text": "Organic Bananas",
      "source": "direct_request",
      "applied_filters": { "health_filters": ["ORGANIC"], "brand_filters": [] },
      "warnings": []
    }
  ],
  "notes": [
    "Applied your household preference: set bananas, blueberries, beef to organic.",
    "No preferred retailer set; using Kroger (nearest match). You can change this in settings."
  ]
}
```

The client should show `notes` and the applied filters, then present the
`instacart_url` as the one-tap checkout link. Checkout always completes on
Instacart by the human (PRD section 3).

### GET /api/v1/carts?household_id=uuid&limit=20
Household carts feed, newest first:

```json
{
  "carts": [
    {
      "id": "uuid",
      "title": "Groceries Jul 4",
      "instacart_url": "https://...",
      "retailer_key": "kroger",
      "status": "created",
      "request_text": "go buy organic bananas...",
      "created_by_user_id": "uuid",
      "created_at": "..."
    }
  ]
}
```

### GET /api/v1/carts/:id
Cart plus its line items (same resolved shape as POST response) plus `offers`
(see below).

### POST /api/v1/carts/:id/opened
Marks the cart `opened` (best-effort local status; Instacart does not report order
state back — PRD section 7). Returns the cart.

## Fulfillment offers (parallel rails + price comparison)

Every cart carries one offer per enabled fulfillment service
(`FULFILLMENT_PROVIDERS` csv on the server; csv order = display order).
Honesty contract: `subtotal_cents` is present only when the service's API
returned real per-store shelf prices for matched items — it is an **items
subtotal**, never a checkout total, and services without a price API are
`unpriced` (no numbers are ever estimated). Checkout is always completed by a
human on the service.

Offer shape (embedded in POST/GET cart responses and the refresh endpoint):

```json
{
  "id": "uuid",
  "provider": "kroger",
  "display_name": "Kroger",
  "capabilities": { "quote": true, "handoff": "account_cart_push" },
  "status": "quoted | pending | unpriced | failed",
  "handoff_url": "https://... | null",
  "store": { "provider_store_id": "01400943", "name": "Kroger - ...", "chain": "KROGER" },
  "subtotal_cents": 4832,
  "promo_savings_cents": 315,
  "currency": "USD",
  "matched_count": 9,
  "total_count": 11,
  "item_matches": [
    {
      "line_item_id": "uuid | null",
      "requested_name": "bananas",
      "requested_quantity": 2,
      "requested_unit": "lb",
      "status": "matched | no_match | unpriced",
      "confidence": "high | medium | low | null",
      "product": { "product_id": "...", "upc": "...", "description": "Bananas", "size": "1 lb", "sold_by": "WEIGHT" },
      "quantity": 1,
      "unit_price_cents": 62,
      "regular_price_cents": 62,
      "promo_price_cents": null,
      "line_total_cents": 62,
      "promo_savings_cents": 0,
      "measure_quantity": 1,
      "measure_unit": "lb",
      "warnings": ["Sized by weight/volume — confirm the size (1 lb) on Kroger."]
    }
  ],
  "notes": [],
  "quoted_at": "ISO | null",
  "expires_at": "ISO | null"
}
```

### POST /api/v1/carts/:id/offers/refresh
Runs real quotes for the quote-capable services (Kroger). Body (optional):
`{ "providers": ["kroger"], "force": false }`. Quotes fresher than 5 minutes
are returned as-is unless `force`. Providers fail independently (a failed
quote is `status: "failed"` with a note — the other offers are untouched).
Returns `{ "offers": [...], "connections": { "kroger": true } }`.

### POST /api/v1/carts/:id/handoff/kroger
Pushes the quoted matches into the linked user's real Kroger basket
(`PUT /v1/cart/add`, modality PICKUP) and returns where to finish:

```json
{
  "handoff_url": "https://www.kroger.com/cart",
  "pushed_count": 9,
  "skipped": [{ "line_item_id": "uuid", "name": "saffron", "reason": "no_match | unpriced | no_upc" }],
  "notes": ["Review and pay on Kroger — MC Peels never handles payment."]
}
```

Errors: `409 conflict` (no quoted Kroger offer yet), `409 not_connected`
(no linked Kroger account — start the connect flow), `502 upstream_error`.

## Provider connections (linked accounts)

Tokens are AES-256-GCM encrypted at rest and never serialized to clients.

### GET /api/v1/connections
`{ "connections": [{ "provider": "kroger", "connected_at": "ISO" }] }`

### DELETE /api/v1/connections/:provider
Unlinks. 204, or 404 when nothing was linked.

### GET /api/v1/connect/kroger/start?return_to=<url>
Bearer-authed. Validates `return_to` (mcpeels:// and localhost always allowed;
otherwise `CONNECT_RETURN_ORIGINS`) and returns `{ "authorize_url": "..." }`
for the client to navigate to (scope `cart.basic:write` only). State is a
10-minute JWT bound to the calling user.

### GET /api/v1/connect/kroger/callback?code&state
Unauthenticated (browser redirect from Kroger). Verifies state, exchanges the
code, stores the encrypted grant, and 302s to
`<return_to>?kroger=connected` (or `?kroger=error&reason=...`).

## Recipes (the shelf)

### POST /api/v1/recipes
Ingests a recipe from a link: resolve the source (TikTok/YouTube oEmbed,
Pinterest pin -> blog hop, schema.org/Recipe JSON-LD, OG/text fallback) ->
one Anthropic extraction pass -> saved recipe with Instacart-ready
ingredients. Deduped per household on the normalized source URL. Body:

```json
{
  "household_id": "uuid (optional if single membership)",
  "url": "https://www.tiktok.com/@creator/video/123..."
}
```

Returns `201` (or `200` with `already_saved: true` when the link is already
on the shelf):

```json
{
  "already_saved": false,
  "recipe": {
    "id": "uuid",
    "household_id": "uuid",
    "source_url": "https://www.tiktok.com/@creator/video/123",
    "source_platform": "tiktok",
    "creator": "@creator",
    "title": "Chongqing chicken",
    "sub": "辣子鸡",
    "description": "Crisp chicken buried in toasted chiles.",
    "cuisine": "sichuan-chongqing",
    "dish_type": "main",
    "serves": 4,
    "minutes": 45,
    "heat": 3,
    "ingredients": [
      { "name": "boneless chicken thighs", "quantity": 1.5, "unit": "lb", "pantry": false },
      { "name": "dried red chiles", "quantity": 4, "unit": "oz", "pantry": false },
      { "name": "sichuan peppercorns", "quantity": null, "unit": null, "pantry": true }
    ],
    "steps": ["Cube and marinate the chicken.", "..."],
    "provenance": "transcribed",
    "confidence": "high",
    "notes": ["Serves was not stated; assumed 4."],
    "created_at": "2026-07-12T00:00:00.000Z"
  }
}
```

`provenance` is honesty, not decoration: `transcribed` means the source
contained the actual recipe; `reconstructed` means the dish was rebuilt from
its name and hints (common for Instagram, which hides captions from
signed-out readers) — the client must say so. `422 validation_error` when the
link isn't food content; `502 upstream_error` when the source/AI pass fails.

### GET /api/v1/recipes?household_id=uuid&limit=100
The household shelf, newest first, plus cuisine clustering counts (the
kitchen-genesis meter):

```json
{
  "recipes": [ { "...": "same shape as above" } ],
  "cuisine_counts": [ { "cuisine": "italian", "count": 5 } ]
}
```

### DELETE /api/v1/recipes/:id
Removes a recipe from the shelf. `204` on success.

### GET /api/v1/recipes/starters
The starter catalog — onboarding's curated first stock (~30 dishes across six
cuisines, ingredients already cartable). Returns `{ "starters": [ ... ] }` in
the recipe shape minus household fields.

### POST /api/v1/recipes/starters
Seeds picked starters onto the household shelf as real recipes
(`source_platform: "starter"`, deduped on `mcpeels://starter/<id>` so
re-picks are harmless). Body:

```json
{ "household_id": "uuid (optional if single membership)", "starter_ids": ["xiaomian", "laziji", "mapo-tofu"] }
```

Returns `201` (`200` when everything was already on the shelf) with
`{ "recipes": [ ... ], "already_saved": 0 }`. Genesis note: a cuisine holding
starter picks opens its kitchen at 3 saves (the onboarding gift); organic
cuisines open at 4 (earned).

## MCP access tokens

Personal access tokens let MCP clients (e.g. Chief of Staff) act as the user.

### POST /api/v1/tokens
Body: `{ "name": "Chief of Staff" }`. Returns `201` `{ "id": "uuid", "name": "...", "token": "mcp_..." }`.
The plaintext token is returned exactly once.

### GET /api/v1/tokens
`{ "tokens": [ { "id": "uuid", "name": "...", "last_used_at": null, "created_at": "..." } ] }`

### DELETE /api/v1/tokens/:id
Returns `204`.

## MCP server

Mounted at `POST /mcp` (Streamable HTTP transport) with `Authorization: Bearer <mcp_... token>`.
Tools (PRD section 11): `mcpeels_create_cart`, `mcpeels_list_retailers`, `mcpeels_get_cart`,
`mcpeels_list_recent_carts`, `mcpeels_get_household`.

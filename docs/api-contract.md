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
Cart plus its line items (same resolved shape as POST response).

### POST /api/v1/carts/:id/opened
Marks the cart `opened` (best-effort local status; Instacart does not report order
state back — PRD section 7). Returns the cart.

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

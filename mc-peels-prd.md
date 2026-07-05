# MC Peels — Product Requirements Document

**Status:** v1 draft for build
**Owner:** Teej
**Audience:** Claude Code (MC Peels repo/session)
**Companion doc:** `third-brain-mcpeels-integration.md` (build that in the Third Brain repo, not this one)

---

## 1. One-liner

MC Peels is a standalone, multi-tenant food-and-grocery service. A household member says what they want in plain language — "go buy organic bananas, blueberries, and grass-fed beef" — and MC Peels turns that into an Instacart cart at their preferred store, pre-filtered to the household's dietary rules, and hands back a one-tap checkout link. It ships as a consumer app (iOS / Android / web) **and** as an MCP server that Third Brain's Chief of Staff can call.

---

## 2. Vision and framing

Most grocery tooling makes you do the translation work: you know you want clean food, but you still hunt through listings applying "organic" filters item by item. MC Peels moves that translation into software. The household's dietary identity (organic-preferring, specific sensitivities, brands they trust) becomes a reusable profile that gets applied automatically to every request.

Two framing decisions shape the whole product:

**It is multi-tenant from day one.** We are not building a personal script for one family. Households, members, and per-household dietary profiles are first-class. Teej's family is simply household #1. The strict-sensitivities profile is a *feature* — a learnable, reusable household diet profile — not hardcoded rules.

**It is standalone-usable, and Third Brain is one client among others.** Anyone who has never heard of Third Brain can install MC Peels and use it. Chief of Staff is a second front door onto the same core, via MCP. The litmus test for where any piece of logic belongs: *would a standalone MC Peels user need this?* If yes, it lives in MC Peels. Nothing about food or groceries lives in Third Brain.

---

## 3. The hard constraint (read before designing anything)

The Instacart **Developer Platform API** is a *cart-assembly* API, not a *checkout* API.

The flow it supports: your app builds a shopping-list (or recipe) page from line items → the API returns an Instacart URL → a human opens that URL, selects a store, reviews the cart, and checks out **on Instacart** using **their own Instacart account and payment method**. There is no endpoint that places an order or charges a card programmatically. Fully hands-off "the app buys the groceries and pays" is **out of scope** and not available through this API. (Programmatic fulfillment lives in Instacart's enterprise *Connect* partnership APIs, which we have explicitly decided **not** to pursue.)

Consequences that ripple through the whole PRD:

- **Human-in-the-loop checkout is mandatory and permanent** for purchases. MC Peels' job ends at "here is a ready-to-checkout link."
- **Buyer of record = whoever is signed into Instacart on the device that opens the link and completes checkout.** MC Peels never sees, stores, or handles anyone's Instacart credentials or card. MC Peels authenticates to Instacart with a **single server-side partner API key**, used only to build link pages.
- Instacart handles all post-checkout notifications (order confirmation, delivery updates). MC Peels does **not** rebuild any of that.

Docs: https://docs.instacart.com/developer_platform_api/ — **verify exact request/response schemas against the live docs during build; treat schema sketches in this PRD as directional, not authoritative.**

---

## 4. Goals and non-goals

### v1 goals
- Turn a natural-language grocery request into a correct Instacart shopping-list link.
- Apply a household dietary profile to that request automatically (e.g. auto-prefer organic / grass-fed; respect exclusions).
- Support multiple households, each with its own members, dietary profile, and preferred retailers.
- Deliver the finished checkout link to the person who made the request.
- Expose the same capability two ways: a REST/RPC API for the app, and an MCP server for Chief of Staff.

### v1 non-goals (deliberately deferred — see §12)
- Recipes and meal planning.
- Pantry / inventory tracking.
- Budgets and spend tracking (this will integrate with a separate family-finance tool later — see §13).
- Retailer *discovery*/suggestions (household sets preferred retailers manually in v1).
- Autonomous purchasing without human review.
- Any programmatic checkout or payment.

---

## 5. Users and tenancy

- **User** — an authenticated individual (Supabase Auth).
- **Household** — the shared unit. Owns the dietary profile and preferred retailers. Has a postal code / country for retailer lookup.
- **Membership** — links a user to a household with a role (`owner` | `member`). Any member can trigger a request. The resulting cart is visible to the household; the checkout link is delivered to the **requester** (the person ordering).

A user can belong to more than one household (edge case, but the model should allow it; default to a single active household).

---

## 6. v1 scope — the direct-shopping flow

This is the MVP. Everything else rides on top of this pipeline later.

1. **Request.** A member submits free text via the app, or Chief of Staff submits it via MCP. Example: *"go buy organic bananas, organic blueberries, and lean grass-fed organic beef."*
2. **Parse.** Anthropic API turns the text into structured line items: name, quantity (if stated), unit (if stated). Quantities are **user-determined** — never assume a family size or default pack count. If quantity is omitted, pass it through without inventing one (let Instacart / the human resolve at checkout).
3. **Apply dietary profile.** For each line item, inject the household's filters (see §8). E.g. a household that prefers organic gets an organic health-filter added to produce and meat lines automatically, even for items where the user didn't say "organic."
4. **Resolve retailer.** Use the household's preferred retailer if set; otherwise look up nearby retailers by postal code and pick a sensible default (surface the choice back to the caller).
5. **Build the cart.** Call Instacart's shopping-list / products-link endpoint with the resolved line items and filters. Receive the Instacart checkout URL.
6. **Persist.** Store the request, line items (with `source` tag — see §7), and the cart + URL.
7. **Hand off.** Return to the caller: the checkout URL, the resolved line items (so the caller can tell the user *what filters were applied* — "I set these to organic"), and the chosen retailer. Deliver the link to the requester (in-app carts feed + returned to Chief of Staff's thread when the request came via MCP).

---

## 7. Domain model — the line-item design

The central object is the **line item**, and it carries a **`source`** tag from day one even though v1 only ever produces one source (`direct_request`).

Why this matters: it's the forward-compatibility hook for the "why not both?" meal-plan question. In phase 2, recipes and meal plans produce line items tagged `recipe:<id>`. A cart-builder step can then **group** line items at link-generation time — per recipe, per day, or whole-week **consolidated** (deduplicating shared staples: three recipes needing garlic collapse into one garlic line at summed quantity). Same items, selectable grouping. We get per-recipe carts *and* consolidated carts from one model. **v1 does not build the grouping UI — it just guarantees every line item is tagged so phase 2 is free to switch on.**

Core entities:

- **household** — `id`, `name`, `preferred_retailer_key` (nullable), `postal_code`, `country_code`, `created_by`, timestamps.
- **household_member** — `id`, `household_id`, `user_id`, `role`, timestamps.
- **dietary_profile** — `id`, `household_id`, structured rules (see §8), free-text notes, timestamps.
- **request** — `id`, `household_id`, `requested_by_user_id`, `raw_text`, `channel` (`app` | `mcp`), timestamps.
- **line_item** — `id`, `request_id`, `household_id`, `cart_id` (nullable until assigned), **`source`** (`direct_request` in v1), `name`, `quantity` (nullable), `unit` (nullable), `applied_filters` (jsonb), `resolved_display_text`, timestamps.
- **cart** — `id`, `household_id`, `request_id`, `retailer_key`, `instacart_url`, `status` (`created` | `opened` | `expired`), `created_by_user_id`, timestamps.

Notes:
- No table stores anyone's Instacart credentials — by design (§3).
- `cart.status` is best-effort; the API gives us a link, not order state, so `opened`/`expired` are inferred locally, not authoritative.

---

## 8. Dietary profile → Instacart filter mapping

Instacart line items accept **filters**, including **brand filters** and **health filters** (e.g. organic). The dietary profile is where we store the household's standing preferences and translate them into those filters at build time.

Suggested profile shape (structured, so it's queryable and learnable — not just free text):
- `prefer_organic` (bool) → inject the organic health filter on eligible categories.
- `preferred_brands` (string[]) → brand filters.
- `excluded_ingredients` / `allergens` (string[]) → used to exclude/avoid at parse and selection time, and surfaced as warnings.
- `health_filters` (string[]) → any additional Instacart-supported health filters the household wants applied globally.
- `notes` (free text) → captured for the parser and for future learning.

**Important honesty about allergens (call this out in the app UI too):** Instacart health filters are *preference signals for item selection*, not hard guarantees. They do not certify a product is free of an allergen. For a household with real sensitivities, MC Peels should (a) apply the best-available filters, (b) prefer exclusion at the parse/selection step, and (c) treat the human's review at checkout as the final safety gate. **Do not imply MC Peels guarantees allergen safety.** This is both a correctness and a trust requirement.

**Learnability (design for it, implement lightly in v1):** the profile should be editable and structured so that Chief of Staff (and later MC Peels itself) can *adopt* and refine it over time — e.g. noticing a household always upgrades a line to organic and folding that into the profile. v1 ships manual editing; the schema should make later learning cheap.

---

## 9. Architecture

**Client:** Expo (React Native) — single codebase targeting iOS, Android, and web. Chosen for cross-platform uniformity and to enable App Store publishing (a stated goal). Teej has prior RN experience.

**Backend:** standalone TypeScript service (Node), deployed on Vercel. Owns MC Peels' database and all food/grocery logic. Two front doors over one core:
1. A REST/RPC API consumed by the Expo app.
2. An **MCP server** consumed by Chief of Staff (Third Brain) and any future agent client.

**Database:** **Supabase** (Postgres) with **Drizzle ORM**. Supabase is also the **auth** provider. One new database for this new service — *not* a migration of anything. (Note: Third Brain stays on its own Neon database and Auth.js, completely untouched — see the companion integration doc.)

**NL parsing / intelligence:** Anthropic API. Parses requests into line items and applies the dietary profile. This intelligence lives **in MC Peels**, precisely because the standalone consumer app needs the same smarts without Chief of Staff involved.

**Instacart wrapper:** a server-side module holding the single partner API key, exposing internal functions for retailer lookup and shopping-list-page creation. Nothing outside MC Peels ever calls Instacart.

```
                    ┌─────────────────────────────────────────┐
                    │              MC Peels backend            │
  Expo app  ──REST──▶  ┌─────────────┐   ┌──────────────────┐ │
                    │  │  NL parse +  │   │ Instacart wrapper│ │──▶ Instacart
  Chief of   ─MCP──▶  │  dietary     │   │ (partner API key)│ │    Dev Platform API
  Staff             │  │  profile     │   └──────────────────┘ │    (returns checkout URL)
                    │  └─────────────┘   ┌──────────────────┐ │
                    │                     │ Supabase/Postgres│ │
                    │                     │  (Drizzle)       │ │
                    │                     └──────────────────┘ │
                    └─────────────────────────────────────────┘
```

---

## 10. Instacart integration details

Endpoints you will use (confirm exact paths/fields at the docs URL in §3):

- **Nearby retailers** — look up retailers by postal code + country code; returns retailer identifiers (retailer key), display name, logo. Used to populate preferred-retailer selection and to resolve a default when none is set.
- **Shopping-list / products-link page** — POST line items (name, quantity, unit, and per-item **filters** including brand and health/organic filters); returns the Instacart URL that the human opens to check out.
- **Recipe page** — deferred to phase 2 (recipes), but it's the same family of API.

Integration rules:
- One partner API key, server-side only, never exposed to the client or to Third Brain.
- The returned URL is the deliverable. Persist it on the `cart`.
- Handle and surface API errors gracefully (e.g. an item that can't be resolved) — return partial success with a clear note rather than failing the whole cart.

---

## 11. MCP server surface

The MCP server is how Chief of Staff (and future agents) drive MC Peels. Keep the surface tight. The household is resolved from the authenticated user's linked account (see integration doc); the dietary profile is applied **server-side automatically** — the agent does not pass or manage filters.

Proposed tools:

- **`mcpeels_create_cart`** — input: `{ request_text }` *or* `{ line_items[] }`, optional `retailer_key`. Resolves the caller's household, parses, applies the dietary profile, builds the cart. Returns `{ cart_id, instacart_url, resolved_line_items[], retailer, notes[] }`. `resolved_line_items` lets Chief of Staff tell the user exactly what was applied ("set bananas, blueberries, and beef to organic").
- **`mcpeels_list_retailers`** — input: `{ postal_code? }` (defaults to household). Returns nearby retailers.
- **`mcpeels_get_cart`** — input: `{ cart_id }`. Returns cart details + URL + status.
- **`mcpeels_list_recent_carts`** — returns the household's recent carts.
- **`mcpeels_get_household`** — read-only: returns the household's dietary profile summary + preferred retailers, so the agent has context to explain its behavior.

Purchases are never autonomous: MCP tools build and return links; a human always completes checkout on Instacart.

---

## 12. Phasing

**Phase 1 — v1 (this build).** Direct-shopping flow (§6). Multi-tenant households + memberships. Dietary profiles with Instacart filter mapping. Preferred retailers (manual). Expo app (ask screen, household setup, dietary-profile editor, carts feed, order history). Supabase Auth. REST API + MCP server. Human-in-the-loop checkout.

**Phase 2 — recipes, meal plans, pantry, retailer suggestions.**
- Recipes via Instacart's Recipe API; recipe "concoction" (LLM-generated + saved/reusable recipes).
- Meal plans producing `recipe:<id>`-tagged line items, with the cart-builder grouping step that delivers **both** per-recipe carts and consolidated/deduplicated weekly carts (§7).
- Pantry / inventory tracking so staples aren't re-bought.
- **Ranger → suggested retailers**: Ranger (Third Brain) watches for new/better nearby stores and surfaces them.
- Family-size / serving scaling helpers (still user-overridable).

**Phase 3 — autonomy.**
- More autonomy for Chief of Staff / Third Brain in *assembling* and *proposing*, while **human-in-the-loop remains paramount for purchases**. Explore how much of the plan-and-build step can run unattended before the human checkout gate.

---

## 13. Parking lot (captured ideas — credit Teej)

- **"Soviet-comfort mode"** *(Teej's idea)* — a cuisine/personality preset for the recipe engine (phase 2+): the meal generator leans into Soviet/Central-Asian comfort food. Flagged as a genuine differentiator. Do not lose this.
- **Family-finance tool integration** — Teej's sister-in-law's family-finance project becomes a **sibling tool** in the ecosystem. Budgets and spend tracking live *there*, not reinvented in MC Peels. Design MC Peels so a future budget tool can sit alongside it (multiple tools in the mix), rather than baking finance in.
- **Instacart playground** — MC Peels owning Instacart access opens room for other Instacart-powered ideas beyond groceries; keep the wrapper general enough to extend.
- **Branding (deferred)** — "MC Peels" is **not** locked (candidates: MC Peaches, MC Pears). Icon idea: a peach wearing sunglasses. Revisit branding after v1; keep the internal package name easy to rename.

---

## 14. Risks and open questions

- **Allergen safety framing (highest-trust risk).** Filters are preferences, not guarantees. UI copy and agent responses must never over-promise safety for a household with real sensitivities (§8).
- **Cart status is best-effort.** The API returns a link, not order state; don't build features that assume authoritative order tracking.
- **Retailer/item resolution failures.** Some items or retailers won't resolve cleanly; define graceful partial-success behavior.
- **Instacart schema drift.** Confirm live schemas during build; don't hardcode against this PRD's sketches.
- **Multi-household edge cases.** Default to a single active household; make sure MCP calls resolve the *right* household unambiguously.

---

## 15. v1 success criteria

- A new user can sign up, create a household, set a dietary profile and a preferred retailer, and submit "buy organic bananas, blueberries, grass-fed beef."
- MC Peels returns an Instacart checkout link at the preferred retailer, with organic/grass-fed filters applied automatically, and shows what it applied.
- The same request works via the MCP server, and Chief of Staff can deliver the resulting link back to the requester.
- No Instacart credentials are ever handled by MC Peels; checkout completes on Instacart by the logged-in human.
- Third Brain required zero database migration to integrate.

# MC Peels — design implementation plan

**Date:** 2026-07-20
**Sources:** [design-review.md](./design-review.md) (what/why) · [design-technical-notes.md](./design-technical-notes.md) (how)
**Status:** in progress — this file is the working state. Update checkboxes as work lands.

**Worktree:** this work lives in an isolated worktree at
`/Users/tjshaffer/Documents/mc-peels-design` on `fix/design-defects`, because a second
session shares the primary checkout and branch-switches under it. Preview server is
`design-worktree` on port 8095. Do not work on this in the primary checkout.

Decisions taken 2026-07-20, before any code:

- **Canvas (§6):** rebalance. Bold blue is reserved for heroes, Ask, and cart detail;
  lists and forms move to a light canvas. Not the cheap darken-to-`#1668C4` fix.
- **Gemini (§1):** the key is already live in production and generating images via
  plain REST (`apps/api/src/art/gemini.ts`) — verified against the DB, 3 heroes +
  26 tiles at status `ok`. Phase 5 adds a **text** `generateContent` call reusing that
  key and that pattern. No SDK, no new secret, no provider abstraction.

---

## Working agreements

- **One branch per phase**, in order. Each must be independently revertible.
- **Never `db:migrate`** — the drizzle journal is stale. Apply migrations via the
  Supabase MCP (project `bltrwuailnxhefyefzyk`).
- **Typecheck + tests before every commit.** `npm run typecheck` in both workspaces,
  `npm test` in `apps/api`.
- **Screenshot both breakpoints** (375px, 1280px) in light and dark for anything
  touching layout. Phase 4 gets every route.
- **No emoji anywhere** — product copy or image prompts. Typographic glyphs only.
- Verification is browser-based via the preview tools, not "looks right to me."

---

## Phase 1 — `fix/design-defects` — COMPLETE

Mechanical. No design debate. Covers review §5 defects 1–4 and 7–9.

- [x] **Legibility fallback** — the defect was at `HomeScreen.tsx` L380–392 (not
      ~356–362): `ShelfStorefront`'s generic front drew `tokens.onHero` on
      `tokens.canvas`. `generatedCostume` flips `onHero` to near-white when a hero
      photo exists and spreads that into the SHARED token set, so any non-hero
      surface got white text — on an L96 canvas, cream on cream. Fixed by using
      `ink`/`inkSoft` there. Reproduced and verified in the browser both ways.
- [x] **Global bottom inset** — `lib/use-scroll-bottom-inset.ts`, applied to the 7
      containers that sit under the tab bar. Two corrections to the prescription:
      `@react-navigation/bottom-tabs` is NOT resolvable (expo-router v57 vendors it —
      use `expo-router/tabs`), and `getTabBarHeight()` ALREADY includes
      `insets.bottom`, so the documented `navHeight + insets.bottom + 24`
      double-counts the home indicator (~34px).
- [x] **Organic toggle** — shipped as a shared `Toggle` primitive in `components/ui.tsx`
      rather than patching RN `Switch`'s per-platform prop matrix. Root cause was
      `trackColor={{ true: p.tint }}` — only the ON track, no `false`, no `thumbColor`,
      no `ios_backgroundColor`. Verified both states, both modes, plus disabled.
- [x] **Mascot collision** — `MascotMark`'s `size` is its WIDTH; height is
      `size / (613/720)`, so the size-64 mark is ~75pt tall, not 64. At `top:-36`
      it reached y=+39, past the sheet's `paddingTop: 22`, landing on
      OffersSection's right-aligned "Refresh prices". Moved to `top:-60`. Kept the
      mascot — review §7 says it has equity, it just has to stop landing on text.
- [x] **Dedupe retailer chips** by `retailer_key` at ingestion. (§5 #7)
- [x] **Hero title wrap** — `FeatureHero`'s `heroDish` already had
      `numberOfLines={2}` plus a font step-down on main. The real truncation was
      `ShelfStorefront`'s `frontTitleHeavy` at `numberOfLines={1}`; now 2. (§5 #8)
- [x] **Cap "Your usuals"** at 5 (`USUALS_VISIBLE`) with an expanding
      "N more" / "Show fewer" chip. (§5 #9)
- [x] Touch targets: `Chip` now `minHeight: 44` (was ~33 from paddingVertical 7). (§6)

## Phase 2 — `feat/cart-naming`

Cheapest big win. §5 #5, #10, #12.

- [ ] Promote `request_text` to the cart title in `app/cart/[id].tsx` and `(tabs)/ask.tsx`.
- [ ] Drop the redundant status chip beside the "Ready" pill.
- [ ] Drop the duplicated date from the meta row.
- [ ] Suppress the Kroger Connect CTA when no store is found near the postal code. (§5 #11)
- [ ] Disabled "Build my cart" — keep enabled and validate on press, or use an
      outlined waiting state. Never 55% opacity on `#4FA4F2`. (§5 #6)

## Phase 3 — `feat/theme-toggle`

Also hardens the web stale-repaint bug, since the change propagates through React
state rather than a `matchMedia` subscription.

- [ ] `ThemeProvider` in `lib/theme.tsx` holding `'system' | 'light' | 'dark'`.
- [ ] Persist to `AsyncStorage`; hydrate before first paint (no wrong-theme flash).
- [ ] `usePalette()` reads context, falls back to `useColorScheme()` only on `'system'`.
      **Signature unchanged** — that's what keeps ~15 call sites untouched.
- [ ] Mount provider in `app/_layout.tsx` above the auth gate.
- [ ] Household: three-way segmented control (System / Light / Dark), System default.
- [ ] Drive `expo-status-bar` and root `backgroundColor` from the same value.
- [ ] Verify the web repaint bug is actually gone at both breakpoints.

## Phase 4 — `feat/responsive-nav`

Largest blast radius. Screenshot every route at both breakpoints before merge.

Note: main has exactly the **three** destinations §2 describes — Kitchens (`index`),
New cart (`ask`), Household. `carts` was folded into `ask` by `6156b76`; confirmed
with TJ that this is the intended shape.

- [ ] Single `<AppNav variant="bottom" | "header" />` via custom `tabBar` prop.
- [ ] Breakpoint 768px via `useWindowDimensions()` — never `Dimensions.get()` once.
- [ ] Desktop header carries wordmark + account affordance a tab bar can't.
- [ ] Kill the stack header on tab roots (`household.tsx` currently has one).
- [ ] Detail routes keep a minimal back header **and** keep bottom nav visible on mobile.
- [ ] Full-screen flows stay chrome-free — already correct, just don't regress them.
- [ ] Back affordance: same position, same size, everywhere.

## Phase 5 — `feat/token-consolidation`

Review §3 + §6. Pulled ahead of Gemini: the legibility gate depends on these tokens
being coherent.

- [ ] **Split `primary` from `tint` in dark** — both `#4FA4F2` today, so the system
      can't distinguish an action from an accent.
- [ ] **Dark values for saturated fills** — accent `#FFC531` hits 11.6:1 as a
      full-width dark fill. Add ~`#E0A020` (~8:1). Same for the Eats reds.
- [ ] **Widen dark elevation steps** — `#0B1626` → `#13233A` → nested rows are too close.
- [ ] **One primary button.** Accent yellow reserved for terminal retailer hand-off.
      Alternates outlined, never a second equal-weight fill.
- [ ] **Three chips:** `eyebrow`, `selectable`, `status`. Map the other five in.
- [ ] **One title primitive** — keep `DisplayTitle` or `TwoToneTitle`, delete the other.
- [ ] **Uppercase discipline** — eyebrows and section labels only; form labels sentence case.

## Phase 6 — `feat/gemini-design`

- [ ] Add a Gemini **text** path beside `art/gemini.ts` — same REST-via-fetch pattern,
      same `GEMINI_API_KEY`, no SDK. New `GEMINI_TEXT_MODEL` env with a default.
- [ ] Widen the identity seed to a **design seed**: `surface`, `ornament`, `typeVoice`,
      `density`, `heroTreatment`. Bounded enums only — every value maps to code we own.
      All optional with safe defaults so a malformed field degrades to today's look.
- [ ] **`assertLegible(seed)`** pure function — derive every text/surface pair, require
      ≥4.5:1 (≥3:1 large). On failure, fall back to the house palette and log the
      offending pair. Run at mint time server-side, assert again client-side.
- [ ] **Caching:** `design_seed` jsonb, `design_version` int, `design_model` text,
      `minted_at` timestamptz on `kitchen_identities`. Mint idempotent — existing seed
      at current version means **zero** API calls. Unique constraint on
      `(household_id, cuisine)` so concurrent mints can't double-charge.
- [ ] Migration via **Supabase MCP**, not drizzle.
- [ ] Client memoizes `paletteFromSeed(seed)` keyed on `seed + colorScheme`.
- [ ] `expo-image`: explicit `cachePolicy` + stable `recyclingKey` per kitchen.
- [ ] Cost guardrails: per-household daily mint cap, log cuisine + token count,
      one call returning identity **and** design seed.
- [ ] Invalidation only on: version bump, material cuisine change, manual debug regen.

## Phase 7 — `feat/canvas-rebalance`

Confirmed direction. Largest visual change — last, reviewed side by side.

- [ ] Lists and settings move to a light canvas.
- [ ] Full-bleed blue reserved for heroes, Ask, and cart detail.
- [ ] Re-verify contrast everywhere the canvas changed.
- [ ] Extend the hero scrim — the eyebrow currently sits over a bright patch of image.

---

## Parked

`feat/sticker-reactions` awaits pose art and touches cart detail. Rebase it after
phases 2 and 4 land.

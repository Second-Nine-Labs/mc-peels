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

## Phase 2 — `feat/cart-naming` — COMPLETE

Cheapest big win. §5 #5, #10, #12.

- [x] **Promote `request_text` to the cart title** in `cart/[id].tsx` and `(tabs)/ask.tsx`.
      Done client-side by flipping precedence, NOT by changing the API: the stored
      `title` ("MC Peels · <date>") is also the Instacart products-link page title,
      where the branding is correct. Flipping it in the client also fixes every
      existing cart retroactively, with no migration.
- [x] **Drop the redundant status chip** — the eyebrow read "Ready to check out"
      unconditionally, which was both duplicative of `StatusChip` and wrong for any
      cart not actually ready. (§5 #10)
- [x] **Duplicated date** resolved by the title swap — the date now appears only in
      the meta row. (§5 #12)
- [x] **Suppress the Kroger Connect CTA** when the offer failed AND has no store —
      there is nothing to connect an account to. (§5 #11)
- [x] **Disabled "Build my cart"** — button stays enabled and validates on press,
      with the empty-input nudge clearing as soon as they type. (§5 #6)
- [x] `DisplayTitle` gained an optional `numberOfLines`; cart detail steps the size
      down (30/26/22) and clamps to 3 lines, since request text has no length
      ceiling. Verified at 31, 38, and 87 characters.

## Phase 3 — `feat/theme-toggle` — COMPLETE

Also hardens the web stale-repaint bug, since the change propagates through React
state rather than a `matchMedia` subscription.

- [x] `ThemeProvider` in `lib/theme.tsx` holding `'system' | 'light' | 'dark'`.
- [x] Persist to `AsyncStorage`; children withheld until hydrated, so a Light user
      never sees a dark frame first. Verified: key `mcpeels.theme-mode` = `light`
      survived a full reload with the OS still dark, no flash.
- [x] `usePalette()` reads context, falls back to `useColorScheme()` only on
      `'system'` — and also when rendered outside the provider, so isolated
      previews/tests get real colors instead of throwing. **Signature unchanged**,
      which is what kept all 19 call sites untouched.
- [x] Provider mounted in `app/_layout.tsx` above the auth gate, so even sign-in
      honours the stored preference on its first frame.
- [x] Household: three-way `Segmented` control (System / Light / Dark), System
      default, added as a shared primitive.
- [x] `expo-status-bar` driven from the resolved scheme rather than `"auto"` —
      `auto` reads the OS, so an explicit Light choice on a dark phone got
      light-on-light status text. Root background already flows from `p.background`.
- [x] Verified all three states at 375px and 1280px: Light held while the OS
      stayed dark, every surface flipped together (canvas, cards, chips, toggles,
      buttons) with no partial repaint, and System correctly returned to
      following the OS.

## Phase 4 — `feat/responsive-nav` — COMPLETE (kitchen deliberately left immersive)

Largest blast radius. Screenshot every route at both breakpoints before merge.

Note: main has exactly the **three** destinations §2 describes — Kitchens (`index`),
New cart (`ask`), Household. `carts` was folded into `ask` by `6156b76`; confirmed
with TJ that this is the intended shape.

- [x] Single `<AppNav variant="bottom" | "header" />` via custom `tabBar` prop.
- [x] Breakpoint 768px via `useWindowDimensions()` — verified re-laying out live on
      resize, no reload: header to bottom bar, inset 24 to 81, active tab preserved.
- [x] Desktop header carries wordmark + account affordance a tab bar can't.
- [x] Kill the stack header on tab roots — `headerShown: false` hoisted to
      `screenOptions`; Household was the lone exception.
- [x] Full-screen flows stay chrome-free — untouched, still outside `(tabs)`.
- [x] **Cart detail keeps the nav** (TJ decided cart-only; the kitchen stays
      immersive). `cart/[id]` moved inside `(tabs)` — a route group, so the URL
      is still `/cart/<id>` and all 4 existing links plus the Kroger OAuth
      return leg work unchanged. Declared `href: null`; AppNav honours the
      `tabBarItemStyle: {display: 'none'}` encoding expo-router uses for it
      (caught live: the route rendered as a fourth tab until then). The screen
      owns its back control — same place, same size, both load and error
      branches — falling back to `/(tabs)/ask` when there's no history.

### Phase 4 open question — detail routes inside the tabs

`cart/[id]` and `restaurant/[id]` live at the app root, *outside* `(tabs)`, so the
tab bar is not rendered over them. Keeping the nav visible there (review §2) means
moving them inside the group — `(tabs)` is a route group, so URLs are unaffected.

Two things make it more than a file move:

1. **Back affordance.** They currently get their back button from the root Stack's
   header. Inside a Tabs navigator there is no back button — the standard fix is a
   nested Stack per tab (e.g. `(tabs)/ask/_layout.tsx` wrapping `index` +
   `cart/[id]`), which is a real routing restructure, not a move.
2. **`restaurant/[id]` has a pinned order bar** (KitchenScreen Z4,
   `position: absolute; bottom: 0`). A tab bar at the bottom would sit on top of
   it. The order bar would have to lift by the nav height.

There is also a genuine design tension in the review itself: §2 says the nav is
"the one thing that never changes between the blue app and the Eats/Book worlds",
which argues for keeping it in the kitchen — but the kitchen is the most immersive
surface in the app, wearing a full generated costume.

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

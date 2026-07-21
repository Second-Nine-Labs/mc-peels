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

## Phase 5 — `feat/token-consolidation` — COMPLETE

Review §3 + §6. Pulled ahead of Gemini: the legibility gate depends on these tokens
being coherent.

- [x] **Split `primary` from `tint` in dark** — primary is now `#1D6FD1` with white
      text (4.95:1), a solid committed action fill; tint stays `#4FA4F2` for links,
      icons, selected states. Visibly different lightness classes (1.87:1 apart).
- [x] **Dark values for saturated fills** — accent `#E0A020` measures 8.28:1 on the
      new canvas (was 11.48:1), on-accent text 7.70:1. Shancheng's CTA fill drops
      from CHILE to LANTERN — its label was ALREADY sub-AA at 3.19:1 and improves
      to 3.97:1; clearing 4.5 properly belongs to the phase-6 legibility gate.
      All ratios computed, not eyeballed.
- [x] **Widen dark elevation steps** — canvas `#0A1120` → card `#152743` → chip
      `#1F3554`; canvas-to-card ratio widened 1.15 → 1.26, and muted text still
      clears 6:1 on every surface.
- [x] **One primary button.** Added an `outline` variant; in `offers.tsx` the
      preferred retailer (first in the household's display order) takes the accent
      fill and every alternate is outlined — no more two equal-weight fills.
- [x] **Three chips:** `eyebrow` (EyebrowChip), `selectable` (Chip), `status` — the
      last now ONE appearance via an internal `StatusBase`; `StatusChip` and
      `FilterTag` had drifted to different radii (999 vs 6) and padding. Eats chips
      (`malaChip`, KitchenScreen `chip`, `resultChip`) are costume-scoped and stay
      off the shared system per review §4.
- [x] **One title primitive** — `TwoToneTitle` deleted; it had zero call sites
      outside its own definition. `DisplayTitle` is used in 9 files.
- [x] **Uppercase discipline** — the shouting came from `textTransform` in styles,
      not the strings (every label was already sentence case in source). Removed
      from `fieldLabel` (x3 files), `heroStatLabel`, and cart `tagText`. Kept on
      `eyebrowChipText` and ask's `examplesLabel` — an eyebrow and a section label,
      which is exactly what §3c allows.

## Phase 6 — `feat/gemini-design`

- [x] **Gate wired into the mint** — `legiblePaletteOr()` in
      `core/kitchen-identities.ts`. A rejected seed keeps its generated name and
      voice (what the model is good at) and falls back to `HOUSE_SEED`, logging
      cuisine + the offending pair so a production rejection is diagnosable.
      Wiring it surfaced a hole in the gate itself: a NaN hue derived
      `"#NaNNaNNaN"`, whose contrast is NaN, and `NaN < 4.5` is false — so every
      pair "passed" and garbage would have reached a screen. The gate now
      validates seed shape before trusting arithmetic on it.

- [~] **DROPPED — the provider swap dissolves.** TJ's framing (2026-07-21): "leave
      design to Gemini" means **image generation**, not layout. Gemini already owns
      every image in the product via `art/gemini.ts` — hero art and dish tiles —
      so there is nothing to move. What the notes actually proposed migrating was
      the TEXT path: name, tagline, voice, palette seed. That is layout-and-
      structure work, it already runs on Anthropic, and it works. No swap.

      The valuable half of phase 6b is therefore the **widened seed**, not a new
      provider. Less work and less risk than the notes assumed.
- [ ] Widen the identity seed to a **design seed**. Bounded enums only, every value
      mapping to code we own, all optional with safe defaults so a malformed field
      degrades to today's look. The fields split along TJ's image/layout line:

      | Field | Really is | Generated by |
      |---|---|---|
      | `heroTreatment` (photo/duotone/flat) | drives the art prompt | Gemini — already does |
      | `surface` (paper/lacquer/linen/tile/slate) | layout | Anthropic |
      | `ornament` (none/rule/corner/motif) | layout | Anthropic |
      | `density` (airy/standard/tight) | spatial rhythm | Anthropic |
      | `typeVoice` (grotesk/serif/mono/condensed) | typography | Anthropic |

      **OPEN — `typeVoice` may not be buildable.** It is the only field implying an
      asset dependency: it needs bundled serif and condensed faces to map onto. If
      the app ships neither, the enum has nowhere to land and should shrink to the
      families actually available, or wait. Check `app.json` / expo-font before
      building it.
- [x] **`assertLegible(seed)`** in `apps/api/src/ai/legibility.ts` — pure, 10 tests.
      Checks `onHero` against the CANVAS, not a photo, because an absent or failed
      hero is exactly the case the shipped bug fell into.
      **It found real defects.** The engine claimed its accent on-color "flips to
      the side opposite the accent's own lightness" but hardcoded L98/L10 — worst
      measured 2.01:1, only 26% of hue pairs cleared AA, and 2 of the 3 live
      production kitchens failed. Fixing the on-color alone was insufficient (pure
      white/black still topped out at 4.45 for mid-luminance fills), so the accent
      fill now walks outward from its target lightness until its better on-color
      clears. **All 10,368 hue/mode combinations pass**, verified by test. Mirrored
      into `apps/mobile/features/eats/palette.ts`; ramp parity checked.
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

## Phase 6c — image direction (TJ's steer, 2026-07-21)

Lean photography; let illustration surface occasionally as a personality, with no
rules about how often or which cuisine. **The one hard constraint: medium is
consistent WITHIN a kitchen.** If a kitchen generates as illustration, every image
it owns is illustration. If photography, all photography.

### That constraint is currently unenforceable — and the code contradicts itself

`prompts.ts`'s own header states the style lock owns the medium "so the prompt
never forces 'photograph' onto an illustrated kitchen". Then:

- `heroArtPrompt()` hardcodes the word **"photograph"** into the scene string.
- It appends `heroStyle(mode)`, which takes the **palette mode**, not the style
  lock, and returns one of exactly two strings — both explicitly photography.
- `heroJudgeRubric` grades against that same photographic brief, so an
  illustrated hero is **failed and rerolled** as off-brief.

So a kitchen's hero cannot express any medium but photography, and the judge
actively enforces the mismatch. Столовая's tiles are Soviet-poster illustration;
its hero is forced photographic.

This is masked today only because every shelf-minted kitchen falls through to
`DEFAULT_LOCK` (dark photography), so hero and tiles agree by accident. It bites
the moment illustration becomes reachable.

### What to build

- [ ] **Make the hero take the style lock, not the palette mode.** Its medium and
      the tiles' medium must come from one source. Drop "photograph" from the
      scene string; let the lock lead, exactly as `dishArtPrompt` already does.
- [ ] **Judge against the kitchen's own lock**, so an illustrated hero passes for
      an illustrated kitchen.
- [ ] **Let the mint emit a bounded style lock** rather than falling through to
      one hardcoded default. Today `LOCKS` has six hand-written entries and every
      generated kitchen shares `DEFAULT_LOCK` — review §4's "hand-built costumes
      don't scale past the flagships", exactly as predicted.
- [ ] **Use the flagship locks as the quality bar.** `SOVIET_POSTER` works because
      it commits to a medium, names palette values as hexes, and asks for physical
      process artifacts ("slight misregistration and aged-paper grain"). It reads
      as a real object made a real way, not "art in a style". Ask the model for
      that shape of answer.
- [ ] **`heroTreatment: photo | duotone | flat` is too coarse** and should be
      reconsidered — it cannot express "flat ink printing with misregistration",
      so it cannot reach the look TJ already likes.
- [ ] Weight the vocabulary toward photography, with illustration reachable but
      not common. No per-cuisine rules.

`HOUSE_RULES` / `HERO_HOUSE_RULES` already enforce the hard floor (no text, no
lettering, no watermarks, no emoji) and stay as-is.

## Phase 7 — `feat/canvas-rebalance`

### Pre-flight audit (done — the change is smaller than it looks)

53 `p.onBg` / `onBgMuted` consumers across 14 files sounds alarming, but almost
all of them sit on screens §6 says KEEP the bold blue (Ask, cart detail, the auth
flow). Only what actually moves matters:

| Canvas-coupled thing | Call sites | Risk |
|---|---|---|
| `HeroStat` (hardcodes `p.onBg`) | **1** — `cart/[id].tsx` only | None. Cart detail stays blue. |
| `EyebrowChip onCanvas` | 7 | Low. Already parameterized — moving a screen means dropping the prop. |
| `DisplayTitle` (defaults to `onBg`) | 9 files | Low. Card usages already pass `color={p.text}` explicitly. |

**Household — the screen §6 most wants moved — has ZERO `onBg` consumers.** It
uses `p.background` for the screen, one `EyebrowChip onCanvas`, and a canvas
`DisplayTitle`. Moving it is three edits, not a sweep.

So the HeroStat landmine flagged in phase 5 is real in principle but inert in
practice: its only call site is on a screen that keeps the blue.

**Scope to move:** Household and the carts list (lists + forms).
**Scope to keep blue:** heroes, Ask, cart detail — per §6, and confirmed by where
the canvas-coupled components actually live.

Confirmed direction. Largest visual change — last, reviewed side by side.

- [ ] Lists and settings move to a light canvas.
- [ ] Full-bleed blue reserved for heroes, Ask, and cart detail.
- [ ] Re-verify contrast everywhere the canvas changed.
- [ ] Extend the hero scrim — the eyebrow currently sits over a bright patch of image.

---

## Parked

`feat/sticker-reactions` awaits pose art and touches cart detail. Rebase it after
phases 2 and 4 land.

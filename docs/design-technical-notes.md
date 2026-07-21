# MC Peels — technical notes for the design work

**Date:** 2026-07-20
**Companion to:** [design-review.md](./design-review.md)

Implementation detail for the agreed design direction. Nothing here is built yet.

---

## 1. Generated kitchen design on the Gemini API

### Where it stands today

Kitchen identities are minted in `apps/api/src/ai/kitchen-identity.ts` via the
**Anthropic** SDK, using a forced tool call (`name_the_kitchen`). The model returns
language plus a palette **seed**:

```
{ name, sub, tagline, mono, palette: { mode, hues… }, voice }
```

`apps/mobile/features/eats/palette.ts` then derives the real tokens deterministically
(light: ink ~L14 on ~L96 paper; dark: cream ~L92 on ~L8 ground). Art generation lives
in `apps/api/src/art/{prompts,pipeline}.ts`, with the manifest in
`features/eats/art-manifest.ts`.

### The change

Move identity + design generation to **Gemini**, and widen what it returns from
"identity seed" to "design seed" — enough to make each kitchen's *menu* feel distinct.

**Keep the existing architectural split.** It is the correct one and it is why the
palette engine has held up:

> The model proposes **mood**. Deterministic code owns **math**.
> The model never emits a final hex for text, and never a contrast pair.

### Proposed design-seed schema

Additive to the current identity spec — everything optional with a safe default, so a
malformed or missing field degrades to today's look rather than crashing the mint:

| Field | Type | Notes |
|---|---|---|
| `palette.mode` | `'light' \| 'dark'` | existing |
| `palette.hues` | `number[]` | existing; base + accent |
| `surface` | `'paper' \| 'lacquer' \| 'linen' \| 'tile' \| 'slate'` | named treatment, mapped to real styling in code |
| `ornament` | `'none' \| 'rule' \| 'corner' \| 'motif'` | bounded set, not free-form |
| `typeVoice` | `'grotesk' \| 'serif' \| 'mono' \| 'condensed'` | maps to bundled families only |
| `density` | `'airy' \| 'standard' \| 'tight'` | scales spacing within a clamped range |
| `heroTreatment` | `'photo' \| 'duotone' \| 'flat'` | drives the art pipeline |

**Bounded enums, not free-form CSS.** Every value maps to code we control. This is what
keeps generated design from drifting into unusable territory, and it keeps the token
cost tiny (a short structured response, not a stylesheet).

**What must stay constant across all kitchens:** type scale, touch targets, nav chrome,
spacing rhythm outside the clamped density range. Variation lives in palette, surface,
ornament, hero art, and voice.

### The legibility gate (required)

Before any generated design reaches a screen, run it through a pure function:

```
assertLegible(seed) -> { ok: true, tokens } | { ok: false, reason }
```

- Derive every text/surface pair and check contrast >= 4.5:1 (>= 3:1 for large display).
- On failure, **do not** ship the seed — fall back to the house palette for that kitchen
  and log the rejection with the offending pair.
- Run it at **mint time** (server) so a bad seed is never persisted, and assert again
  client-side as a cheap guard.

This is exactly the class of bug in design-review §5 #1: not "wrong colors" but a
surface and its text getting out of sync. A gate catches it structurally.

---

## 2. Caching generated design (required — token cost)

**Principle: mint once per kitchen, read forever.** Generation is a write-path event,
never a read-path one. No screen render should ever be able to trigger a model call.

### Server-side (source of truth)

- Identity + design seed persist on the kitchen row (`apps/api/src/db/schema.ts` already
  carries `IdentityPalette` / `IdentityVoice` — extend rather than add a new table).
- Add to the stored record:
  - `design_seed` (jsonb) — the validated seed
  - `design_version` (int) — bump to force regeneration app-wide
  - `design_model` (text) — which model/version produced it
  - `minted_at` (timestamptz)
- **Mint is idempotent:** if `design_seed` exists and `design_version` matches current,
  return it and make **no** API call. Guard with a uniqueness constraint on
  `(household_id, cuisine)` so concurrent mints can't double-charge.
- Generated hero art: store the resolved URL/key on the same row. Never re-request art
  for a kitchen that already has it.

### Client-side

- Seeds arrive with the kitchen payload — no separate fetch.
- Derived tokens are computed from the seed, so cache the **derivation**, not the seed:
  memoize `paletteFromSeed(seed)` keyed on `seed + colorScheme`. It is pure, so this is
  free and avoids recompute on every render.
- Hero images: `expo-image` already does disk caching; set an explicit `cachePolicy`
  and a stable `recyclingKey` per kitchen.

### Invalidation

Only three things should ever cause a re-mint:

1. `design_version` bumped (a deliberate, app-wide design change)
2. The kitchen's underlying cuisine/dish set changes materially
3. Explicit manual regeneration (a debug affordance, not user-facing)

Reject re-mints for anything else. Note migrations must be applied via the Supabase MCP —
the drizzle journal is stale (see the `eats-restaurants-shipped` note).

### Cost guardrails

- Cap mints per household per day; log every call with cuisine + token count.
- Prefer one call returning identity **and** design seed over two calls.
- Keep the response schema small — bounded enums, no prose beyond the tagline/voice.

---

## 3. Light / dark toggle in Household

### Why it needs real work

`usePalette()` in `apps/mobile/lib/theme.ts` currently reads `useColorScheme()`
directly, so the theme is bound to the OS and cannot be overridden.

There's a bonus: on web we saw a screen keep the light canvas while the tab bar went
dark — a stale repaint, likely React Compiler memoization not re-rendering a mounted
tab on the `matchMedia` change (`experiments.reactCompiler: true` in `app.json`).
**A state-driven theme fixes that class of bug too**, because the change propagates
through React state rather than a media-query subscription.

### Approach

1. `ThemeProvider` in `lib/theme.tsx` holding `'system' | 'light' | 'dark'`.
2. Persist to `AsyncStorage` (already a dependency); hydrate before first paint to avoid
   a flash of the wrong theme.
3. `usePalette()` reads from context, falling back to `useColorScheme()` only when the
   preference is `'system'`. **Signature stays identical**, so no call site changes —
   this is what makes the change cheap across ~15 screens.
4. Mount the provider in `app/_layout.tsx` above the auth gate.
5. Household UI: a three-way segmented control (System / Light / Dark), not a binary
   switch — "System" must remain reachable and should be the default.
6. Also drive `expo-status-bar` and the root `backgroundColor` from the same value.

**While in there:** the "Prefer organic" toggle renders as a bare circle on both web and
iOS. React Native's `Switch` needs explicit `thumbColor` / `trackColor` / 
`ios_backgroundColor` per state, or should be replaced with a custom pill toggle — worth
doing once as a shared primitive since the settings surface will only grow.

---

## 4. Responsive navigation

Target: bottom tabs on mobile, top header on desktop, one component owning both.

- Breakpoint at **768px** via `useWindowDimensions()` (re-renders on resize; don't read
  `Dimensions.get()` once).
- Expo Router supports this by rendering the same `Tabs` with
  `screenOptions={{ tabBarPosition: 'top' }}`-style switching, but the cleaner path is a
  custom `tabBar` prop: one `<AppNav variant="bottom" | "header" />` component so the
  desktop header can carry the wordmark and account affordance that a tab bar can't.
- Kill the stack header on tab roots (`app/(tabs)/household.tsx` currently gets one; the
  other two set `headerShown: false`). Tab roots own their in-page header.
- Detail routes (`cart/[id]`, `restaurant/[id]`) keep a minimal back header and **keep
  the bottom nav visible** on mobile.
- Full-screen flows (`(auth)`, `onboarding`, `connect`, `oauth/authorize`,
  `auth/handoff`, `reset-password`) stay chrome-free — already correct.

### Global bottom inset (do this first, independently)

Every scroll container is missing bottom padding for the tab bar + home-indicator inset,
which clips content on **every** screen. Fix once:

- `useBottomTabBarHeight()` from `@react-navigation/bottom-tabs` (or the nav component's
  own measured height) plus `useSafeAreaInsets().bottom`.
- Apply as `contentContainerStyle={{ paddingBottom: navHeight + insets.bottom + 24 }}`.
- Best encapsulated as a `useScrollBottomInset()` hook so no screen has to remember.

---

## 5. Token changes

In `apps/mobile/lib/theme.ts`:

- **Split `primary` from `tint` in dark mode.** They are both `#4FA4F2` today, so the
  system cannot distinguish an action from an accent. Give `primary` its own value.
- **Add dark values for saturated fills.** `accent` is `#FFC531` in *both* modes and hits
  ~11.6:1 as a full-width fill on the dark canvas. Add a dark-mode accent near `#E0A020`
  (~8:1). Same for the Eats reds.
- **Widen dark elevation steps** — canvas `#0B1626` → card `#13233A` → nested rows sit
  too close together to read as layers.
- **Light-mode canvas contrast:** white on `#208AEF` is 3.53:1. Either darken the canvas
  to ~`#1668C4` (5.51:1) or keep body copy off the raw blue. This is a design decision
  (design-review §6), not a mechanical one — don't change it unilaterally.

---

## 6. Defect fix pointers

| Defect | Location | Fix |
|---|---|---|
| Illegible kitchen cards | `features/eats/HomeScreen.tsx` ~L356–362 | Cards use `tokens.onHero` but fall back to the paper surface when hero art is absent. Switch the text pair with the surface: `ink`/`inkSoft` on paper, `onHero`/`onHeroSoft` only behind a photo/scrim. |
| Content clipped under nav | global | `useScrollBottomInset()` (§4) |
| Organic toggle | `app/(tabs)/household.tsx` | Explicit Switch colors or a custom pill toggle (§3) |
| Mascot collides with "Refresh prices" | `app/cart/[id].tsx` | Absolute position assumes an empty sheet header; reposition or suppress when the header has a right-side action |
| Cart naming | `app/cart/[id].tsx`, `(tabs)/ask.tsx` | Promote `request_text` to title; drop the redundant status chip and duplicated date |
| Disabled CTA reads as broken | `(tabs)/ask.tsx` | 55% opacity over `#4FA4F2` blends to ~`#306496`. Keep enabled + validate on press, or use an outlined waiting state |
| Duplicate retailer chip | household retailer list | Dedupe by `retailer_key` |
| Hero title truncates | `features/eats/HomeScreen.tsx` | `numberOfLines={2}` on the dish title before ellipsis |
| Usuals overflow | `(tabs)/ask.tsx` | Cap at 4–5 with a "more" affordance |
| Kroger contradiction | `app/cart/[id].tsx` | Suppress the Connect CTA when no store is found near the postal code |

---

## 7. Suggested branch plan

Keep these separable so any one can ship or be reverted alone:

1. `fix/design-defects` — legibility fallback, bottom inset, toggle, mascot, dedupe,
   truncation, usuals cap. No design decisions.
2. `feat/cart-naming` — request text as title.
3. `feat/theme-toggle` — ThemeProvider + Household control (also hardens the web repaint bug).
4. `feat/responsive-nav` — the nav system. Largest blast radius; screenshot every route
   at both breakpoints before merging.
5. `feat/gemini-design` — provider swap, widened seed, legibility gate, caching + migration.
6. `feat/canvas-rebalance` — light-mode lists off the full-bleed blue. Last, side by side.

Note: `feat/sticker-reactions` is still parked awaiting pose art and touches cart
detail — rebase it after (2) and (4) land.

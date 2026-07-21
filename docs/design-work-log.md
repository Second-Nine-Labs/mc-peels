# MC Peels — design work log

**Last updated:** 2026-07-21 (later)
**Companion to:** [design-implementation-plan.md](./design-implementation-plan.md) (per-item detail and
remaining checkboxes) · [design-review.md](./design-review.md) (what/why) ·
[design-technical-notes.md](./design-technical-notes.md) (how)

What has actually shipped, what is committed but unmerged, and what is still open.
`main` is at `8d4cbfe` and deployed to https://mc-peels.secondninelabs.com.

---

## Shipped to production

Four merges, all gated on both typechecks plus the API suite (171 tests), each
deploy verified live with no console errors.

### 1. `fix/design-defects` → `7e5efba`

All four critical defects from review §5, plus the edges.

| Defect | Fix |
|---|---|
| §5 #1 Kitchen cards illegible | `ShelfStorefront`'s flat surface now uses `ink`/`inkSoft` instead of the scrim-aware `onHero` pair |
| §5 #2 Content clipped under nav | New `useScrollBottomInset()` across 7 scroll containers |
| §5 #3 Organic toggle a bare circle | Replaced RN `Switch` with a shared `Toggle` primitive |
| §5 #4 Mascot on "Refresh prices" | Moved to `top: -60` |
| §5 #7 Duplicate retailer chip | Deduped by `retailer_key` at ingestion |
| §5 #8 Title truncation | `ShelfStorefront` title now wraps to 2 lines |
| §5 #9 Usuals overflow | Capped at 5 with an expanding "N more" |
| §6 Touch targets | `Chip` raised to 44pt (was ~33) |

**Root cause on #1 is worth remembering.** `generatedCostume` flips `onHero` to
near-white when a kitchen has a hero photo, then spreads that override into the
*shared* token set — so any non-hero surface inherited white text. On a light-mode
seed's L96 canvas that is cream on cream. The palette engine was never at fault.
The structural fix (a separate scrim token) belongs with the phase-6 gate.

### 2. `feat/cart-naming` → `06c12fc`

Review §5 #5, the cheapest big win. Every cart was named "MC Peels · Jul 20".
Fixed client-side by flipping title precedence to `request_text` — the stored
title is also the Instacart page title, where the branding is correct, and the
client-side flip repairs every existing cart with no migration. `DisplayTitle`
gained optional `numberOfLines`; cart detail steps 30/26/22 and clamps to 3 lines.
Also: removed the unconditional "Ready to check out" eyebrow (wrong for any cart
not ready), the duplicated date, the disabled-CTA-reads-as-broken state, and
Kroger's "Connect" sitting beside "No quote".

### 3. `feat/theme-toggle` → `bc1c7d6`

`ThemeProvider` holding `'system' | 'light' | 'dark'`, persisted to AsyncStorage,
mounted above the auth gate. `usePalette()`'s signature is unchanged — that is why
all 19 call sites stayed untouched. Status bar now driven from the resolved scheme
rather than `"auto"`, which read the OS and would have produced light-on-light for
a Light choice on a dark phone.

### 4. `feat/responsive-nav` + `feat/cart-detail-nav` → `6e825ee`, `8d4cbfe`

Review §2, the biggest structural gap. One `AppNav` renders both variants from the
same navigation state: bottom tabs under 768px, top header above it with wordmark
and account affordance. Duplicate Household stack header killed. `cart/[id]` moved
inside `(tabs)` so the nav stays visible — a route group contributes no URL
segment, so `/cart/<id>` and the Kroger OAuth return leg are unchanged. The kitchen
(`restaurant/[id]`) deliberately stays immersive.

### 5. `feat/token-consolidation` → `08da4af`

Review §3 and the mechanical half of §6. Dark `primary` split from `tint`
(`#1D6FD1`, 4.95:1 with white); accent dimmed to `#E0A020` (8.28:1, was 11.48:1);
elevation ramp widened. Buttons: one fill, alternates outlined, accent reserved
for the terminal retailer hand-off. Chips: three roles, status collapsed to one
appearance. `TwoToneTitle` deleted (zero call sites). Uppercase stripped from form
labels and stat rows, kept on eyebrows and section labels.

### 6. `feat/gemini-design` part 1 → `eb2c6d7`

The legibility gate — and the engine fix it forced.

`assertLegible` is pure, 10 tests, and checks `onHero` against the **canvas**
rather than a photo, because an absent or failed hero is precisely the case the
cream-on-cream bug fell into.

Writing it before the Gemini path paid for itself immediately. It found that
`palette.ts` claimed its accent on-color "flips to the side opposite the accent's
own lightness" while hardcoding L98/L10 — worst measured **2.01:1**, only **26%**
of hue pairs cleared AA, and **two of the three live production kitchens failed**.

TJ's call was to fix the ramps rather than gate around them. Two parts, because
the obvious one is insufficient: the on-color is now measured against the real
fill, AND the fill walks outward from its target lightness until its label clears
— needed because some fills sit where neither white nor black works. Light-mode
`inkSoft` also dropped L40 → L34 (4.04:1 on paper at yellow hues).

**10,368 of 10,368 hue/mode combinations now pass**, pinned by a test that walks
the whole space. Mirrored into the client engine with ramp parity verified field
by field — a divergence would ship a seed the server believes is legible and the
client renders otherwise.

---

## Still open

**Phase 6 remainder** — Gemini **text** `generateContent` path (reuse the plain-REST
pattern and `GEMINI_API_KEY` from `art/gemini.ts`; no SDK), the widened design seed
(`surface` / `ornament` / `typeVoice` / `density` / `heroTreatment` — bounded enums,
all optional with safe defaults), caching columns (`design_seed`, `design_version`,
`design_model`, `minted_at`) via **Supabase MCP** not drizzle, client memoization of
`paletteFromSeed`, `expo-image` `cachePolicy` + `recyclingKey`, and cost guardrails.
Wire `assertLegible` into `ensureKitchenIdentity` so a rejected seed falls back to
`HOUSE_SEED` and logs the offending pair.

**Phase 7** — canvas rebalance (largest visual change; TJ reviews side by side
first). Pre-flight: audit every `p.onBg` / `onBgMuted` consumer — `HeroStat`
hardcodes white and will go invisible on a light canvas.

---

## Known gaps in verification

Stated plainly because "it compiles" is not evidence:

- **No authed session was ever exercised.** Verification ran against
  `/eats-preview` (auth-exempt) and throwaway harnesses mounting the real
  components. Household, the merged Ask screen, and cart detail have not been seen
  with real data.
- **`useScrollBottomInset`'s in-tabs path is now proven** (reads 81 on mobile, 24
  on desktop) — that was verified during phase 4, having been an open question
  since phase 1.
- **The web stale-repaint bug** is fixed in mechanism (context propagates through
  the render path) and verified across every surface in a harness — but the
  original report was a *tab bar* lagging a screen, and the tab bar only exists
  behind auth. Not reproduced against the original conditions.
- **Shancheng's CTA label is still sub-AA** at 3.97:1 (improved from 3.19:1).
  Clearing 4.5 properly belongs to the phase-6 legibility gate.

---

## Process notes worth keeping

- **This work lives in an isolated worktree** at `/Users/tjshaffer/Documents/mc-peels-design`
  because a second session shares the primary checkout and switches branches under
  it. An earlier phase-1 attempt was built on a branch 12 commits behind main and
  had to be redone; always `git checkout -b <name> main`, never bare `checkout -b`.
- **Three prescriptions in the technical notes were wrong** and were caught by
  reading installed source: `@react-navigation/bottom-tabs` is not resolvable
  (Expo Router v57 vendors it — use `expo-router/tabs`); `getTabBarHeight()`
  already includes `insets.bottom`, so the documented formula double-counts the
  home indicator; and defect #1 was at a different location than cited.
- **`href: null` encodes as `tabBarItemStyle: {display: 'none'}`**, a style the
  default bar applies and a custom bar must read — caught live when cart detail
  rendered as a fourth tab.

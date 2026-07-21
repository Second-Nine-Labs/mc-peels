# MC Peels — design review

**Date:** 2026-07-20
**Surfaces reviewed:** web light, web dark, iOS dark (device)
**Status:** agreed direction, not yet implemented

A synthesis of the design critique plus TJ's own notes. This is the "what and why"
document; implementation detail lives in [design-technical-notes.md](./design-technical-notes.md).

---

## 1. The honest summary

The bones are good. The cart-detail hero, the dark neutral ramp, and the new
photographic kitchen heroes are genuinely strong work. What reads as unfinished
comes from three places, in order of damage:

1. **Navigation has no system.** Every screen invents its own chrome.
2. **Two decisions were never made** — what a primary button looks like, and what a
   chip looks like — so both exist in five-plus variants.
3. **A handful of real defects** (illegible cards, clipped content, a broken toggle,
   a colliding mascot) that read as "broken app" rather than "taste".

Almost none of this is "the design is wrong." It's unmade decisions and unfinished
edges. That's a much better position than it feels like.

---

## 2. Navigation — the biggest structural gap

Currently there is no consistent pattern. Across the app today:

| Screen | Top chrome | Bottom nav |
|---|---|---|
| Kitchens (`(tabs)/index`) | none (custom in-page header) | yes |
| New cart (`(tabs)/ask`) | none (custom in-page header) | yes |
| Household (`(tabs)/household`) | stack header "Household" | yes |
| Cart detail (`cart/[id]`) | stack header + back arrow | yes |
| Onboarding, connect, auth, reset | none | none |

So a user meets three different chrome models inside four taps, and Household is the
only tab carrying a redundant title bar (its page already says "Set your kitchen's rules").

### The rule going forward

**One navigation system, responsive by breakpoint:**

- **Mobile (< 768px):** bottom tab bar. No stack header on tab roots — each tab owns
  its in-page header (wordmark/title). Detail screens (cart, restaurant) get a
  minimal back header, and the bottom nav **stays visible** so you never lose your place.
- **Desktop (>= 768px):** the bottom bar becomes a **top header** — wordmark left,
  the three destinations centered or left-adjacent, account/search right. Bottom nav
  disappears entirely. A full-width bottom bar on a 1400px desktop viewport is the
  single most "unprofessional" tell in the current web build.
- **Full-screen flows** (auth, onboarding, connect, OAuth, reset) keep no chrome —
  that's correct and stays.

### Supporting rules

- Tab roots never show a stack header. Kill the duplicate "Household" bar.
- Detail screens: back affordance always in the same position, always the same size.
- The nav surface is the one thing that **never** changes between the blue app and
  the Eats/Book worlds. Constant chrome is what makes the content shift read as
  intentional rather than accidental.

---

## 3. Consistency: the two unmade decisions

### 3a. Primary buttons — currently five treatments

Observed across light + dark: navy fill, bright-blue fill, muddy-blue (a disabled
state that reads as broken), yellow fill, orange fill (from a kitchen's minted
palette), and a red pill in Eats.

**The rule:**

| Role | Treatment |
|---|---|
| Primary action | One fill, consistent per mode |
| Terminal "go shop" action (Instacart / retailer hand-off) | Accent yellow — reserved, nothing else uses it |
| Setup / connect actions | Secondary fill |
| Alternates beside a primary (e.g. second retailer) | Outlined, never a second filled button |
| In-kitchen actions | The kitchen's own palette — scoped to that kitchen only |

Two full-width filled buttons of equal weight (Instacart + Kroger today) means neither
is the default. The preferred retailer gets the fill; alternates get outlines.

Related: in dark mode `primary` and `tint` are the **same hex** (`#4FA4F2`), so the
system literally cannot distinguish "the action" from "an accent." That's a token bug
underneath a visual symptom.

### 3b. Chips — currently eight variants

Outlined dark, filled yellow, translucent eyebrow, white-with-plus, gray retailer,
blue-outline selected, green status, blue status.

**Collapse to three:** `eyebrow` (the existing `EyebrowChip`), `selectable` (one
style, one clear selected state), `status` (semantic color only). Everything else maps
into one of those.

### 3c. Type and labels

- **Uppercase overload.** Nearly every label shouts (`YOUR KITCHENS`, `YOUR USUALS`,
  `NAME`, `POSTAL CODE`, `BUILT JUL 20`, `3 ITEMS`, `PREFERRED BRANDS`…). Keep
  uppercase for eyebrows and section labels only; form labels go sentence case.
- **Two title primitives** (`DisplayTitle` and `TwoToneTitle`) do the same job. Keep
  one, delete the other — two primitives is the root cause of drift.
- **Headlines must wrap, never truncate.** "CREAMY TUSCAN …" cuts off the dish name;
  allow two lines before ellipsis.

---

## 4. Kitchens should each look like themselves

Agreed direction: **every kitchen gets its own design inside its menu.** A Tuscan
trattoria and a Chongqing noodle house should not be the same screen with different
strings.

Principles:

- **The design is generated, not hand-authored.** Per-kitchen aesthetics should come
  from the model at mint time, not from bespoke code per cuisine. Hand-built
  "costumes" don't scale past the flagships and bias every new kitchen toward
  whoever wrote the last one.
- **Move generation to the Gemini API.** (Rationale + schema in the technical notes.)
- **The model proposes mood; deterministic code owns the math.** This already works
  well — the model returns a palette *seed* (mode + hues) and `palette.ts` derives
  contrast-checked tokens. Keep that split. Never let a model emit final hex values
  for text.
- **Uniqueness is bounded.** Type scale, spacing, touch targets, and nav chrome stay
  constant across all kitchens. What varies: palette, surface treatment, hero art,
  ornament, and voice. That's what makes it feel designed rather than random.
- **Every generated design must pass a legibility gate before it ships to a screen**
  (see the fallback defect below — this is exactly how that class of bug happens).

---

## 5. Defects — the "looks broken" list

Ordered by damage. None of these are taste calls.

| # | Defect | Where | Severity |
|---|---|---|---|
| 1 | **Kitchen cards illegible** — cream surface with on-photo white text | Home, iOS dark | Critical |
| 2 | **Content clipped under the bottom nav on every screen** | Global | Critical |
| 3 | **Organic toggle renders as a bare circle** with no track | Household | Critical |
| 4 | **Mascot collides with "Refresh prices"** | Cart detail | Critical |
| 5 | **Every cart is named "MC Peels · Jul 20"** | Carts list + detail | Critical (UX) |
| 6 | **"Build my cart" disabled state reads as broken** | Ask | High |
| 7 | Duplicate "Save A Lot" in retailer chips | Household | High |
| 8 | Hero dish title truncates mid-name | Home | High |
| 9 | "Your usuals" grew to 8 chips / 4 rows, burying recent carts | Ask | Medium |
| 10 | Redundant status: "READY TO CHECK OUT" chip beside a "Ready" pill | Cart detail | Medium |
| 11 | Kroger shows "no store found" **and** a Connect CTA | Cart detail | Medium |
| 12 | Date duplicated in cart title and meta row | Carts | Low |

### On #1, the important one

The palette engine is **not** at fault. `palette.ts` does proper deterministic
contrast math. The bug is that shelf cards use the kitchen's on-photo text color
(`onHero`) but fall back to the kitchen's light **paper** surface when hero art hasn't
loaded — cream text on cream paper. The card needs to switch its text pair with its
surface: `ink`/`inkSoft` on paper, `onHero`/`onHeroSoft` only when a photo/scrim is
actually behind it.

This is the template for how generated-design bugs will appear: not wrong colors, but
a *surface and its text getting out of sync*. The legibility gate in §4 exists to catch it.

### On #5, the cheapest big win

The cart already has the good text — the request line ("1 pack flatbread or pizza
dough, 6 each fresh figs…") is right there, demoted to a muted italic quote, while the
meaningless string is the H1. Swap them. That single change fixes cart detail *and*
makes the carts list scannable, because it's the same field.

---

## 6. Colour and mode

- **Light mode:** white body text on the `#208AEF` canvas is **3.53:1** — below the
  4.5:1 AA threshold. Headlines are fine (large text needs 3:1); subtitles and
  footnotes are not. Either darken the canvas to ~`#1668C4` (**5.51:1**) or keep the
  bold blue and stop putting reading-size text directly on it.
- **Dark mode:** the neutral ramp is well built (muted text hits **7.5:1**). The
  problem is that **saturated fills never got dark values** — accent yellow hits
  **11.6:1** against the canvas as a full-width fill, which is why the cart screen
  glares. A deeper amber (~`#E0A020`) lands near **8:1**: still emphatic, ~30% less
  luminous. Same treatment needed for the Eats reds.
- **Elevation in dark is too compressed** — canvas, card, and nested rows sit within a
  narrow value band, so structure reads as vague. Dark UIs need *wider* steps than light.
- **Bold blue works better in bands than as an infinite canvas.** On list and settings
  screens it becomes a wash that forces every element into a white card. Reserve the
  full-bleed blue for heroes, Ask, and cart detail; put lists and forms on a light
  canvas. This is what the recipe-app reference actually does.

Touch targets: retailer chips are ~36px, under the 44px minimum.

---

## 7. What is working — keep it

- **Cart detail's hero + sheet** is the strongest composition in the app. Use it as the
  template for other detail screens.
- **Photographic kitchen heroes** are a marked step up from flat generated art. Real
  photography buys credibility instantly. (Extend the scrim — the eyebrow currently
  sits over a bright part of the image.)
- **The dark neutral ramp** is properly built and looks good on OLED.
- **The palette seed + deterministic engine split** is the right architecture for
  generated design. Don't loosen it.
- **The mascot has real equity.** It just needs to stop landing on text.
- **The cart request line** is now genuinely informative content — it just needs promoting.

---

## 8. Sequence

1. **Defects 1–4** — illegible cards, global bottom inset, toggle, mascot. All
   mechanical, all "app looks broken", no design debate needed.
2. **Cart naming** (#5) — biggest UX win per unit of effort.
3. **Navigation system** — responsive header/bottom-nav, kill duplicate headers.
   Biggest structural change; do it on a branch.
4. **Token consolidation** — one primary, three chips, split `primary`/`tint` in dark,
   dark values for saturated fills.
5. **Generated kitchen design on Gemini** — with the legibility gate and caching.
6. **Canvas rebalance** (light-mode lists off the full-bleed blue) — the largest visual
   change; worth doing last, side by side.

Steps 1 and 2 are same-day. Step 3 is the one that will most change how the app *feels*
to use.

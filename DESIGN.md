# Design System — BuBz's Gallery

## Product Context
- **What this is:** Personal art gallery and community space for sharing SFW and NSFW artwork
- **Who it's for:** Strangers arriving via link — must feel immediately welcoming and easy to navigate
- **Space/industry:** Personal creator portfolio, NSFW-inclusive art community
- **Project type:** Web app (gallery + community wall + drawing tool + admin panel)
- **Memorable thing:** "User friendly" — warm, approachable, never intimidating

## Aesthetic Direction
- **Direction:** Cozy Artist Bedroom — the vibe of an art-lover's room at 2am. Plush, warm, a little mysterious. Not scary-dark, not bubblegum-cute. Somewhere between both.
- **Decoration level:** Intentional — corkboard texture, washi tape strips, paper cards. Every decoration has a purpose (pinned art = showing something precious).
- **Mood:** Intimate and personal. Visitors should feel like they've been invited into your actual space, not a clinical white-wall gallery.
- **Physical metaphor:** Art pinned to a corkboard. Cards are literal notes tacked to the wall. This is the design's core conceit — preserve it in all new features.

## Typography

- **Display / Logo:** `Pacifico` — friendly, rounded, unmistakably personal. Used for the site logo, page titles, and admin headings only.
- **Body / UI:** `Comfortaa` (400, 600, 700) — rounded letterforms that stay warm without being childish. Used for all navigation, buttons, labels, card titles, body text.
- **Handwriting:** `Caveat` (400–700) — personal notes, wall messages, anything the "human" voice uses. Not for UI chrome.
- **Typewriter / Stamp:** `Special Elite` — dates, metadata, tags, administrative labels. Adds analog texture.
- **Code:** system monospace fallback (no code UI currently)

### Loading
```html
<link href="https://fonts.googleapis.com/css2?family=Pacifico&family=Comfortaa:wght@400;600;700&family=Caveat:wght@400;500;600;700&family=Special+Elite&display=swap" rel="stylesheet">
```

### CSS Variables
```css
--font-display: 'Pacifico', cursive;
--font-body:    'Comfortaa', 'Segoe UI', sans-serif;
--font-hand:    'Caveat', 'Comfortaa', cursive;
--font-stamp:   'Special Elite', 'Courier New', monospace;
```

### Scale
| Role | Size | Weight | Font |
|------|------|--------|------|
| Site logo | 1.4–1.8rem | — | Pacifico |
| Page heading | clamp(2rem, 5vw, 3.5rem) | — | Pacifico |
| Section heading | 1.2rem | 700 | Comfortaa |
| Body | 1rem | 400 | Comfortaa |
| UI label | 0.78–0.85rem | 600–700 | Comfortaa |
| Small / meta | 0.65–0.75rem | 400 | Special Elite |
| Wall message | 0.9–1rem | 400–600 | Caveat |
| Card note | 0.8rem | 600 | Comfortaa |

## Color

- **Approach:** Balanced — two plum depths + one warm accent + cream paper for contrast

### Palette
```css
--bg:           #34073d;   /* deep plum — main background */
--bg2:          #280530;   /* darker plum — age gate, modals, depth layers */
--card:         #4a0e55;   /* mid plum — card surfaces, panels, wall tiles */
--accent:       #ef745c;   /* coral — CTAs, active states, hover, reactions */
--accent-glow:  rgba(239,116,92,0.4);  /* glow for text shadows, focus rings */
--text:         #ffd6cc;   /* warm cream — primary text on dark surfaces */
--text-dim:     #c9a0a0;   /* muted warm — secondary text, placeholders */
--border:       rgba(239,116,92,0.2);  /* subtle coral border */
--card-border:  rgba(239,116,92,0.2);
--modal-bg:     rgba(20,2,24,0.92);

/* Paper treatment — used for pinned art cards */
--paper:        oklch(0.93 0.028 75);  /* ≈ #ede8d8 warm cream */
--paper-2:      oklch(0.88 0.04 65);   /* ≈ #e0d8c4 slightly tanned */
--paper-ink:    #3a2a20;               /* ink-on-paper text */
--paper-shadow: rgba(20,2,24,0.45);

/* Washi tape accents */
--tape:       oklch(0.88 0.06 95 / 0.82);   /* translucent yellow */
--tape-pink:  oklch(0.82 0.09 20 / 0.78);   /* translucent salmon */
--tape-mint:  oklch(0.86 0.07 170 / 0.78);  /* translucent mint */
--pin:        #d94f3a;
--cork:       #5a1a66;
```

### Usage Rules
- **Accent (#ef745c)** — active nav buttons, primary CTAs, reaction counts, tag backgrounds, hover states. Never use as a text-heavy background.
- **Paper (#ede8d8)** — art cards only. The contrast is aggressive and intentional — it makes pinned art feel precious.
- **Caveat + paper-ink** — when writing on paper cards, always use `--paper-ink` not `--text`.
- **No pure black or pure white** — always use the warm palette values.

## Spacing

- **Base unit:** 8px
- **Density:** Comfortable — gallery breathes; wall is slightly denser (community feel)

```css
--space-xs:  4px;
--space-sm:  8px;
--space-md:  16px;
--space-lg:  24px;
--space-xl:  32px;
--space-2xl: 48px;
--space-3xl: 64px;
```

## Layout

- **Approach:** Hybrid — grid-disciplined for gallery, editorial/organic for community wall
- **Gallery grid:** `repeat(auto-fill, minmax(200px, 1fr))`, gap 16px
- **Wall grid:** `repeat(auto-fill, minmax(220px, 1fr))`, gap 16px
- **Max content width:** 1100px centered
- **Header:** flex row, space-between, sticky, border-bottom with `--border`

### Border Radius
```css
--radius:    14px;   /* cards, modals, panels */
--radius-sm: 8px;    /* inputs, small chips */
/* Paper cards: 4px 6px 3px 7px — intentionally uneven, handmade feel */
/* Buttons/pills: 20–22px (fully rounded) */
/* Avatars: 50% */
```

## Motion

- **Approach:** Intentional — every animation aids comprehension or adds warmth. No gratuitous effects.
- **Library:** AOS for scroll reveals (fade-up, zoom-in). CSS transitions for hover states.
- **Transition default:** `0.25s ease`
- **Card hover:** `translateY(-3px)` + box-shadow increase
- **Reaction pop:** scale bounce (keyframe)
- **Toast:** slide-in from bottom, fade out after 4–6s
- **Page loader:** fade overlay with 🎨 icon

### Easing
```css
--transition: 0.25s ease;
/* Entrances: ease-out */
/* Exits: ease-in */
/* Hover: ease */
```

## Components

### Art Card (paper)
- Background: `--paper` with subtle ruled-line gradient
- Border-radius: `4px 6px 3px 7px` (uneven = handmade)
- Washi tape strip: absolute, top -8px, centered, rotate ±1–2deg
- Card rotation: ±0.3–1.1deg random — feels pinned, not printed
- Text on card: always `--paper-ink`, font `--font-body`
- Tags: coral tint background, `#c04a30` text
- Reactions: `rgba(58,42,32,0.08)` chip, paper-ink text

### Wall Card (plum)
- Background: `--card`, border `--border`
- Sender name: `--font-hand`, `--text`
- Message: `--font-hand`, `--text`, line-height 1.5
- Time: `--font-stamp`, `--text-dim`
- Reactions: coral tint chips

### Buttons
- **Primary:** `background: --accent`, white text, `border-radius: 22px`, coral glow shadow
- **Secondary:** transparent, `border: 2px solid --accent`, coral text
- **Ghost:** `rgba(255,255,255,0.07)` bg, `--border`, cream text
- **Nav:** pill shape, active state gets coral border + coral-tint bg

### Forms
- Input bg: `rgba(255,255,255,0.06)`
- Border: `1.5px solid --border`, focus `border-color: --accent`
- Label: Comfortaa 700, `--text-dim`, uppercase, `letter-spacing: 0.06em`
- Font: Comfortaa, `--text`

### Toasts
- Background: `--accent` (coral), white text, border-radius 50px
- Font: Comfortaa 700, 0.9rem
- Shadow: `--accent-glow`
- Position: fixed bottom-center, slide-up animation
- Note: coral bg chosen over card bg for maximum visibility

## Risks (deliberate departures — preserve these)

1. **Washi tape + corkboard physical metaphor** — Most galleries are clinical. This one feels lived-in. The texture SVG backgrounds, tape strips, and slightly rotated cards are load-bearing personality. Don't remove them to "clean things up."

2. **Four-font system** — Pacifico + Comfortaa + Caveat + Special Elite is unusual. It works because each font has a strict role. Don't add a fifth font. Don't swap roles without good reason.

3. **Paper cream on deep plum** — The contrast is aggressive on purpose. Each pinned card is a precious object. Don't soften the paper color or darken it toward the plum range.

## "User Friendly" Principle

Every decision should reduce friction for a stranger arriving via link:
- Clear nav labels (not icon-only)
- Readable text size (minimum 0.8rem)
- Comfortaa's rounded forms — never harsh or clinical
- Coral accent for all interactive affordances — consistent, warm
- Toasts for all async feedback
- Age gate is welcoming, not threatening

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-04 | Initial design system created | Codified existing aesthetic via /design-consultation. Cozy Artist Bedroom direction confirmed by user. |
| 2026-06-04 | Four-font system locked | Pacifico/Comfortaa/Caveat/Special Elite each serve a distinct register. Deliberate departure from 1-2 font norm. |
| 2026-06-04 | Paper cards on plum bg | Aggressive contrast is intentional — pinned art feels precious. |
| 2026-06-04 | Washi tape + corkboard texture | Physical metaphor: art pinned to a wall. Core personality. Do not remove. |

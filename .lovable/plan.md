# Redesign to mobile-fintech aesthetic

Adopt the look from the reference screenshot across the entire app: soft gray canvas, rounded white cards, colorful tinted icon tiles, bold sans-serif type, and a floating pill bottom navigation on mobile.

## Visual language

- **Canvas**: light neutral gray `#F2F3F5` (dark mode: near-black).
- **Cards**: pure white, `rounded-3xl`, generous padding, subtle shadow, no visible borders.
- **Typography**: bold sans-serif (Inter/Manrope-style) headings, medium-weight labels, muted gray subtitles. Drop the editorial serif (Instrument Serif) for this direction.
- **Icon tiles**: 44–48px rounded-2xl squares with tinted pastel backgrounds (blue/green/pink/gray) holding a single Lucide icon in a saturated tone — exactly like Pay/Request/Transfer rows.
- **Buttons**: pill-shaped white buttons with subtle shadow for secondary, solid black pills for primary CTAs.
- **Nav**: floating pill at bottom on mobile (Home / Bots / Messages / Settings), each item icon + label, active item gets a white circle highlight with a black icon.

## Scope of changes

### Design tokens
- Rewrite `src/index.css` palette: new background, card, muted, accent tile colors, shadow utilities (`shadow-card`, `shadow-pill`).
- Update `tailwind.config.ts` font family (sans = Manrope/Inter, drop display serif), add tile color tokens (`tile-blue`, `tile-green`, `tile-pink`, `tile-gray`), new radii (`3xl`).
- Update `index.html` Google Fonts link (Manrope + Inter, drop Instrument Serif).

### Shared components
- New `IconTile` component (tinted rounded-square wrapping a Lucide icon).
- New `ActionRow` component (icon tile + title + subtitle row used inside white cards).
- New `BottomNav` component (floating pill nav for mobile dashboard).
- New `RoundButton` / pill button variants in `button.tsx`.
- Update `PageHeader`, `SiteHeader`, `SiteFooter`, `DashboardLayout`, `AdminLayout` to the new look (white pill header, avatar + actions on the right).

### Pages
- **Landing (`Index.tsx`)**: hero with big bold heading, white card stack of features as ActionRows (like the reference), pill CTAs, simplified stats card.
- **Auth**: light gray canvas, single centered white card, pill Google button + pill primary.
- **Pricing**: white pricing cards with rounded-3xl and pill CTAs.
- **Dashboard pages** (Overview, Bots, Groups, Knowledge, Messages, Billing, Settings): rework headers, swap raw lists/tables for white cards with ActionRows where natural, pill buttons everywhere, floating BottomNav on mobile.
- **Admin pages**: same card + tile treatment, keep tables but wrap them in rounded-3xl white cards.

### Out of scope
- No business logic, schema, or auth flow changes.
- No edge function or backend changes.
- Functionality of every page is preserved; only presentation is updated.

## Technical notes

- All colors via HSL semantic tokens in `index.css` (no inline hex in components).
- Icons stay `lucide-react` (already installed).
- `framer-motion` already available for subtle entrance/hover animation on tiles and bottom nav.
- Mobile-first: floating BottomNav shows under `md`, current sidebar stays for `md+` but restyled to match (white pill rail).
- TypeScript-only edits, verified by the build after each batch.

Once approved, I'll roll this out in batches: tokens → shared components → landing/auth → dashboard → admin.

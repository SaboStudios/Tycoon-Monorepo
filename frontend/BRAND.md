# Tycoon Brand Guidelines

Quick reference for contributors. Keep UI consistent with these tokens.

---

## Color Tokens

All colors are defined as CSS variables in `src/app/globals.css` and exposed as Tailwind utilities via `--color-*`.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--tycoon-bg` | `#f7fafb` | `#010f10` | Page background |
| `--tycoon-accent` | `#006d77` | `#00f0ff` | CTAs, links, focus rings, highlights |
| `--tycoon-border` | `#c6dde0` | `#003b3e` | Borders, dividers |
| `--tycoon-text` | `#12262a` | `#f0f7f7` | Primary text |
| `--tycoon-card-bg` | `#ffffff` | `#0e1415` | Cards, panels |

Use tokens via Tailwind: `bg-tycoon-bg`, `text-tycoon-accent`, `border-tycoon-border`, etc.
Do **not** hardcode hex values — always use the CSS variable or its Tailwind utility.

### Contrast (WCAG AA)

| Pair | Ratio | Passes AA |
|---|---|---|
| `--tycoon-text` on `--tycoon-bg` (light) | ~16:1 | ✓ |
| `--tycoon-accent` on white (light) | ~5.7:1 | ✓ |
| `--tycoon-text` on `--tycoon-bg` (dark) | ~18:1 | ✓ |
| `--tycoon-accent` on `--tycoon-bg` (dark) | ~14:1 | ✓ |

---

## Typography

All fonts are loaded via `next/font/google` in `src/lib/fonts.ts`. They are available as CSS variables and Tailwind utility classes.

| Font | Variable | Class | Weights | Usage |
|---|---|---|---|---|
| Krona One | `--font-krona-one` | `font-krona` | 400 | Hero headings, logotype |
| Orbitron | `--font-orbitron` | `font-orbitron` | 400–900 | Game UI, scores, labels |
| DM Sans | `--font-dm-sans` | `font-dm-sans` | 400–700 | Body text, UI copy |

### Licensing

All three fonts are served via Google Fonts and licensed under the **SIL Open Font License 1.1 (OFL)**, which permits free use, modification, and redistribution in any product including commercial. No additional attribution required beyond this document.

---

## Focus / Interactive States

- **Focus ring**: `ring-1 ring-tycoon-accent` — driven by `--color-ring` in globals.css, which maps to `--tycoon-accent`. Do not override per-component.
- **Hover**: Use opacity modifiers on the accent (`hover:bg-tycoon-accent/90`) or Tailwind neutral steps consistent with the surrounding surface.
- **Active / pressed**: `active:scale-95` or `active:opacity-80` — do not use custom colors for active states.
- **Disabled**: `disabled:opacity-50 disabled:pointer-events-none` — no custom color.

---

## Dark Mode

Dark mode is toggled via `data-theme="dark"` on `<html>`. The theme preference is stored in localStorage under the key `tycoon-theme`.

- Supported values: `"light"` | `"dark"` | `"system"` (follows OS preference)
- Use the `useTheme()` hook from `src/components/providers/theme-provider.tsx` to read or set the theme.
- CSS: use `[data-theme="dark"] &` or the Tailwind `dark:` variant (configured as `@custom-variant dark` in globals.css).

---

## Icons

- Icon library: **lucide-react** and **react-icons**.
- Prefer lucide-react for UI chrome (nav, buttons, forms). Use react-icons only for brand/social icons not available in lucide.
- Always pair icons with a visible label or `aria-label` for accessibility.

---

## Open Graph Image

`src/lib/metadata/config.ts` references `/metadata/og-image.png` (1200×630 px) for social sharing previews. **This file does not exist yet** — a designer needs to produce it and place it at `frontend/public/metadata/og-image.png`. Until it is added, OG previews will be broken.

---

## PWA / Favicon

| Asset | Path | Notes |
|---|---|---|
| favicon.ico | `/metadata/favicon.ico` | Browser tab |
| 16×16 PNG | `/metadata/favicon-16x16.png` | Small tab |
| 32×32 PNG | `/metadata/favicon-32x32.png` | Standard tab |
| Apple touch icon | `/metadata/apple-touch-icon.png` | iOS home screen |
| Android 192 | `/metadata/android-chrome-192x192.png` | PWA launcher |
| Android 512 | `/metadata/android-chrome-512x512.png` | PWA splash |

When replacing icons, regenerate all sizes from a square source SVG. Use [realfavicongenerator.net](https://realfavicongenerator.net) or equivalent. Place outputs in `frontend/public/metadata/`.

---

## Do / Don't

| Do | Don't |
|---|---|
| Use `--tycoon-*` tokens | Hardcode `#006d77` or any hex in components |
| Use `font-krona` / `font-orbitron` for headings | Use system fonts for branded headings |
| Test dark mode before opening a PR | Ship only light-mode tested changes |
| Keep focus rings visible on all interactive elements | Remove outlines with `outline-none` without adding a ring |

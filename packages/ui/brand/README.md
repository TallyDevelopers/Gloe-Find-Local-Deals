# Brand assets

Single source of truth for the Gloē wordmark and brand font. Owned by `@gloe/ui`.

## Files

- **`wordmark.svg`** — outlined paths, `fill="currentColor"`. Use this for in-product embeds (React `<img>` via Next, or inlined as a component) where the consumer controls color via CSS or props.
- **`wordmark-gold.svg`** — outlined paths, baked `#C89A8C` fill. Use this for **external** embeds where `currentColor` won't resolve: email signatures, partner press kits, third-party OG image renderers, share sheets.
- **`Outfit-SemiBold.ttf`** — the source font, used to generate the outlined SVGs above. Not shipped to apps; kept here so we can regenerate if the spec changes (size, tracking, glyphs).

## Why outlined and not live `<text>`?

The wordmark is a brand mark, not body copy. Outlining guarantees identical rendering on any machine, no font-load FOUT, no fallback to Times if the consumer's Outfit subset is missing the `ē` macron (U+0113).

For **in-app** display of the wordmark — where we want theming and crisp scaling — use the React component at `packages/ui/src/Wordmark.tsx` instead. It uses live Outfit text and switches color via theme tone.

## How to regenerate

If the wordmark spec changes (font, tracking, text), regenerate from the script in this repo's history (`/tmp/gloe-brand/outline.py` was the original). The script:

1. Loads `Outfit-SemiBold.ttf`
2. Resolves `G`, `l`, `o`, `ē` (U+0113) to glyph names
3. Emits each glyph as an SVG path with `0.18em` tracking (matching the in-app `<Wordmark>` component spec)
4. Wraps in a viewBox with 20-unit padding

## Where these are consumed

- `apps/web/public/brand/wordmark-gold.svg` — baked variant, copied here so `<img src="/brand/wordmark-gold.svg">` works for external/email embeds.
- `apps/web/src/app/{icon.svg, opengraph-image.png, apple-icon.png, favicon.ico, twitter-image.png}` — Next.js metadata routes (generated rasters of the same paths).
- `apps/web/public/brand/{pwa-192, pwa-512, pwa-512-maskable}.png` — PWA manifest icons.

If a new app needs the wordmark as a file, copy from `packages/ui/brand/` — don't fork.

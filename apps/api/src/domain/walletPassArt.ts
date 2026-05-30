import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**
 * Renders the Gloē brand assets at the exact sizes Apple Wallet expects, in
 * the warm-dark + champagne-gold palette to match the pass. Generated once at
 * process boot and memoized — sharp is fast but PNG encoding still costs ~20ms
 * per file, and there are 9 of them.
 *
 * Pass image spec: https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html#//apple_ref/doc/uid/TP40012195-CH4-SW52
 *   icon.png   — 29×29 (notifications + Wallet list)
 *   logo.png   — max 160×50 (top-left of pass header)
 *   strip.png  — 375×123 for coupons (full-width banner behind primary field)
 * Each ships at 1x, 2x, 3x.
 */

// Resolve repo paths relative to this source file so it works whether the API
// runs from repo root or apps/api. apps/api/src/domain/walletPassArt.ts → up
// 4 levels = repo root.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const BRAND_DIR = join(REPO_ROOT, 'packages', 'ui', 'brand');
const APP_ASSETS_DIR = join(REPO_ROOT, 'apps', 'mobile', 'assets');

const BRAND_GOLD = '#C89A8C';
const BRAND_DARK = '#1A130F';
const BRAND_IVORY = '#FAF5F2';

let cached: PassArt | null = null;

export type PassArt = Record<string, Buffer>;

/**
 * Build all 9 PNGs once. Subsequent calls return the same buffers — passkit
 * accepts shared buffers safely since it zips a copy at signing time.
 */
export async function getPassArt(): Promise<PassArt> {
  if (cached) return cached;

  // Wordmark SVG → logo.png trio. The SVG's tall padding above the glyphs
  // (the y-min of -1020) gives us natural breathing room without extra margin.
  const wordmarkSvg = readFileSync(join(BRAND_DIR, 'wordmark-gold.svg'));
  const [logo1, logo2, logo3] = await Promise.all([
    renderLogo(wordmarkSvg, 160, 50),
    renderLogo(wordmarkSvg, 320, 100),
    renderLogo(wordmarkSvg, 480, 150),
  ]);

  // App icon → icon.png trio. The 1024×1024 source is the gold G on dark.
  const iconSrc = readFileSync(join(APP_ASSETS_DIR, 'icon.png'));
  const [icon1, icon2, icon3] = await Promise.all([
    sharp(iconSrc).resize(29, 29).png().toBuffer(),
    sharp(iconSrc).resize(58, 58).png().toBuffer(),
    sharp(iconSrc).resize(87, 87).png().toBuffer(),
  ]);

  // Strip — full-width hero behind the primary field. Centered gold "G" on
  // warm-dark background; subtle radial vignette gives it depth. The G we
  // pull from the same icon source (downscaled + composited).
  const [strip1, strip2, strip3] = await Promise.all([
    renderStrip(iconSrc, 375, 123),
    renderStrip(iconSrc, 750, 246),
    renderStrip(iconSrc, 1125, 369),
  ]);

  cached = {
    'icon.png': icon1,
    'icon@2x.png': icon2,
    'icon@3x.png': icon3,
    'logo.png': logo1,
    'logo@2x.png': logo2,
    'logo@3x.png': logo3,
    'strip.png': strip1,
    'strip@2x.png': strip2,
    'strip@3x.png': strip3,
  };
  return cached;
}

/**
 * Rasterize the wordmark to fit within `maxW × maxH` while preserving aspect.
 * Transparent background — Apple Wallet composites it over the pass's
 * backgroundColor so a transparent logo blends correctly.
 */
async function renderLogo(svg: Buffer, maxW: number, maxH: number): Promise<Buffer> {
  return sharp(svg, { density: 600 })
    .resize(maxW, maxH, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/**
 * Compose the strip: warm-dark background + a subtle gold radial glow biased
 * to the right side, with the G mark offset to the right at low opacity so it
 * reads as a watermark rather than competing with the primary field text that
 * Wallet renders over the strip.
 */
async function renderStrip(iconSrc: Buffer, w: number, h: number): Promise<Buffer> {
  const background = await sharp({
    create: { width: w, height: h, channels: 4, background: BRAND_DARK },
  })
    .png()
    .toBuffer();

  // Gold radial glow biased right — leaves the left/center clean for primary
  // text, and the watermark G sits inside the glow on the right.
  const overlay = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="80%" cy="50%" r="55%">
          <stop offset="0%" stop-color="${BRAND_GOLD}" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="${BRAND_GOLD}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#g)"/>
    </svg>`,
  );

  // Watermark G: ~80% strip height, low opacity, anchored to the right.
  const iconSize = Math.round(h * 0.8);
  const watermark = await sharp(iconSrc)
    .resize(iconSize, iconSize)
    .composite([
      // Knock opacity down via an overlay rect — sharp doesn't have a direct
      // opacity setter, but ensureAlpha + linear works.
    ])
    .ensureAlpha(0.2)
    .png()
    .toBuffer();

  const watermarkPadRight = Math.round(w * 0.05);
  return sharp(background)
    .composite([
      { input: overlay, blend: 'over' },
      { input: watermark, left: w - iconSize - watermarkPadRight, top: Math.round((h - iconSize) / 2) },
    ])
    .png()
    .toBuffer();
}

// Silence unused-import warning if BRAND_IVORY isn't referenced elsewhere yet.
void BRAND_IVORY;

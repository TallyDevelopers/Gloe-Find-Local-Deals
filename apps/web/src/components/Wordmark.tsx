interface WordmarkProps {
  size?: number;
  /** 'gold' for brand contexts, 'light' for dark backgrounds, 'dark' for light backgrounds */
  tone?: 'gold' | 'light' | 'dark';
}

/**
 * The Gloē wordmark. Modern geometric sans (Outfit), wide letter-spacing,
 * rose gold. The ē carries the macron (U+0113) — Outfit's latin-ext
 * subset has the glyph. The font is the brand — never swap it per-surface.
 */
export function Wordmark({ size = 28, tone = 'gold' }: WordmarkProps) {
  const color =
    tone === 'gold' ? 'var(--gold)' : tone === 'light' ? 'var(--text-inverse)' : 'var(--text-primary)';
  return (
    <span
      style={{
        fontFamily: 'var(--font-wordmark)',
        fontWeight: 600,
        fontSize: size,
        letterSpacing: '0.18em',
        color,
        // pull the trailing letter-spacing off the right edge so it optically centers
        paddingLeft: '0.18em',
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      Gloē
    </span>
  );
}

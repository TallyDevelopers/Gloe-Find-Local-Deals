interface WordmarkProps {
  size?: number;
  /** 'gold' for brand contexts, 'light' for dark backgrounds, 'dark' for light backgrounds */
  tone?: 'gold' | 'light' | 'dark';
  /** Editorial serif cut (Newsreader) — used on FOR BUSINESS surfaces. */
  serif?: boolean;
}

/**
 * The Gloē wordmark. Modern geometric sans (Outfit), wide letter-spacing,
 * rose gold. The ē carries the macron (U+0113) — Outfit's latin-ext
 * subset has the glyph. Business surfaces pass `serif` for the editorial
 * Newsreader cut (tighter tracking — wide tracking reads wrong on a serif).
 */
export function Wordmark({ size = 28, tone = 'gold', serif = false }: WordmarkProps) {
  const color =
    tone === 'gold' ? 'var(--gold)' : tone === 'light' ? 'var(--text-inverse)' : 'var(--text-primary)';
  const tracking = serif ? '0.02em' : '0.18em';
  return (
    <span
      style={{
        fontFamily: serif ? 'var(--font-serif)' : 'var(--font-wordmark)',
        fontWeight: serif ? 500 : 600,
        fontSize: size,
        letterSpacing: tracking,
        color,
        // pull the trailing letter-spacing off the right edge so it optically centers
        paddingLeft: tracking,
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      Gloē
    </span>
  );
}

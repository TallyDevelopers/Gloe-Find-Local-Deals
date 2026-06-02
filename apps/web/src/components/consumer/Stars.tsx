import { Star } from './icons';

/** Five-star visual rating with a half-step via clipped overlay. */
export function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, position: 'relative' }} aria-label={`${value.toFixed(1)} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fillPct = Math.max(0, Math.min(1, value - i)) * 100;
        return (
          <span key={i} style={{ position: 'relative', width: size, height: size, display: 'inline-block' }}>
            <Star size={size} color="var(--border-default)" fill="var(--border-default)" strokeWidth={0} />
            <span style={{ position: 'absolute', inset: 0, width: `${fillPct}%`, overflow: 'hidden' }}>
              <Star size={size} color="var(--gold)" fill="var(--gold)" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

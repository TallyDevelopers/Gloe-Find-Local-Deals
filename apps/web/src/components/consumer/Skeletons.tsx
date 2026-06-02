/**
 * Shimmer placeholders. Pure CSS animation (keyframes registered inline once),
 * matching the deal-card silhouette so the feed never flashes empty.
 */

function Shimmer({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background:
          'linear-gradient(90deg, var(--surface-secondary) 25%, var(--brand-50) 50%, var(--surface-secondary) 75%)',
        backgroundSize: '200% 100%',
        animation: 'gloe-shimmer 1.4s ease-in-out infinite',
        borderRadius: 8,
        ...style,
      }}
    />
  );
}

export function DealCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--surface-elevated)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <Shimmer style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 0 }} />
      <div style={{ padding: '12px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Shimmer style={{ width: '40%', height: 10 }} />
        <Shimmer style={{ width: '85%', height: 16 }} />
        <Shimmer style={{ width: '50%', height: 14 }} />
      </div>
    </div>
  );
}

export function DealGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      <style>{'@keyframes gloe-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}'}</style>
      <div className="deal-grid">
        {Array.from({ length: count }).map((_, i) => (
          <DealCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}

import { Wordmark } from './Wordmark';

/**
 * The left-side brand panel for onboarding/auth screens. Warm gradient,
 * Gloē wordmark, a CSS phone mockup of the consumer app, and a tagline.
 * Hidden on narrow screens (form takes full width on mobile).
 */
export function BrandPanel() {
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 0,
        background: 'linear-gradient(160deg, #2b2019 0%, #4a3a2a 55%, #6e4628 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
        gap: 40,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Soft gold glow accent */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: 480,
          height: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,169,97,0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <Wordmark size={44} tone="gold" />
        <p
          style={{
            color: 'rgba(251,248,243,0.7)',
            fontSize: 14,
            letterSpacing: '0.05em',
            marginTop: 8,
          }}
        >
          FOR BUSINESS
        </p>
      </div>

      <PhoneMockup />

      <p
        style={{
          color: 'var(--text-inverse)',
          fontSize: 22,
          fontFamily: 'var(--font-display)',
          textAlign: 'center',
          maxWidth: 360,
          lineHeight: 1.4,
          zIndex: 1,
        }}
      >
        Reach clients searching for deals near you — right now.
      </p>
    </div>
  );
}

/** Pure-CSS phone showing a sample deal card, mimicking the consumer app. */
function PhoneMockup() {
  return (
    <div
      style={{
        width: 240,
        borderRadius: 36,
        background: '#1a130f',
        padding: 10,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        zIndex: 1,
      }}
    >
      <div
        style={{
          background: 'var(--surface-primary)',
          borderRadius: 28,
          overflow: 'hidden',
          height: 420,
        }}
      >
        {/* status bar spacer */}
        <div style={{ height: 28 }} />
        {/* card */}
        <div style={{ padding: 14 }}>
          <div
            style={{
              background: 'var(--surface-elevated)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(43,32,25,0.08)',
            }}
          >
            <div
              style={{
                height: 150,
                background: 'linear-gradient(135deg, #e9c8ac, #c68b5f)',
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  background: 'var(--brand-500)',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 999,
                }}
              >
                29% off
              </span>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>BOTOX</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                Botox — first-timer special
              </div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>$200</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>$280</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>★ 4.9 · 1.2 mi</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

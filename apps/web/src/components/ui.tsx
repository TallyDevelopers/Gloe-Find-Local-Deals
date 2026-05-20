import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

/**
 * Minimal web UI primitives styled with the Gloe palette (CSS vars from
 * globals.css). Plain HTML — no react-native-web. Tools, not the storefront.
 */

export function Button({
  variant = 'primary',
  children,
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const base: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    padding: '12px 24px',
    borderRadius: 'var(--radius-pill)',
    border: 'none',
    transition: 'opacity 0.15s',
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--brand-500)', color: 'var(--text-inverse)' },
    secondary: {
      background: 'var(--surface-elevated)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-default)',
    },
    ghost: { background: 'transparent', color: 'var(--text-primary)' },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
      {error ? (
        <span style={{ fontSize: 13, color: 'var(--error)' }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{hint}</span>
      ) : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        fontSize: 16,
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        background: 'var(--surface-elevated)',
        color: 'var(--text-primary)',
        outline: 'none',
        ...props.style,
      }}
    />
  );
}

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--surface-elevated)',
        borderRadius: 'var(--radius-lg)',
        padding: 32,
        boxShadow: '0 4px 24px rgba(43,32,25,0.06)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

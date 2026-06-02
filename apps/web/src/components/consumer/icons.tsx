import type { CSSProperties } from 'react';

/**
 * Inline SVG icons (Lucide geometry) for the consumer web UI. Dependency-free
 * so the storefront stays light. stroke = currentColor unless `color` is given.
 */

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
  style?: CSSProperties;
}

function svgProps({ size = 20, color = 'currentColor', strokeWidth = 2, fill = 'none', style }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill,
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style,
    'aria-hidden': true,
  };
}

export const Heart = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
  </svg>
);

export const Search = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const MapPin = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export const Wallet = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2a2 2 0 0 1 0-4h3" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </svg>
);

export const Bookmark = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" />
  </svg>
);

export const User = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const Sparkles = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M9.94 5.06 12 1l2.06 4.06L18 7l-3.94 1.94L12 13l-2.06-4.06L6 7Z" />
    <path d="M19 14l.9 1.8L21.7 17l-1.8.9L19 19.7l-.9-1.8L16.3 17l1.8-.9Z" />
    <path d="M5 13l.7 1.4L7.1 15l-1.4.7L5 17.1l-.7-1.4L2.9 15l1.4-.7Z" />
  </svg>
);

export const Star = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01Z" />
  </svg>
);

export const Clock = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

export const ChevronRight = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const ArrowRight = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export const X = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export const Phone = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
  </svg>
);

export const Navigation = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M3 11l19-9-9 19-2-8-8-2Z" />
  </svg>
);

export const Share = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="M16 6l-4-4-4 4" />
    <path d="M12 2v13" />
  </svg>
);

export const Check = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const Globe = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
  </svg>
);

export const Instagram = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

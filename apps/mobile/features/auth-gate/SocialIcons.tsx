import Svg, { Path } from 'react-native-svg';

/**
 * Brand glyphs for the social sign-in buttons. Lucide doesn't ship brand logos
 * (trademark), so we draw the official marks as inline SVG — same approach
 * Clerk uses on the web modal, keeping app + web visually parallel.
 *
 * `size` controls the box; brand colors are baked in (Apple/TikTok adapt to a
 * `color` prop so they read on light buttons).
 */

interface IconProps {
  size?: number;
  /** For monochrome marks (Apple, TikTok) on light buttons. */
  color?: string;
}

export function AppleIcon({ size = 20, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M17.05 12.04c-.03-2.6 2.13-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.83 1.3 10.39.86 1.25 1.89 2.66 3.24 2.61 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.28 3.15-2.54.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.73-1.05-2.76-4.16zM14.6 4.39c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.08 3.18 1.15.09 2.32-.58 3.03-1.45z"
      />
    </Svg>
  );
}

export function GoogleIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.07-1.47-.22-2.12H12v3.85h6.34c-.13 1.02-.82 2.56-2.36 3.6l-.02.14 3.43 2.66.24.02c2.18-2.02 3.44-4.99 3.44-8.15z"
      />
      <Path
        fill="#34A853"
        d="M12 23.5c3.12 0 5.74-1.03 7.65-2.8l-3.65-2.83c-.98.68-2.29 1.16-4 1.16-3.05 0-5.64-2.01-6.56-4.79l-.14.01-3.56 2.76-.05.13C3.62 20.83 7.5 23.5 12 23.5z"
      />
      <Path
        fill="#FBBC05"
        d="M5.44 14.24c-.24-.71-.38-1.47-.38-2.24s.14-1.53.37-2.24l-.01-.15-3.6-2.8-.12.06A11.49 11.49 0 0 0 .5 12c0 1.85.45 3.6 1.2 5.16l3.74-2.92z"
      />
      <Path
        fill="#EB4335"
        d="M12 4.97c2.16 0 3.62.93 4.45 1.71l3.25-3.17C17.73 1.66 15.12.5 12 .5 7.5.5 3.62 3.17 1.7 7.08l3.73 2.92C6.36 6.98 8.95 4.97 12 4.97z"
      />
    </Svg>
  );
}

export function FacebookIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#1877F2"
        d="M24 12c0-6.63-5.37-12-12-12S0 5.37 0 12c0 5.99 4.39 10.95 10.13 11.85v-8.38H7.08V12h3.05V9.36c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.23 2.69.23v2.96h-1.52c-1.49 0-1.96.93-1.96 1.87V12h3.33l-.53 3.47h-2.8v8.38C19.61 22.95 24 17.99 24 12z"
      />
    </Svg>
  );
}

export function TikTokIcon({ size = 20, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M16.6 5.82a4.28 4.28 0 0 1-1.06-2.82h-3.2v12.8a2.6 2.6 0 0 1-2.6 2.5 2.6 2.6 0 1 1 .73-5.1V7.93a5.86 5.86 0 0 0-.73-.05A5.84 5.84 0 1 0 15.4 13.7V8.1a7.4 7.4 0 0 0 4.34 1.4V6.3a4.28 4.28 0 0 1-3.14-.48z"
      />
    </Svg>
  );
}

'use client';

import { useState } from 'react';

/**
 * Photo that fades up from a soft blur once it decodes, instead of popping in.
 * The reveal is pure CSS (`.deal-img` → `.is-loaded` in globals.css); this just
 * flips the class on load. Already-cached images fire onLoad synchronously, so
 * they appear instantly with no flash.
 */
export function BlurImage({
  src,
  alt,
  className,
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      className={`deal-img${loaded ? ' is-loaded' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    />
  );
}

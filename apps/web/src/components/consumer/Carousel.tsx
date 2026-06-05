'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { ChevronLeft, ChevronRight } from './icons';

/**
 * Horizontal carousel — swipeable on touch (iPhone), with Airbnb-style
 * prev/next arrow buttons on desktop. Arrows auto-hide at the start/end and on
 * touch devices (where you swipe instead). The track is a native scroll
 * container, so momentum + accessibility come for free.
 */
export function Carousel({ children, ariaLabel }: { children: ReactNode; ariaLabel?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    update();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [update]);

  const page = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <div className="carousel">
      <button
        type="button"
        className="carousel-arrow left"
        data-show={canLeft}
        onClick={() => page(-1)}
        aria-label="Previous"
        tabIndex={canLeft ? 0 : -1}
      >
        <ChevronLeft size={22} />
      </button>
      <div className="carousel-track hide-scrollbar" ref={trackRef} aria-label={ariaLabel}>
        {children}
      </div>
      <button
        type="button"
        className="carousel-arrow right"
        data-show={canRight}
        onClick={() => page(1)}
        aria-label="Next"
        tabIndex={canRight ? 0 : -1}
      >
        <ChevronRight size={22} />
      </button>
    </div>
  );
}

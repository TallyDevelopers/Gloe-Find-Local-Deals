'use client';

import { useEffect, useState } from 'react';

/**
 * Treatments cycled in search placeholders. Kept in lockstep with the native
 * app's SearchBar (apps/mobile/features/discover-header/SearchBar.tsx) so the
 * "try searching for…" hint reads the same on web and in the iPhone app — real,
 * on-brand, short, and a hint of what's actually searchable.
 */
export const CYCLE_WORDS = ['Botox', 'Hydrafacial', 'GLP-1', 'filler', 'lasers', 'CoolSculpting', 'facials', 'microneedling'];

const VISIBLE_MS = 2000; // how long each word shows
const FADE_MS = 280; // crossfade out + in (matches native FADE_MS)

/**
 * Rotates a placeholder string through CYCLE_WORDS (or a custom list), crossfading
 * between words like the native bar. Returns the current `placeholder` text plus a
 * `fading` flag — pair `fading` with a CSS class so the input's ::placeholder
 * fades out, swaps, and fades back in.
 *
 * Pass `paused` (e.g. when the field has text) to freeze cycling — typed input
 * should always win over the hint.
 *
 * @param format wraps each word, e.g. (w) => `Try “${w}”…`
 */
export function useCyclingPlaceholder(format: (word: string) => string, opts?: { paused?: boolean; words?: string[] }) {
  const words = opts?.words ?? CYCLE_WORDS;
  const paused = opts?.paused ?? false;
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (paused) return;
    // Track in-flight swap timers so a mid-fade unmount doesn't setState after teardown.
    const pendingSwaps = new Set<ReturnType<typeof setTimeout>>();
    const id = setInterval(() => {
      // Fade out, swap the word, fade back in.
      setFading(true);
      const swap = setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setFading(false);
        pendingSwaps.delete(swap);
      }, FADE_MS);
      pendingSwaps.add(swap);
    }, VISIBLE_MS);
    return () => {
      clearInterval(id);
      pendingSwaps.forEach(clearTimeout);
    };
  }, [paused, words]);

  return { placeholder: format(words[index] ?? words[0] ?? ''), fading };
}

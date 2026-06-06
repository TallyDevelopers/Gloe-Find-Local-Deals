'use client';

import { useAuth } from '@clerk/nextjs';
import { useState } from 'react';

import { trpc } from '../../lib/trpc';
import { Heart } from './icons';
import { useSignInModal } from './useSignInModal';

/**
 * Heart toggle for deals. Signed-in users toggle saved state (one shared
 * `saved.listIds` query feeds every card); signed-out users are routed to
 * sign-in with a return path. Renders as a floating circular button by default.
 */
export function SaveButton({
  dealId,
  size = 'md',
  variant = 'floating',
}: {
  dealId: string;
  size?: 'sm' | 'md';
  variant?: 'floating' | 'bare';
}) {
  const { isSignedIn } = useAuth();
  const openSignIn = useSignInModal();
  const utils = trpc.useUtils();
  const savedIds = trpc.saved.listIds.useQuery(undefined, { enabled: !!isSignedIn });
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const serverSaved = savedIds.data?.includes(dealId) ?? false;
  const isSaved = optimistic ?? serverSaved;

  const toggle = trpc.saved.toggle.useMutation({
    onSettled: () => {
      void utils.saved.listIds.invalidate();
      setOptimistic(null);
    },
  });

  const dim = size === 'sm' ? 30 : 38;
  const icon = size === 'sm' ? 15 : 18;

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    setOptimistic(!isSaved);
    toggle.mutate({ dealId });
  }

  const floating: React.CSSProperties =
    variant === 'floating'
      ? {
          width: dim,
          height: dim,
          borderRadius: 'var(--radius-pill)',
          background: 'var(--surface-elevated)',
          boxShadow: '0 2px 10px rgba(43,32,25,0.18)',
        }
      : { width: dim, height: dim, borderRadius: 'var(--radius-pill)', background: 'transparent' };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isSaved ? 'Remove from saved' : 'Save'}
      aria-pressed={isSaved}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        cursor: 'pointer',
        transition: 'transform 0.12s ease',
        ...floating,
      }}
    >
      <Heart
        size={icon}
        color={isSaved ? 'var(--accent-500)' : 'var(--text-primary)'}
        fill={isSaved ? 'var(--accent-500)' : 'none'}
        strokeWidth={2.25}
      />
    </button>
  );
}

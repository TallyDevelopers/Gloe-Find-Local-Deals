import { useAuth } from '@gloe/auth';
import { trpc } from '@gloe/api-client';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

interface SavedDealsContextValue {
  savedIds: Set<string>;
  isSaved: (dealId: string) => boolean;
  toggle: (dealId: string) => void;
  count: number;
  isLoading: boolean;
}

const SavedDealsContext = createContext<SavedDealsContextValue | null>(null);

/**
 * API-backed saved deals. Reads via tRPC saved.listIds, mutates via
 * saved.toggle with optimistic updates so the heart flips instantly.
 *
 * Anonymous users see an empty set; saving a deal opens the auth gate
 * elsewhere in the app via useRequireAuth before reaching this provider.
 */
export function SavedDealsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const isSignedIn = status === 'signed-in';
  const utils = trpc.useUtils();

  const listIdsQuery = trpc.saved.listIds.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const toggleMutation = trpc.saved.toggle.useMutation({
    onMutate: async ({ dealId }) => {
      await utils.saved.listIds.cancel();
      const previous = utils.saved.listIds.getData();
      utils.saved.listIds.setData(undefined, (old) => {
        const current = old ?? [];
        if (current.includes(dealId)) return current.filter((id) => id !== dealId);
        return [dealId, ...current];
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) utils.saved.listIds.setData(undefined, ctx.previous);
    },
    onSettled: () => {
      utils.saved.listIds.invalidate();
    },
  });

  const savedIds = useMemo(() => new Set(listIdsQuery.data ?? []), [listIdsQuery.data]);

  const isSaved = useCallback((dealId: string) => savedIds.has(dealId), [savedIds]);

  const toggle = useCallback(
    (dealId: string) => {
      if (!isSignedIn) return;
      toggleMutation.mutate({ dealId });
    },
    [isSignedIn, toggleMutation],
  );

  const value = useMemo<SavedDealsContextValue>(
    () => ({
      savedIds,
      isSaved,
      toggle,
      count: savedIds.size,
      isLoading: listIdsQuery.isLoading,
    }),
    [savedIds, isSaved, toggle, listIdsQuery.isLoading],
  );

  return <SavedDealsContext.Provider value={value}>{children}</SavedDealsContext.Provider>;
}

export function useSavedDeals() {
  const ctx = useContext(SavedDealsContext);
  if (!ctx) throw new Error('useSavedDeals must be used inside <SavedDealsProvider>');
  return ctx;
}

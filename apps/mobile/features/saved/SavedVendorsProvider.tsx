import { useAuth } from '@gloe/auth';
import { trpc } from '@gloe/api-client';
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

interface SavedVendorsContextValue {
  savedIds: Set<string>;
  isSaved: (vendorId: string) => boolean;
  toggle: (vendorId: string) => void;
  count: number;
  isLoading: boolean;
}

const SavedVendorsContext = createContext<SavedVendorsContextValue | null>(null);

/**
 * API-backed saved vendors. Mirrors SavedDealsProvider's shape so callers
 * can drop it in anywhere they have a vendor id.
 *
 * Reads via tRPC saved.listVendorIds (cheap — just IDs for heart state).
 * The Saved → Spas list view uses saved.listVendors separately, which
 * returns full card data.
 */
export function SavedVendorsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const isSignedIn = status === 'signed-in';
  const utils = trpc.useUtils();

  const listIdsQuery = trpc.saved.listVendorIds.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const toggleMutation = trpc.saved.toggleVendor.useMutation({
    onMutate: async ({ vendorId }) => {
      // Optimistic for both the id-set (heart state) AND the card list, so
      // un-saving from the Spas tab removes the row immediately.
      await utils.saved.listVendorIds.cancel();
      await utils.saved.listVendors.cancel();
      const previousIds = utils.saved.listVendorIds.getData();
      const previousList = utils.saved.listVendors.getData();
      utils.saved.listVendorIds.setData(undefined, (old) => {
        const current = old ?? [];
        if (current.includes(vendorId)) return current.filter((id) => id !== vendorId);
        return [vendorId, ...current];
      });
      utils.saved.listVendors.setData(undefined, (old) => {
        const current = old ?? [];
        if (current.some((c) => c.vendorId === vendorId)) {
          return current.filter((c) => c.vendorId !== vendorId);
        }
        // No card data to insert here — server will refetch with real fields
        // (rating, image, etc) on settle. Return current to avoid jitter.
        return current;
      });
      return { previousIds, previousList };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousIds) utils.saved.listVendorIds.setData(undefined, ctx.previousIds);
      if (ctx?.previousList) utils.saved.listVendors.setData(undefined, ctx.previousList);
    },
    onSettled: () => {
      utils.saved.listVendorIds.invalidate();
      utils.saved.listVendors.invalidate();
    },
  });

  const savedIds = useMemo(() => new Set(listIdsQuery.data ?? []), [listIdsQuery.data]);
  const isSaved = useCallback((vendorId: string) => savedIds.has(vendorId), [savedIds]);

  const toggle = useCallback(
    (vendorId: string) => {
      if (!isSignedIn) return;
      // Haptic only on save (matches saved-deals behavior).
      if (!savedIds.has(vendorId)) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      toggleMutation.mutate({ vendorId });
    },
    [isSignedIn, savedIds, toggleMutation],
  );

  const value = useMemo<SavedVendorsContextValue>(
    () => ({
      savedIds,
      isSaved,
      toggle,
      count: savedIds.size,
      isLoading: listIdsQuery.isLoading,
    }),
    [savedIds, isSaved, toggle, listIdsQuery.isLoading],
  );

  return <SavedVendorsContext.Provider value={value}>{children}</SavedVendorsContext.Provider>;
}

export function useSavedVendors() {
  const ctx = useContext(SavedVendorsContext);
  if (!ctx) throw new Error('useSavedVendors must be used inside <SavedVendorsProvider>');
  return ctx;
}

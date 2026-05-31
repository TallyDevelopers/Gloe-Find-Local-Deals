import { useAuth } from '@gloe/auth';
import { trpc, type RouterOutputs } from '@gloe/api-client';
import * as Notifications from 'expo-notifications';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type NotifPermission = 'granted' | 'denied' | 'undetermined';

/** One ticket row as returned by support.list. */
export type SupportTicketSummary = RouterOutputs['support']['list'][number];

interface SupportContextValue {
  tickets: SupportTicketSummary[];
  unreadCount: number;
  notifPermission: NotifPermission;
  isLoading: boolean;
  refetch: () => void;
}

const SupportContext = createContext<SupportContextValue | null>(null);

/**
 * API-backed support inbox. Reads ticket list via support.list and the
 * unread badge count via support.unreadCount, both gated on auth.
 *
 * Reads the local push-notification permission once on mount so screens can
 * prompt the user to enable replies-as-notifications without re-querying.
 */
export function SupportProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const isSignedIn = status === 'signed-in';

  const listQuery = trpc.support.list.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const unreadCountQuery = trpc.support.unreadCount.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const [notifPermission, setNotifPermission] = useState<NotifPermission>('undetermined');

  useEffect(() => {
    let cancelled = false;
    Notifications.getPermissionsAsync()
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'granted') setNotifPermission('granted');
        else if (result.status === 'denied') setNotifPermission('denied');
        else setNotifPermission('undetermined');
      })
      .catch(() => {
        // Permission lookup can fail in environments without a notification
        // service (e.g. simulator without push support) — leave as undetermined.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<SupportContextValue>(
    () => ({
      tickets: listQuery.data ?? [],
      unreadCount: unreadCountQuery.data ?? 0,
      notifPermission,
      isLoading: listQuery.isLoading,
      refetch: () => {
        listQuery.refetch();
        unreadCountQuery.refetch();
      },
    }),
    [listQuery.data, listQuery.isLoading, unreadCountQuery.data, notifPermission, listQuery, unreadCountQuery],
  );

  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>;
}

export function useSupport() {
  const ctx = useContext(SupportContext);
  if (!ctx) throw new Error('useSupport must be used inside <SupportProvider>');
  return ctx;
}

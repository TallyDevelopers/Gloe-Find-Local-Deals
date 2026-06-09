import { trpc } from '@gloe/api-client';
import { useAuth } from '@gloe/auth';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Push notification registration. Mounted once at the top of the app tree.
 *
 * Flow:
 *   1. Signed-in user → request permission (system shows prompt; user may
 *      have already granted/denied historically — that's fine, idempotent).
 *   2. If granted → grab the device token from Expo (which gets the real
 *      APNs token under the hood).
 *   3. Upsert that token to the API, keyed by user.
 *   4. Re-runs whenever the user changes (sign-in / sign-out across accounts
 *      on the same device).
 *
 * Permission UX: we ask LAZILY — only after the user is signed in, NOT on
 * cold launch as an anonymous user. That's the Apple-blessed pattern (ask
 * once you have a reason).
 */
export function usePushRegistration() {
  const { status } = useAuth();
  const router = useRouter();
  // `undefined` until the root navigator has mounted. On a COLD start (app
  // launched by tapping a push), our handler used to fire before the navigator
  // existed AND before app/index.tsx's `<Redirect href="/discover">` ran — so
  // the deep-link nav was swallowed/overwritten by the redirect and the user
  // landed on Discover, not the chat. We hold any pending deep link until nav
  // is ready, then flush it (so it stacks on top of Discover with a back
  // button). Warm taps already have nav mounted, but route through the same
  // gate for consistency.
  const navState = useRootNavigationState();
  const navReady = !!navState?.key;
  const register = trpc.devices.register.useMutation();
  const lastRegisteredToken = useRef<string | null>(null);
  // A deep-link target captured before nav was ready, awaiting flush.
  const pendingDeepLink = useRef<string | null>(null);
  // Guard so a given cold-start response is only ever consumed once.
  const handledColdStart = useRef(false);

  // Map a tapped notification's data payload → an in-app route. APNs payload
  // `data` is spread FLAT alongside `aps`, so we read data.type/ticketId at the
  // top level. Returns null when the push isn't a deep-linkable type.
  const routeFor = useCallback((data: Record<string, unknown> | undefined): string | null => {
    if (!data) return null;
    if (data.type === 'support_reply' && typeof data.ticketId === 'string') {
      return `/(app)/support/${data.ticketId}`;
    }
    // Post-redemption review nudge (only sent when admin enables the push).
    // Land on the voucher and auto-open the review sheet via ?review=1.
    if (data.type === 'review_prompt' && typeof data.claimId === 'string') {
      return `/(app)/my-deal/${data.claimId}?review=1`;
    }
    // "Your friend booked the gift you paid for" — open the deal they booked.
    if (data.type === 'gift_booked' && typeof data.dealId === 'string') {
      return `/(app)/deal/${data.dealId}`;
    }
    return null;
  }, []);

  // Either navigate now (nav ready) or stash for the flush effect below.
  const goOrQueue = useCallback(
    (route: string | null) => {
      if (!route) return;
      if (navReady) router.push(route as never);
      else pendingDeepLink.current = route;
    },
    [navReady, router],
  );

  // Subscribe to taps + read the cold-start response ONCE. Re-runs when nav
  // becomes ready so a deep link captured pre-ready gets flushed.
  useEffect(() => {
    // Cold start: app launched by tapping a notification. Consume it once.
    if (!handledColdStart.current) {
      handledColdStart.current = true;
      Notifications.getLastNotificationResponseAsync().then((response) => {
        goOrQueue(routeFor(response?.notification.request.content.data as Record<string, unknown> | undefined));
      });
    }
    // Flush a deep link captured before nav was ready.
    if (navReady && pendingDeepLink.current) {
      const route = pendingDeepLink.current;
      pendingDeepLink.current = null;
      router.push(route as never);
    }
    // Warm: tapped while the app was backgrounded/foregrounded (nav is mounted).
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      goOrQueue(routeFor(response.notification.request.content.data as Record<string, unknown> | undefined));
    });
    return () => sub.remove();
  }, [navReady, router, routeFor, goOrQueue]);

  useEffect(() => {
    if (status !== 'signed-in') return;
    if (!Device.isDevice) return; // simulators don't get APNs tokens

    let cancelled = false;

    (async () => {
      try {
        // Configure default presentation (banner + sound when app is foregrounded).
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });

        // Ask once. iOS only shows the prompt on first request; subsequent
        // calls just return the cached status.
        const existing = await Notifications.getPermissionsAsync();
        let finalStatus = existing.status;
        if (existing.status !== 'granted') {
          const requested = await Notifications.requestPermissionsAsync();
          finalStatus = requested.status;
        }
        if (finalStatus !== 'granted') return;

        // getDevicePushTokenAsync returns the raw APNs token on iOS, which is
        // what our server uses (we send through Apple's HTTP/2 API directly,
        // not Expo Push). On Android it's the FCM registration token.
        const tokenInfo = await Notifications.getDevicePushTokenAsync();
        const token = tokenInfo.data;
        if (cancelled || typeof token !== 'string' || !token) return;

        // Dedupe — no need to hammer the API on every effect run if the token
        // didn't change.
        if (lastRegisteredToken.current === token) return;
        await register.mutateAsync({
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          token,
        });
        lastRegisteredToken.current = token;
      } catch (e) {
        // Silent: pushes are nice-to-have, not critical to app function.
        // Log so we see it in dev but don't surface to the user.
        if (__DEV__) console.warn('Push registration failed:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // NOTE: intentionally depend only on `status`. `register` is a tRPC mutation
    // object whose identity changes on every render (its state updates as the
    // mutation runs), so including it here caused an infinite re-registration
    // loop — each register() → state change → re-render → effect re-fires. The
    // mutation's `mutateAsync` is stable, so excluding it is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
}

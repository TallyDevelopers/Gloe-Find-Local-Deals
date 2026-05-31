import { trpc } from '@gloe/api-client';
import { useAuth } from '@gloe/auth';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
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
  const register = trpc.devices.register.useMutation();
  const lastRegisteredToken = useRef<string | null>(null);

  // Notification-tap deep links. APNs payload `data` is spread FLAT alongside
  // `aps`, so we read data.type / data.ticketId at the top level. Mounted once;
  // handles both a tap while running and the cold-start tap (getLastResponse).
  useEffect(() => {
    function handle(data: Record<string, unknown> | undefined) {
      if (!data) return;
      if (data.type === 'support_reply' && typeof data.ticketId === 'string') {
        router.push(`/(app)/support/${data.ticketId}`);
      }
    }
    // Cold start: app launched by tapping a notification.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      handle(response?.notification.request.content.data as Record<string, unknown> | undefined);
    });
    // Warm: tapped while the app was backgrounded/foregrounded.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handle(response.notification.request.content.data as Record<string, unknown> | undefined);
    });
    return () => sub.remove();
  }, [router]);

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
  }, [status, register]);
}

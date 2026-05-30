import { radius, shadow, space, Stack, Text, useTheme } from '@gloe/ui';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Lightweight, brand-styled toast. Sits above the status bar, slides down,
 * auto-dismisses after 3s. Tap a toast to fire its optional action.
 *
 * Use `useToast()` anywhere under `<ToastProvider>` (wired in GloeProviders).
 *   const toast = useToast();
 *   toast.show({ kind: 'success', message: 'Added to Apple Wallet', action: { label: 'Open Wallet', onPress: () => Linking.openURL('shoebox://') } });
 */

type ToastKind = 'success' | 'error' | 'info';

interface ToastShowInput {
  kind?: ToastKind;
  message: string;
  /** Optional secondary line (e.g. CTA label). Tapping the toast fires action.onPress. */
  action?: { label: string; onPress: () => void };
  /** Override the default 3000ms display time. */
  durationMs?: number;
}

interface ToastContextValue {
  show: (input: ToastShowInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastShowInput | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((input: ToastShowInput) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setCurrent(input);
    const ms = input.durationMs ?? 3000;
    dismissTimer.current = setTimeout(() => setCurrent(null), ms);
  }, []);

  useEffect(
    () => () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {current ? <ToastView toast={current} onDismiss={() => setCurrent(null)} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

function ToastView({ toast, onDismiss }: { toast: ToastShowInput; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const { color: palette } = useTheme();
  const slide = useRef(new Animated.Value(0)).current;

  // Fade + slide in on mount, slide out on unmount. Driven natively so it
  // stays smooth even when the JS thread is busy.
  useEffect(() => {
    Animated.timing(slide, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    return () => {
      Animated.timing(slide, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    };
  }, [slide]);

  const kind = toast.kind ?? 'info';
  const accent =
    kind === 'success'
      ? palette.semantic.success
      : kind === 'error'
        ? palette.semantic.error
        : palette.brand[500];

  const onPress = () => {
    toast.action?.onPress();
    onDismiss();
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 6,
        left: space[4],
        right: space[4],
        opacity: slide,
        transform: [
          {
            translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }),
          },
        ],
        zIndex: 9999,
      }}
    >
      <Pressable
        onPress={toast.action ? onPress : onDismiss}
        style={{
          backgroundColor: palette.surface.elevated,
          borderRadius: radius.lg,
          paddingVertical: space[3],
          paddingHorizontal: space[4],
          ...shadow.md,
          borderLeftWidth: 4,
          borderLeftColor: accent,
        }}
      >
        <Stack direction="row" gap={3} align="center">
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="caption" weight="semibold" style={{ color: palette.text.inverse }}>
              {kind === 'success' ? '✓' : kind === 'error' ? '!' : 'i'}
            </Text>
          </View>
          <Stack gap={0} flex={1}>
            <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={1}>
              {toast.message}
            </Text>
            {toast.action ? (
              <Text variant="caption" tone="brand" weight="semibold">
                {toast.action.label} →
              </Text>
            ) : null}
          </Stack>
        </Stack>
      </Pressable>
    </Animated.View>
  );
}

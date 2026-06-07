import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { radius, space } from './tokens';
import { useTheme } from './theme';

export interface BottomSheetProps {
  /** Whether the sheet is open. Driving this false plays the exit animation, then unmounts. */
  open: boolean;
  /** Called once the sheet has finished animating closed (after backdrop tap, etc.). */
  onClose: () => void;
  children: ReactNode;

  /**
   * Wrap the sheet in a KeyboardAvoidingView so text inputs stay above the
   * keyboard. Off by default — only sheets with inputs need it.
   */
  keyboardAvoiding?: boolean;
  /**
   * Whether tapping the dimmed backdrop dismisses the sheet. Default true. Set
   * false for data-entry sheets (e.g. leaving a review) where a stray tap would
   * throw away unsaved work — those should only close via an explicit button.
   */
  dismissOnBackdrop?: boolean;
  /** Cap the sheet height (e.g. '85%'). Defaults to '92%'. Pass a number for px. */
  maxHeight?: ViewStyle['maxHeight'];
  /** Hide the grab handle at the top of the sheet. Shown by default. */
  hideHandle?: boolean;
  /** Style applied to the sheet container (the rounded card). */
  style?: StyleProp<ViewStyle>;
}

const HIDDEN_OFFSET = 900; // Far enough below the screen that the sheet is fully off, any device.

/**
 * The app's one bottom-sheet. A transparent native Modal with NO native
 * animation (`animationType="none"`) — instead we slide the sheet card up and
 * fade the backdrop in with `Animated`. This is the cure for the "black space
 * slides up under the sheet" flash: RN's built-in `animationType="slide"` on a
 * transparent modal slides the *whole modal frame* up over an opaque black
 * window root, so you see black where the modal hasn't arrived yet. By driving
 * the animation ourselves over a transparent root, there's nothing black to
 * show. `statusBarTranslucent` keeps the status-bar strip from compositing
 * black during the transition too.
 *
 * The sheet stays mounted through its exit animation (tracked by `rendered`)
 * so closing animates out instead of snapping away.
 *
 * Behavior is identical to the hand-rolled sheets it replaces: tap the backdrop
 * to dismiss; the sheet itself swallows taps. No drag-to-dismiss (by design).
 */
export function BottomSheet({
  open,
  onClose,
  children,
  keyboardAvoiding = false,
  dismissOnBackdrop = true,
  maxHeight = '92%',
  hideHandle = false,
  style,
}: BottomSheetProps) {
  const { color: palette } = useTheme();
  const translateY = useRef(new Animated.Value(HIDDEN_OFFSET)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Keep the Modal mounted while animating out, then drop it. Starts matching
  // `open` so an initially-open sheet renders immediately.
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    if (open) {
      setRendered(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 280 }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: HIDDEN_OFFSET, useNativeDriver: true, damping: 28, stiffness: 280 }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
    // `rendered` intentionally omitted: it's set inside this effect and including
    // it would re-trigger the animation on the closing transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, translateY, overlayOpacity]);

  if (!rendered) return null;

  const dismiss = () => {
    Keyboard.dismiss();
    onClose();
  };

  // Backdrop tap: for normal sheets it closes; for data-entry sheets it only
  // drops the keyboard (so the form stays put — a stray tap can't nuke the work).
  const onBackdropPress = dismissOnBackdrop ? dismiss : () => Keyboard.dismiss();

  const sheet = (
    <>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: palette.surface.overlay,
          opacity: overlayOpacity,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onBackdropPress} />
      </Animated.View>

      <Animated.View
        style={[
          {
            transform: [{ translateY }],
            backgroundColor: palette.surface.primary,
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            paddingTop: space[3],
            maxHeight,
          },
          style,
        ]}
      >
        {!hideHandle ? (
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: palette.border.default,
              marginBottom: space[3],
            }}
          />
        ) : null}
        {children}
      </Animated.View>
    </>
  );

  // Keyboard handling: on iOS we rely on the inner ScrollView's
  // `automaticallyAdjustKeyboardInsets` (set in BottomSheetScrollView) to inset
  // the content and scroll the focused field into view — that's the reliable
  // path inside a translucent modal. We deliberately do NOT also wrap in a
  // padding-behavior KeyboardAvoidingView on iOS: the two stack and double-lift
  // (input shoots up, leaving a gap). On Android, KAV `height` is still the
  // right tool since automaticallyAdjustKeyboardInsets is iOS-only.
  const needsAndroidKav = keyboardAvoiding && Platform.OS === 'android';
  return (
    <Modal transparent statusBarTranslucent animationType="none" visible onRequestClose={dismiss}>
      {needsAndroidKav ? (
        <KeyboardAvoidingView behavior="height" style={{ flex: 1, justifyContent: 'flex-end' }}>
          {sheet}
        </KeyboardAvoidingView>
      ) : (
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>{sheet}</View>
      )}
    </Modal>
  );
}

/**
 * A scrollable body for a BottomSheet — most sheets put their content in one.
 * Thin wrapper over ScrollView with the persistent-taps + hidden-indicator
 * defaults every sheet was setting by hand.
 */
export function BottomSheetScrollView({
  children,
  contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // iOS automatically insets the scroll content by the keyboard height and
      // scrolls the focused TextInput into view — this is what actually keeps
      // what you're typing visible inside a bottom sheet (the KeyboardAvoiding
      // wrapper alone under-lifts on a translucent modal). No-op on Android.
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      contentContainerStyle={contentContainerStyle}
    >
      {children}
    </ScrollView>
  );
}

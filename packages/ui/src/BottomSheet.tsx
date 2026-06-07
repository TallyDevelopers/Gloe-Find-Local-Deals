import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Keyboard,
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
  // How far the keyboard pushes the whole sheet up. We translate the entire
  // sheet card by this — so title, input, and buttons move together as one
  // piece and nothing gets cut off or hidden behind the keyboard.
  const keyboardLift = useRef(new Animated.Value(0)).current;

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
      // Drop the keyboard the instant we start closing — otherwise it lingers
      // for a beat after the sheet has slid away (it'd only dismiss once the
      // TextInput unmounts). Dismissing here lets the keyboard animate out in
      // sync with the sheet.
      Keyboard.dismiss();
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

  // Slide the WHOLE sheet up by the keyboard height when a field is focused, so
  // the entire form (title → input → buttons) clears the keyboard as one unit.
  // We follow the keyboard's own show/hide events + duration so the sheet rides
  // up perfectly in sync with it. iOS uses keyboardWillShow (fires before the
  // keyboard animates); Android only has keyboardDidShow.
  useEffect(() => {
    if (!keyboardAvoiding) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: { endCoordinates: { height: number }; duration?: number }) => {
      Animated.timing(keyboardLift, {
        toValue: e.endCoordinates.height,
        duration: e.duration ?? 250,
        useNativeDriver: true,
      }).start();
    };
    const onHide = (e: { duration?: number }) => {
      Animated.timing(keyboardLift, {
        toValue: 0,
        duration: e.duration ?? 250,
        useNativeDriver: true,
      }).start();
    };
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [keyboardAvoiding, keyboardLift]);

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
            // Entry slide (translateY) combined with the keyboard lift: subtract
            // keyboardLift so the whole sheet rides UP above the keyboard as one
            // piece — nothing cut off, no internal scroll needed.
            transform: [
              { translateY: Animated.subtract(translateY, keyboardLift) },
            ],
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

  // Keyboard handling lives in the keyboardLift effect above: when
  // keyboardAvoiding is set, the whole sheet translates up by the keyboard
  // height so the entire form clears it as one piece. No KeyboardAvoidingView,
  // no scroll-inset tricks — those cut the title off the top or hid the buttons.
  return (
    <Modal transparent statusBarTranslucent animationType="none" visible onRequestClose={dismiss}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>{sheet}</View>
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
      contentContainerStyle={contentContainerStyle}
    >
      {children}
    </ScrollView>
  );
}

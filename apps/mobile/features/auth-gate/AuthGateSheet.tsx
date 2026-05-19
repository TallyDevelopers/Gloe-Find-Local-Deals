import { Button, Stack, Text, color, radius, space } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  View,
  useAnimatedValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AuthGatePrompt } from './types';

interface AuthGateSheetProps {
  prompt: AuthGatePrompt | null;
  onClose: () => void;
}

export function AuthGateSheet({ prompt, onClose }: AuthGateSheetProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const translateY = useAnimatedValue(800);
  const overlayOpacity = useAnimatedValue(0);

  useEffect(() => {
    if (prompt) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 280,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [prompt, translateY, overlayOpacity]);

  const handleClose = () => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 800,
        useNativeDriver: true,
        damping: 28,
        stiffness: 280,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const goToLogin = () => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 800, useNativeDriver: true, damping: 28, stiffness: 280 }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      onClose();
      router.push('/(auth)/login');
    });
  };

  const goToSignup = () => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 800, useNativeDriver: true, damping: 28, stiffness: 280 }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      onClose();
      router.push('/(auth)/signup');
    });
  };

  if (!prompt) return null;

  return (
    <Modal transparent animationType="none" visible={prompt !== null} onRequestClose={handleClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: color.surface.overlay,
            opacity: overlayOpacity,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={{
            transform: [{ translateY }],
            backgroundColor: color.surface.primary,
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            paddingTop: space[4],
            paddingHorizontal: space[6],
            paddingBottom: insets.bottom + space[6],
          }}
        >
          {/* Drag handle */}
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: color.neutral[300],
              marginBottom: space[6],
            }}
          />

          <Stack gap={6}>
            <Stack gap={2}>
              <Text variant="display-sm" tone="primary" weight="medium">
                {prompt.title}
              </Text>
              <Text variant="body-md" tone="secondary">
                {prompt.description}
              </Text>
            </Stack>

            <Stack gap={3}>
              <Button label="Create an account" size="lg" fullWidth onPress={goToSignup} />
              <Button label="I already have an account" variant="secondary" size="lg" fullWidth onPress={goToLogin} />
              <Button label="Not now" variant="ghost" size="md" fullWidth onPress={handleClose} />
            </Stack>
          </Stack>
        </Animated.View>
      </View>
    </Modal>
  );
}

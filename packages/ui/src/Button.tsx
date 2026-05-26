import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { motion, radius, space, type ColorPalette } from './tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

interface ButtonVariantStyle {
  background: string;
  backgroundPressed: string;
  border: string | undefined;
  textTone: React.ComponentProps<typeof Text>['tone'];
}

function buildVariantStyles(palette: ColorPalette): Record<ButtonVariant, ButtonVariantStyle> {
  return {
    primary: {
      background: palette.brand[500],
      backgroundPressed: palette.brand[600],
      border: undefined,
      textTone: 'inverse',
    },
    secondary: {
      background: palette.surface.elevated,
      backgroundPressed: palette.surface.secondary,
      border: palette.border.default,
      textTone: 'primary',
    },
    ghost: {
      background: 'transparent',
      backgroundPressed: palette.surface.secondary,
      border: undefined,
      textTone: 'primary',
    },
    destructive: {
      background: palette.semantic.error,
      backgroundPressed: '#933737',
      border: undefined,
      textTone: 'inverse',
    },
  };
}

interface ButtonSizeStyle {
  paddingV: number;
  paddingH: number;
  minHeight: number;
  textVariant: React.ComponentProps<typeof Text>['variant'];
}

const sizeStyles: Record<ButtonSize, ButtonSizeStyle> = {
  sm: {
    paddingV: space[2],
    paddingH: space[4],
    minHeight: 36,
    textVariant: 'body-sm',
  },
  md: {
    paddingV: space[3],
    paddingH: space[5],
    minHeight: 48,
    textVariant: 'body-md',
  },
  lg: {
    paddingV: space[4],
    paddingH: space[6],
    minHeight: 56,
    textVariant: 'body-lg',
  },
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading,
  fullWidth,
  leftIcon,
  rightIcon,
  disabled,
  onPress,
  ...rest
}: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const { color: palette } = useTheme();
  const v = buildVariantStyles(palette)[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      damping: motion.spring.snappy.damping,
      stiffness: motion.spring.snappy.stiffness,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      damping: motion.spring.snappy.damping,
      stiffness: motion.spring.snappy.stiffness,
    }).start();
  };

  const handlePress = (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  return (
    <Animated.View style={{ transform: [{ scale }], width: fullWidth ? '100%' : undefined }}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={({ pressed }): ViewStyle => ({
          backgroundColor: pressed ? v.backgroundPressed : v.background,
          borderRadius: radius.pill,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          minHeight: s.minHeight,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[2],
          opacity: isDisabled ? 0.5 : 1,
        })}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator
            color={v.textTone === 'inverse' ? palette.text.inverse : palette.text.primary}
            size="small"
          />
        ) : (
          <>
            {leftIcon}
            <Text variant={s.textVariant} tone={v.textTone} weight="semibold">
              {label}
            </Text>
            {rightIcon}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

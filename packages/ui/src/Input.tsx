import { useState } from 'react';
import {
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text';
import { color, fontFamily, fontSize, radius, space } from './tokens';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? color.semantic.error
    : focused
      ? color.brand[500]
      : color.border.default;

  return (
    <View style={[{ gap: space[2] }, containerStyle]}>
      {label ? (
        <Text variant="label" tone="secondary">
          {label}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          backgroundColor: color.surface.elevated,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor,
          paddingHorizontal: space[4],
          minHeight: 52,
        }}
      >
        {leftIcon}
        <TextInput
          style={{
            flex: 1,
            fontFamily: fontFamily.body,
            fontSize: fontSize.base,
            color: color.text.primary,
            paddingVertical: space[3],
          }}
          placeholderTextColor={color.text.tertiary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightIcon}
      </View>

      {error ? (
        <Text variant="caption" tone="error">
          {error}
        </Text>
      ) : helperText ? (
        <Text variant="caption" tone="tertiary">
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

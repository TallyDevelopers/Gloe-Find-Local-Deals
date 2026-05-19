import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { color, fontFamily, fontSize, fontWeight, lineHeight } from './tokens';

type TextVariant =
  | 'display-xl'
  | 'display-lg'
  | 'display-md'
  | 'display-sm'
  | 'body-lg'
  | 'body-md'
  | 'body-sm'
  | 'caption'
  | 'label';

type TextColor = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'link' | 'brand' | 'error';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextColor;
  weight?: keyof typeof fontWeight;
  align?: 'left' | 'center' | 'right';
}

const variantStyles: Record<TextVariant, TextStyle> = {
  'display-xl': {
    fontFamily: fontFamily.display,
    fontSize: fontSize['5xl'],
    lineHeight: fontSize['5xl'] * lineHeight.tight,
    fontWeight: fontWeight.medium,
  },
  'display-lg': {
    fontFamily: fontFamily.display,
    fontSize: fontSize['4xl'],
    lineHeight: fontSize['4xl'] * lineHeight.tight,
    fontWeight: fontWeight.medium,
  },
  'display-md': {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    lineHeight: fontSize['3xl'] * lineHeight.tight,
    fontWeight: fontWeight.medium,
  },
  'display-sm': {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * lineHeight.tight,
    fontWeight: fontWeight.medium,
  },
  'body-lg': {
    fontFamily: fontFamily.body,
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * lineHeight.relaxed,
    fontWeight: fontWeight.regular,
  },
  'body-md': {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.relaxed,
    fontWeight: fontWeight.regular,
  },
  'body-sm': {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    fontWeight: fontWeight.regular,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * lineHeight.normal,
    fontWeight: fontWeight.regular,
  },
  label: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.2,
  },
};

const toneColors: Record<TextColor, string> = {
  primary: color.text.primary,
  secondary: color.text.secondary,
  tertiary: color.text.tertiary,
  inverse: color.text.inverse,
  link: color.text.link,
  brand: color.brand[500],
  error: color.semantic.error,
};

export function Text({
  variant = 'body-md',
  tone = 'primary',
  weight,
  align,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      style={[
        variantStyles[variant],
        { color: toneColors[tone] },
        weight ? { fontWeight: fontWeight[weight] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}

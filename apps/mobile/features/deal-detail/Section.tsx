import { Stack, Text, space, useTheme } from '@gloe/ui';
import type { ReactNode } from 'react';
import { View } from 'react-native';

interface SectionProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

/**
 * Standard content section on the deal detail screen. Title + content with
 * consistent spacing and a subtle divider above.
 */
export function Section({ title, children, action }: SectionProps) {
  const { color: palette } = useTheme();
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: palette.border.subtle,
        paddingTop: space[6],
        gap: space[4],
      }}
    >
      <Stack direction="row" justify="space-between" align="center">
        <Text variant="display-sm" tone="primary" weight="medium">
          {title}
        </Text>
        {action}
      </Stack>
      {children}
    </View>
  );
}

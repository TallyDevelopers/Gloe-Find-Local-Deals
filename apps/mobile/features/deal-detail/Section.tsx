import { Stack, Text, color, space } from '@gloe/ui';
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
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: color.border.subtle,
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

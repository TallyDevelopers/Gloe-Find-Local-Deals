import { View, type ViewProps } from 'react-native';

import { space } from './tokens';

type SpaceKey = keyof typeof space;

export interface StackProps extends ViewProps {
  direction?: 'row' | 'column';
  gap?: SpaceKey;
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  padding?: SpaceKey;
  paddingX?: SpaceKey;
  paddingY?: SpaceKey;
  flex?: number;
}

export function Stack({
  direction = 'column',
  gap = 0,
  align,
  justify,
  padding,
  paddingX,
  paddingY,
  flex,
  style,
  ...rest
}: StackProps) {
  return (
    <View
      style={[
        {
          flexDirection: direction,
          gap: space[gap],
        },
        align ? { alignItems: align } : null,
        justify ? { justifyContent: justify } : null,
        padding !== undefined ? { padding: space[padding] } : null,
        paddingX !== undefined ? { paddingHorizontal: space[paddingX] } : null,
        paddingY !== undefined ? { paddingVertical: space[paddingY] } : null,
        flex !== undefined ? { flex } : null,
        style,
      ]}
      {...rest}
    />
  );
}

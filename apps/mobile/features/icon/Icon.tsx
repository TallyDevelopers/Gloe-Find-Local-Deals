import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  type LucideProps,
  MapPin,
  MessageSquare,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  User,
  X,
} from 'lucide-react-native';
import type { ComponentType } from 'react';

/**
 * Single seam for app icons. Importing screens use `<Icon name="search" .../>`
 * — never reference Lucide directly. Lets us swap icon libraries later by
 * changing only this file.
 */
const ICONS = {
  // Header / navigation
  search: Search,
  pin: MapPin,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  filters: SlidersHorizontal,
  close: X,

  // Actions
  heart: Heart,
  share: Share2,

  // Bottom tabs
  'tab.discover': Sparkles,
  'tab.saved': Heart,
  'tab.messages': MessageSquare,
  'tab.profile': User,
} satisfies Record<string, ComponentType<LucideProps>>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** For active/filled states (e.g. heart when saved). */
  fill?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, color, fill = 'none', strokeWidth = 2 }: IconProps) {
  const LucideIcon = ICONS[name];
  return <LucideIcon size={size} color={color ?? '#000'} fill={fill} strokeWidth={strokeWidth} />;
}

export interface MockThread {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorAvatarUri: string;
  lastMessage: string;
  lastMessageAt: string; // human-readable for demo
  unreadCount: number;
}

export const mockThreads: MockThread[] = [
  {
    id: 't1',
    vendorId: 'v-glow-la-jolla',
    vendorName: 'Glow Aesthetics La Jolla',
    vendorAvatarUri:
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&h=200&fit=crop&auto=format&q=80',
    lastMessage: 'Yes — Saturday at 2pm is open. Want me to hold it?',
    lastMessageAt: '12m ago',
    unreadCount: 1,
  },
  {
    id: 't2',
    vendorId: 'v-badia',
    vendorName: 'Badia Wellness',
    vendorAvatarUri:
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=200&h=200&fit=crop&auto=format&q=80',
    lastMessage: 'Happy to walk you through a consult first. Free of charge!',
    lastMessageAt: '2h ago',
    unreadCount: 0,
  },
  {
    id: 't3',
    vendorId: 'v-skin-studio',
    vendorName: 'Skin Studio Hillcrest',
    vendorAvatarUri:
      'https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=200&h=200&fit=crop&auto=format&q=80',
    lastMessage: 'You: thanks!',
    lastMessageAt: 'Yesterday',
    unreadCount: 0,
  },
];

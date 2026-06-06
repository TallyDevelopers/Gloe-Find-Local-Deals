export type AuthGateReason = 'redeem' | 'save' | 'review' | 'notify' | 'generic';

export interface AuthGatePrompt {
  reason: AuthGateReason;
  title: string;
  description: string;
}

export const authGatePrompts: Record<AuthGateReason, AuthGatePrompt> = {
  redeem: {
    reason: 'redeem',
    title: 'Your glow, unlocked',
    description: 'Sign in to grab this deal and track it in Your Deals.',
  },
  save: {
    reason: 'save',
    title: 'Save your favorites',
    description: 'Sign in to bookmark deals and come back anytime.',
  },
  review: {
    reason: 'review',
    title: 'Share your experience',
    description: 'Sign in to leave a review — only verified Gloē members can.',
  },
  notify: {
    reason: 'notify',
    title: 'Never miss a glow-up',
    description: 'Sign in to get notified the moment a deal drops near you.',
  },
  generic: {
    reason: 'generic',
    title: 'Welcome to Gloē',
    description: 'Sign in to unlock the full experience.',
  },
};

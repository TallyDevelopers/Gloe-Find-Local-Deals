export type AuthGateReason = 'redeem' | 'save' | 'review' | 'notify' | 'generic';

export interface AuthGatePrompt {
  reason: AuthGateReason;
  title: string;
  description: string;
}

export const authGatePrompts: Record<AuthGateReason, AuthGatePrompt> = {
  redeem: {
    reason: 'redeem',
    title: 'Sign in to get this deal',
    description: 'Create a free account to grab deals and track them in Your Deals.',
  },
  save: {
    reason: 'save',
    title: 'Sign in to save deals',
    description: 'Create a free account to bookmark deals and come back later.',
  },
  review: {
    reason: 'review',
    title: 'Sign in to leave a review',
    description: 'Only verified Gloe members can review providers.',
  },
  notify: {
    reason: 'notify',
    title: 'Sign in for deal alerts',
    description: 'Get notified the moment a deal drops near you.',
  },
  generic: {
    reason: 'generic',
    title: 'Sign in to continue',
    description: 'Create a free account to unlock the full Gloe experience.',
  },
};

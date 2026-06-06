import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { AuthGateSheet } from './AuthGateSheet';
import { authGatePrompts, type AuthGatePrompt, type AuthGateReason } from './types';

interface AuthGateContextValue {
  /**
   * Opens the inline sign-in sheet. If `onAuthed` is given, it runs once the
   * shopper signs in successfully (e.g. continue to checkout) — so a signed-out
   * "Buy now" tap flows straight through without a screen change.
   */
  prompt: (reason: AuthGateReason, onAuthed?: () => void) => void;
  close: () => void;
}

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [activePrompt, setActivePrompt] = useState<AuthGatePrompt | null>(null);
  // The action to resume after a successful in-sheet sign-in. Held in a ref so
  // it survives re-renders and is cleared the moment it runs or the sheet closes.
  const pendingAction = useRef<(() => void) | null>(null);

  const prompt = useCallback((reason: AuthGateReason, onAuthed?: () => void) => {
    pendingAction.current = onAuthed ?? null;
    setActivePrompt(authGatePrompts[reason]);
  }, []);

  const close = useCallback(() => {
    pendingAction.current = null;
    setActivePrompt(null);
  }, []);

  // Called by the sheet when sign-in completes: dismiss, then resume the action.
  const handleAuthed = useCallback(() => {
    const action = pendingAction.current;
    pendingAction.current = null;
    setActivePrompt(null);
    action?.();
  }, []);

  const value = useMemo(() => ({ prompt, close }), [prompt, close]);

  return (
    <AuthGateContext.Provider value={value}>
      {children}
      <AuthGateSheet prompt={activePrompt} onClose={close} onAuthed={handleAuthed} />
    </AuthGateContext.Provider>
  );
}

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error('useAuthGate must be used inside <AuthGateProvider>');
  return ctx;
}

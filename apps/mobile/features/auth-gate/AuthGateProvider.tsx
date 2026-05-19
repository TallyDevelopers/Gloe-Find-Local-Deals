import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { AuthGateSheet } from './AuthGateSheet';
import { authGatePrompts, type AuthGatePrompt, type AuthGateReason } from './types';

interface AuthGateContextValue {
  prompt: (reason: AuthGateReason) => void;
  close: () => void;
}

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [activePrompt, setActivePrompt] = useState<AuthGatePrompt | null>(null);

  const prompt = useCallback((reason: AuthGateReason) => {
    setActivePrompt(authGatePrompts[reason]);
  }, []);

  const close = useCallback(() => setActivePrompt(null), []);

  const value = useMemo(() => ({ prompt, close }), [prompt, close]);

  return (
    <AuthGateContext.Provider value={value}>
      {children}
      <AuthGateSheet prompt={activePrompt} onClose={close} />
    </AuthGateContext.Provider>
  );
}

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error('useAuthGate must be used inside <AuthGateProvider>');
  return ctx;
}

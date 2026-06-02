import type { ReactNode } from 'react';

import { AppShell } from '../../components/consumer/AppShell';

/**
 * Layout for the consumer marketplace route group. Every shopper page (/,
 * /search, /deals/*, /spa/*, /saved, /wallet, /account, /support) renders
 * inside the AppShell. Business/admin/vendor live outside this group and keep
 * their own chrome.
 */
export default function ConsumerLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminChrome, type WorkspaceView } from './AdminChrome';
import { AdminsView } from './AdminsView';
import { AuditView } from './AuditView';
import { CustomersView } from './CustomersView';
import { FeesView } from './FeesView';
import { PayoutsView } from './PayoutsView';
import { PulseView } from './PulseView';
import { RefundsView } from './RefundsView';
import { SectionsView } from './SectionsView';
import { SettingsView } from './SettingsView';
import { SupportView } from './SupportView';
import { TransactionsView } from './TransactionsView';
import { VendorsView } from './VendorsView';
import { WaitlistView } from './WaitlistView';

const TABS: readonly WorkspaceView[] = [
  'pulse', 'transactions', 'vendors', 'customers', 'payouts', 'refunds',
  'fees', 'support', 'sections', 'waitlist', 'audit', 'admins', 'settings',
];

export function AdminShell() {
  const params = useSearchParams();
  const [view, setView] = useState<WorkspaceView>('pulse');
  // When TransactionsView wants to jump to a specific customer, it sets this
  // and we switch tabs. CustomersView opens the drawer for the matching id.
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<string | null>(null);
  // When the support drawer / a customer record links to a specific refund, we
  // jump to the Refunds tab and flash the matching row. Callers usually only
  // know the transactionId (not the audit-row id), so we target by that.
  const [preselectedRefundTxnId, setPreselectedRefundTxnId] = useState<string | null>(null);
  // Deep-link a specific transaction's drawer (⌘K search hit).
  const [openTransactionId, setOpenTransactionId] = useState<string | null>(null);

  // React to deep links: sub-page nav (?tab=), ⌘K customer (?customer=) and
  // transaction (?tx=) hits. These arrive as soft navigations, so we key the
  // effects on the param values rather than only reading once on mount.
  const tabParam = params.get('tab');
  const customerParam = params.get('customer');
  const txParam = params.get('tx');

  useEffect(() => {
    if (customerParam) {
      setPreselectedCustomerId(customerParam);
      setView('customers');
    } else if (txParam) {
      setOpenTransactionId(txParam);
      setView('transactions');
    } else if (tabParam && (TABS as readonly string[]).includes(tabParam)) {
      setView(tabParam as WorkspaceView);
    }
  }, [tabParam, customerParam, txParam]);

  const jumpToCustomer = (customerId: string) => {
    setPreselectedCustomerId(customerId);
    setView('customers');
  };

  const jumpToRefundByTxn = (transactionId: string) => {
    setPreselectedRefundTxnId(transactionId);
    setView('refunds');
  };

  return (
    <AdminChrome active={view} onNavigate={setView}>
      {view === 'pulse'        ? <PulseView onNavigate={(v) => setView(v)} /> : null}
      {view === 'transactions' ? <TransactionsView onJumpToCustomer={jumpToCustomer} openTransactionId={openTransactionId} onOpenConsumed={() => setOpenTransactionId(null)} /> : null}
      {view === 'vendors'      ? <VendorsView /> : null}
      {view === 'customers'    ? <CustomersView preselectedId={preselectedCustomerId} onPreselectionConsumed={() => setPreselectedCustomerId(null)} onJumpToRefundByTxn={jumpToRefundByTxn} /> : null}
      {view === 'payouts'      ? <PayoutsView /> : null}
      {view === 'refunds'      ? <RefundsView highlightTransactionId={preselectedRefundTxnId} onHighlightConsumed={() => setPreselectedRefundTxnId(null)} onJumpToCustomer={jumpToCustomer} /> : null}
      {view === 'fees'         ? <FeesView /> : null}
      {view === 'support'      ? <SupportView onJumpToRefundByTxn={jumpToRefundByTxn} /> : null}
      {view === 'sections'     ? <SectionsView /> : null}
      {view === 'waitlist'     ? <WaitlistView /> : null}
      {view === 'audit'        ? <AuditView /> : null}
      {view === 'admins'       ? <AdminsView /> : null}
      {view === 'settings'     ? <SettingsView /> : null}
    </AdminChrome>
  );
}

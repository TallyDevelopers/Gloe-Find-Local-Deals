'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminChrome, type WorkspaceView } from './AdminChrome';
import { AdminsView } from './AdminsView';
import { AuditView } from './AuditView';
import { CreditsView } from './CreditsView';
import { CustomersView } from './CustomersView';
import { FeesView } from './FeesView';
import { PayoutsView } from './PayoutsView';
import { PromosView } from './PromosView';
import { PulseView } from './PulseView';
import { RefundsView } from './RefundsView';
import { SectionsView } from './SectionsView';
import { SettingsView } from './SettingsView';
import { SupportView } from './SupportView';
import { TaxonomyView } from './TaxonomyView';
import { TransactionsView } from './TransactionsView';
import { VendorsView } from './VendorsView';
import { WaitlistView } from './WaitlistView';

const TABS: readonly WorkspaceView[] = [
  'pulse', 'transactions', 'vendors', 'customers', 'payouts', 'refunds',
  'fees', 'credits', 'promos', 'support', 'sections', 'taxonomy', 'waitlist', 'audit', 'admins', 'settings',
];

export function AdminShell() {
  const router = useRouter();
  const params = useSearchParams();
  const [view, setView] = useState<WorkspaceView>('pulse');
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

  // ?refundTxn= rides along with ?tab=refunds so the full-page Customer 360
  // can deep-link a specific refund record (GLO-56).
  const refundTxnParam = params.get('refundTxn');

  useEffect(() => {
    if (customerParam) {
      // Customer deep links open the full-page Customer 360 (no drawer).
      router.replace(`/admin/customer/${customerParam}`);
    } else if (txParam) {
      setOpenTransactionId(txParam);
      setView('transactions');
    } else if (tabParam && (TABS as readonly string[]).includes(tabParam)) {
      if (tabParam === 'refunds' && refundTxnParam) setPreselectedRefundTxnId(refundTxnParam);
      setView(tabParam as WorkspaceView);
    }
  }, [tabParam, customerParam, txParam, refundTxnParam, router]);

  const jumpToCustomer = (customerId: string) => {
    router.push(`/admin/customer/${customerId}`);
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
      {view === 'customers'    ? <CustomersView /> : null}
      {view === 'payouts'      ? <PayoutsView /> : null}
      {view === 'refunds'      ? <RefundsView highlightTransactionId={preselectedRefundTxnId} onHighlightConsumed={() => setPreselectedRefundTxnId(null)} onJumpToCustomer={jumpToCustomer} /> : null}
      {view === 'fees'         ? <FeesView /> : null}
      {view === 'credits'      ? <CreditsView /> : null}
      {view === 'promos'       ? <PromosView /> : null}
      {view === 'support'      ? <SupportView onJumpToRefundByTxn={jumpToRefundByTxn} /> : null}
      {view === 'sections'     ? <SectionsView /> : null}
      {view === 'taxonomy'     ? <TaxonomyView /> : null}
      {view === 'waitlist'     ? <WaitlistView /> : null}
      {view === 'audit'        ? <AuditView /> : null}
      {view === 'admins'       ? <AdminsView /> : null}
      {view === 'settings'     ? <SettingsView /> : null}
    </AdminChrome>
  );
}

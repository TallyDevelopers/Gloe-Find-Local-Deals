'use client';

import { useState } from 'react';

import type { RouterOutputs } from '@gloe/api-client';

import { Card } from '../../../components/ui';
import { trpc } from '../../../lib/trpc';

type Rule = RouterOutputs['admin']['listCreditRules'][number];
type Campaign = RouterOutputs['admin']['listCreditCampaigns'][number];

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Whole-dollar display for rule thresholds ($100–$250, not $100.00–$250.00). */
function moneyShort(cents: number | null): string {
  if (cents == null) return '∞';
  return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

const LOT_KIND_LABEL: Record<string, string> = {
  referral_give: 'Referral welcome',
  referral_get: 'Referral reward',
  purchase_reward: 'Purchase reward',
  signup_bonus: 'Signup bonus',
  promo: 'Campaign',
  admin_grant: 'Manual grant',
  refund_return: 'Refund return',
};

const ENTRY_KIND_LABEL: Record<string, string> = {
  redemption: 'Spent at checkout',
  expiry: 'Expired',
  clawback: 'Clawed back',
  forfeiture: 'Forfeited',
};

const AUDIENCE_LABEL: Record<Campaign['audience'], string> = {
  everyone: 'Everyone',
  lapsed_60d: 'Lapsed 60+ days',
  signed_up_never_purchased: 'Signed up, never purchased',
};

export function CreditsView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 28 }}>Credits</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
          Platform-funded wallet credit: earn rules, push campaigns, and any customer&apos;s ledger.
          Credits reduce the customer&apos;s cash charge only — vendor payouts never change.
        </p>
      </div>

      <ProgramDashboard />
      <RulesEditor />
      <CampaignsPanel />
      <UserLedgerPanel />
    </div>
  );
}

/* ─────────────────────────── Program dashboard ─────────────────────────── */

function ProgramDashboard() {
  const stats = trpc.admin.creditProgramStats.useQuery(undefined, { refetchInterval: 30_000 });
  const stripeBal = trpc.admin.platformStripeBalance.useQuery(undefined, { refetchInterval: 60_000 });
  const s = stats.data;
  const sb = stripeBal.data;

  return (
    <Card>
      <h2 style={{ fontSize: 19, marginBottom: 14 }}>Program health</h2>
      {!s ? (
        <div style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <StatTile label="Outstanding liability" value={money(s.outstandingLiabilityCents)} hint={`${s.usersWithBalance} wallets`} emphasis />
            <StatTile label="Issued (all time)" value={money(s.issuedCents)} hint={`${s.issuedLots} lots`} />
            <StatTile label="Redeemed" value={money(s.redeemedCents)} hint="spent at checkout" />
            <StatTile label="Clawed back" value={money(s.clawedCents)} />
            <StatTile label="Expired" value={money(s.expiredCents)} />
            <StatTile label="Forfeited" value={money(s.forfeitedCents)} hint="account deletions" />
          </div>

          <LiabilityGauge
            liabilityCents={s.outstandingLiabilityCents}
            availableCents={sb?.availableCents ?? 0}
            pendingCents={sb?.pendingCents ?? 0}
            unavailable={!sb || ('error' in sb && !!sb.error)}
          />

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
            <span>Expiring in 30d: <strong style={{ color: 'var(--text-secondary)' }}>{money(s.expiring30dCents)}</strong></span>
            <span>Clawback debt outstanding: <strong style={{ color: 'var(--text-secondary)' }}>{money(s.debtCents)}</strong></span>
            <span>Frozen ledgers (open disputes): <strong style={{ color: s.frozenUsers > 0 ? 'var(--error)' : 'var(--text-secondary)' }}>{s.frozenUsers}</strong></span>
          </div>

          {s.byKind.length > 0 ? (
            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {s.byKind.map((k) => (
                <span key={k.kind} style={kindPill}>
                  {LOT_KIND_LABEL[k.kind] ?? k.kind}: {money(k.issuedCents)} · {k.lotCount}
                </span>
              ))}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

/**
 * Stripe balance vs outstanding credit liability. Green = liquid balance
 * covers every wallet today; amber = covered only if pending Stripe funds
 * land; red = wallets exceed what's on the platform account.
 */
function LiabilityGauge({
  liabilityCents, availableCents, pendingCents, unavailable,
}: {
  liabilityCents: number;
  availableCents: number;
  pendingCents: number;
  unavailable: boolean;
}) {
  const AMBER = '#b8860b'; // no --warning token; matches the dispute-notice amber
  const state = liabilityCents <= 0 || availableCents >= liabilityCents
    ? 'green'
    : availableCents + pendingCents >= liabilityCents
      ? 'amber'
      : 'red';
  const color = state === 'green' ? 'var(--success)' : state === 'amber' ? AMBER : 'var(--error)';
  const coverage = liabilityCents <= 0 ? 100 : Math.min(100, Math.round((availableCents / liabilityCents) * 100));
  const label = unavailable
    ? 'Live Stripe balance unavailable — gauge is DB-side only.'
    : state === 'green'
      ? (liabilityCents <= 0 ? 'No outstanding liability.' : 'Stripe balance fully covers outstanding credits.')
      : state === 'amber'
        ? 'Covered only once pending Stripe funds settle.'
        : 'Outstanding credits exceed the platform Stripe balance.';

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
          Stripe balance vs liability
        </span>
        <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
          {money(availableCents)} available{pendingCents > 0 ? ` + ${money(pendingCents)} pending` : ''} vs {money(liabilityCents)} owed
        </span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: 'var(--surface-secondary)', overflow: 'hidden' }}>
        <div style={{ width: `${coverage}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 240ms ease' }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color }}>{label}</div>
    </div>
  );
}

function StatTile({ label, value, hint, emphasis }: { label: string; value: string; hint?: string; emphasis?: boolean }) {
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 'var(--radius-md)',
      background: emphasis ? 'var(--brand-50)' : 'var(--surface-secondary)',
      border: emphasis ? '1px solid var(--brand-500)' : '1px solid var(--border-subtle)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 4, color: emphasis ? 'var(--brand-600)' : 'var(--text-primary)' }}>{value}</div>
      {hint ? <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{hint}</div> : null}
    </div>
  );
}

/* ─────────────────────────── Rules editor ─────────────────────────── */

type RuleType = Rule['ruleType'];

interface RuleForm {
  ruleType: RuleType;
  minDollars: string;
  maxDollars: string;
  rewardType: 'flat' | 'percent';
  creditDollars: string;
  percent: string;
  giveDollars: string;
  getDollars: string;
  floorDollars: string;
  expiresDays: string;
  capDollars: string;
  payoutCap: string;
}

function emptyRuleForm(ruleType: RuleType = 'purchase_tier'): RuleForm {
  return {
    ruleType,
    minDollars: '', maxDollars: '',
    rewardType: 'flat', creditDollars: '', percent: '',
    giveDollars: '', getDollars: '', floorDollars: '',
    expiresDays: '90', capDollars: '', payoutCap: '',
  };
}

function ruleToForm(r: Rule): RuleForm {
  return {
    ruleType: r.ruleType,
    minDollars: r.minPurchaseCents == null ? '' : (r.minPurchaseCents / 100).toString(),
    maxDollars: r.maxPurchaseCents == null ? '' : (r.maxPurchaseCents / 100).toString(),
    rewardType: (r.percentBps ?? 0) > 0 ? 'percent' : 'flat',
    creditDollars: r.creditCents == null ? '' : (r.creditCents / 100).toString(),
    percent: r.percentBps == null ? '' : (r.percentBps / 100).toString(),
    giveDollars: r.giveCents == null ? '' : (r.giveCents / 100).toString(),
    getDollars: r.getCents == null ? '' : (r.getCents / 100).toString(),
    floorDollars: r.minFirstPurchaseCents == null ? '' : (r.minFirstPurchaseCents / 100).toString(),
    expiresDays: r.expiresAfterDays.toString(),
    capDollars: r.monthlyUserCapCents == null ? '' : (r.monthlyUserCapCents / 100).toString(),
    payoutCap: r.monthlyReferralPayoutCap == null ? '' : r.monthlyReferralPayoutCap.toString(),
  };
}

/** One human sentence per rule — what it pays and when. */
function ruleSummary(r: Rule): string {
  if (r.ruleType === 'referral') {
    return `Give ${moneyShort(r.giveCents)} / Get ${moneyShort(r.getCents)} · ${moneyShort(r.minFirstPurchaseCents ?? 0)} first-booking floor`;
  }
  if (r.ruleType === 'signup_bonus') {
    return `${moneyShort(r.creditCents)} at signup`;
  }
  const reward = (r.percentBps ?? 0) > 0 ? `${((r.percentBps ?? 0) / 100).toFixed((r.percentBps ?? 0) % 100 === 0 ? 0 : 2)}% of order` : moneyShort(r.creditCents);
  return `${moneyShort(r.minPurchaseCents ?? 0)} – ${moneyShort(r.maxPurchaseCents)} → ${reward}`;
}

function ruleCaps(r: Rule): string {
  const bits = [`expires ${r.expiresAfterDays}d`];
  if (r.monthlyUserCapCents != null) bits.push(`cap ${moneyShort(r.monthlyUserCapCents)}/mo`);
  if (r.monthlyReferralPayoutCap != null) bits.push(`${r.monthlyReferralPayoutCap} payouts/mo`);
  return bits.join(' · ');
}

const RULE_TYPE_LABEL: Record<RuleType, string> = {
  referral: 'Referral',
  purchase_tier: 'Purchase reward',
  signup_bonus: 'Signup bonus',
};

function RulesEditor() {
  const utils = trpc.useUtils();
  const q = trpc.admin.listCreditRules.useQuery();
  const invalidate = () => utils.admin.listCreditRules.invalidate();

  const create = trpc.admin.createCreditRule.useMutation({ onSuccess: () => { void invalidate(); closeForm(); } });
  const update = trpc.admin.updateCreditRule.useMutation({ onSuccess: () => { void invalidate(); closeForm(); } });
  const deactivate = trpc.admin.deactivateCreditRule.useMutation({ onSuccess: () => invalidate() });
  const reactivate = trpc.admin.reactivateCreditRule.useMutation({ onSuccess: () => invalidate() });

  // null = closed, 'new' = create form, otherwise the rule id being edited.
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyRuleForm());

  const closeForm = () => { setEditingId(null); setForm(emptyRuleForm()); };
  const openCreate = () => { setEditingId('new'); setForm(emptyRuleForm()); };
  const openEdit = (r: Rule) => { setEditingId(r.id); setForm(ruleToForm(r)); };

  const rules = q.data ?? [];
  const activeCount = rules.filter((r) => r.active).length;

  const dollars = (v: string): number | null => (v.trim() === '' ? null : Math.round(parseFloat(v) * 100));

  const submit = () => {
    const payload = {
      ruleType: form.ruleType,
      minPurchaseCents: form.ruleType === 'purchase_tier' ? dollars(form.minDollars) ?? 0 : null,
      maxPurchaseCents: form.ruleType === 'purchase_tier' ? dollars(form.maxDollars) : null,
      creditCents: form.ruleType === 'referral' ? null : (form.rewardType === 'flat' || form.ruleType === 'signup_bonus' ? dollars(form.creditDollars) : null),
      percentBps: form.ruleType === 'purchase_tier' && form.rewardType === 'percent'
        ? Math.round(parseFloat(form.percent || '0') * 100) || null
        : null,
      giveCents: form.ruleType === 'referral' ? dollars(form.giveDollars) : null,
      getCents: form.ruleType === 'referral' ? dollars(form.getDollars) : null,
      minFirstPurchaseCents: form.ruleType === 'referral' ? dollars(form.floorDollars) ?? 0 : null,
      expiresAfterDays: parseInt(form.expiresDays || '90', 10),
      monthlyUserCapCents: form.ruleType === 'purchase_tier' ? null : dollars(form.capDollars),
      monthlyReferralPayoutCap: form.ruleType === 'referral' && form.payoutCap.trim() !== ''
        ? parseInt(form.payoutCap, 10)
        : null,
    };
    if (editingId === 'new') create.mutate(payload);
    else if (editingId) update.mutate({ id: editingId, ...payload });
  };

  const writeMutation = editingId === 'new' ? create : update;

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 19 }}>
          Earn rules
          <span style={{ color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 400, marginLeft: 10 }}>
            {activeCount} active · {rules.length - activeCount} off
          </span>
        </h2>
        {editingId == null ? <button onClick={openCreate} style={primaryBtn}>+ Add rule</button> : null}
      </div>

      {editingId != null ? (
        <div style={{ background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            {editingId === 'new' ? 'New rule' : `Edit ${RULE_TYPE_LABEL[form.ruleType].toLowerCase()} rule`}
          </div>

          {editingId === 'new' ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {(['purchase_tier', 'referral', 'signup_bonus'] as const).map((t) => (
                <TypeChip key={t} on={form.ruleType === t} onClick={() => setForm({ ...emptyRuleForm(t), expiresDays: form.expiresDays })}>
                  {RULE_TYPE_LABEL[t]}
                </TypeChip>
              ))}
            </div>
          ) : null}

          {form.ruleType === 'purchase_tier' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <LabeledInput label="Min order $" value={form.minDollars} onChange={(v) => setForm({ ...form, minDollars: v })} placeholder="100" type="number" />
                <LabeledInput label="Max order $ (blank = ∞)" value={form.maxDollars} onChange={(v) => setForm({ ...form, maxDollars: v })} placeholder="250" type="number" />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <TypeChip on={form.rewardType === 'flat'} onClick={() => setForm({ ...form, rewardType: 'flat' })}>Flat credit</TypeChip>
                <TypeChip on={form.rewardType === 'percent'} onClick={() => setForm({ ...form, rewardType: 'percent' })}>% of order</TypeChip>
              </div>
              <div style={{ marginTop: 12, maxWidth: 220 }}>
                {form.rewardType === 'flat' ? (
                  <LabeledInput label="Credit $" value={form.creditDollars} onChange={(v) => setForm({ ...form, creditDollars: v })} placeholder="10" type="number" />
                ) : (
                  <LabeledInput label="Percent" value={form.percent} onChange={(v) => setForm({ ...form, percent: v })} placeholder="5" type="number" suffix="%" />
                )}
              </div>
            </>
          ) : null}

          {form.ruleType === 'referral' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <LabeledInput label="Give $ (new customer)" value={form.giveDollars} onChange={(v) => setForm({ ...form, giveDollars: v })} placeholder="20" type="number" />
              <LabeledInput label="Get $ (referrer)" value={form.getDollars} onChange={(v) => setForm({ ...form, getDollars: v })} placeholder="20" type="number" />
              <LabeledInput label="First-booking floor $" value={form.floorDollars} onChange={(v) => setForm({ ...form, floorDollars: v })} placeholder="50" type="number" />
              <LabeledInput label="Max payouts / month" value={form.payoutCap} onChange={(v) => setForm({ ...form, payoutCap: v })} placeholder="10" type="number" />
            </div>
          ) : null}

          {form.ruleType === 'signup_bonus' ? (
            <div style={{ maxWidth: 220 }}>
              <LabeledInput label="Credit $" value={form.creditDollars} onChange={(v) => setForm({ ...form, creditDollars: v })} placeholder="10" type="number" />
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 12 }}>
            <LabeledInput label="Credit expires after (days)" value={form.expiresDays} onChange={(v) => setForm({ ...form, expiresDays: v })} placeholder="90" type="number" />
            {form.ruleType !== 'purchase_tier' ? (
              <LabeledInput label="Monthly earn cap $ (blank = none)" value={form.capDollars} onChange={(v) => setForm({ ...form, capDollars: v })} placeholder="100" type="number" />
            ) : null}
          </div>

          {writeMutation.error ? (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--error)' }}>{writeMutation.error.message}</div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button onClick={closeForm} style={secondaryBtn}>Cancel</button>
            <button onClick={submit} disabled={writeMutation.isPending} style={primaryBtn}>
              {writeMutation.isPending ? 'Saving…' : editingId === 'new' ? 'Add rule' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : null}

      {q.isLoading ? (
        <div style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : rules.length === 0 ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14, padding: '12px 0' }}>
          No earn rules yet. Nothing grants credit until you add one.
        </div>
      ) : (
        (['referral', 'purchase_tier', 'signup_bonus'] as const).map((type) => {
          const group = rules.filter((r) => r.ruleType === type);
          if (group.length === 0) return null;
          return (
            <div key={type} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', padding: '8px 0 2px' }}>
                {RULE_TYPE_LABEL[type]}{type === 'purchase_tier' ? 's' : ''}
              </div>
              {group.map((r, i) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', flexWrap: 'wrap',
                    borderBottom: i === group.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                    opacity: r.active ? 1 : 0.65,
                  }}
                >
                  <span style={r.active ? onChipStyle : offChipStyle}>{r.active ? 'ON' : 'OFF'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{ruleSummary(r)}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>{ruleCaps(r)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(r)} style={secondaryBtn}>Edit</button>
                    <button
                      onClick={() => (r.active ? deactivate.mutate({ id: r.id }) : reactivate.mutate({ id: r.id }))}
                      disabled={deactivate.isPending || reactivate.isPending}
                      style={r.active ? destructiveBtn : secondaryBtn}
                    >
                      {r.active ? 'Turn off' : 'Turn on'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}
      {reactivate.error ? (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--error)' }}>{reactivate.error.message}</div>
      ) : null}
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: 10 }}>
        Edits apply to NEW grants only — credit already in wallets keeps its amount and expiry.
      </div>
    </Card>
  );
}

/* ─────────────────────────── Campaigns ─────────────────────────── */

interface CampaignForm {
  name: string;
  amountDollars: string;
  expiresDays: string;
  audience: Campaign['audience'];
  messageTitle: string;
  messageBody: string;
}

function emptyCampaignForm(): CampaignForm {
  return { name: '', amountDollars: '', expiresDays: '90', audience: 'everyone', messageTitle: '', messageBody: '' };
}

function CampaignsPanel() {
  const utils = trpc.useUtils();
  // Short poll so a firing campaign's granted_count fills in live.
  const list = trpc.admin.listCreditCampaigns.useQuery(undefined, { refetchInterval: 15_000 });
  const invalidate = () => utils.admin.listCreditCampaigns.invalidate();

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CampaignForm>(emptyCampaignForm());
  // The draft currently in the "review cost → send" step.
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const create = trpc.admin.createCreditCampaign.useMutation({
    onSuccess: () => { void invalidate(); setCreating(false); setForm(emptyCampaignForm()); },
  });

  const campaigns = list.data ?? [];
  const reviewing = campaigns.find((c) => c.id === reviewingId && c.status === 'draft') ?? null;

  const submit = () => {
    create.mutate({
      name: form.name.trim(),
      amountCents: Math.round(parseFloat(form.amountDollars || '0') * 100),
      expiresAfterDays: parseInt(form.expiresDays || '90', 10),
      audience: form.audience,
      messageTitle: form.messageTitle.trim(),
      messageBody: form.messageBody.trim(),
    });
  };

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 19 }}>
          Push-credit campaigns
          <span style={{ color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 400, marginLeft: 10 }}>
            draft → review cost → send (push + email per customer)
          </span>
        </h2>
        {!creating ? <button onClick={() => setCreating(true)} style={primaryBtn}>+ New campaign</button> : null}
      </div>

      {creating ? (
        <div style={{ background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            New campaign (saved as a draft)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <LabeledInput label="Internal name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="June win-back" />
            <LabeledInput label="Credit $ per customer" value={form.amountDollars} onChange={(v) => setForm({ ...form, amountDollars: v })} placeholder="10" type="number" />
            <LabeledInput label="Expires after (days)" value={form.expiresDays} onChange={(v) => setForm({ ...form, expiresDays: v })} placeholder="90" type="number" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {(Object.keys(AUDIENCE_LABEL) as Campaign['audience'][]).map((a) => (
              <TypeChip key={a} on={form.audience === a} onClick={() => setForm({ ...form, audience: a })}>
                {AUDIENCE_LABEL[a]}
              </TypeChip>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <LabeledInput label="Push / email title (customers see this)" value={form.messageTitle} onChange={(v) => setForm({ ...form, messageTitle: v })} placeholder="A little glow on us 💆" />
            <LabeledInput label="Message body" value={form.messageBody} onChange={(v) => setForm({ ...form, messageBody: v })} placeholder="We added $10 of Gloē credit to your wallet — it applies automatically at checkout." />
          </div>
          {create.error ? <div style={{ marginTop: 10, fontSize: 13, color: 'var(--error)' }}>{create.error.message}</div> : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button onClick={() => { setCreating(false); setForm(emptyCampaignForm()); }} style={secondaryBtn}>Cancel</button>
            <button onClick={submit} disabled={create.isPending} style={primaryBtn}>
              {create.isPending ? 'Saving…' : 'Save draft'}
            </button>
          </div>
        </div>
      ) : null}

      {reviewing ? (
        <CampaignReview
          campaign={reviewing}
          onClose={() => setReviewingId(null)}
          onDone={() => { setReviewingId(null); void invalidate(); }}
        />
      ) : null}

      {list.isLoading ? (
        <div style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : campaigns.length === 0 ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14, padding: '12px 0' }}>
          No campaigns yet. Draft one to push credit to a whole audience at once.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-secondary)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
              <Th>Campaign</Th>
              <Th>Audience</Th>
              <Th align="right">Per customer</Th>
              <Th align="right">Granted</Th>
              <Th align="right">Redeemed</Th>
              <Th align="right">Expired</Th>
              <Th>Status</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <Td>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {new Date(c.createdAt).toLocaleDateString()}{c.createdByEmail ? ` · ${c.createdByEmail}` : ''}
                  </div>
                </Td>
                <Td>{AUDIENCE_LABEL[c.audience]}</Td>
                <Td align="right" mono>{money(c.amountCents)}</Td>
                <Td align="right" mono>
                  {c.status === 'sent' ? <>{money(c.grantedCents)}<div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.grantedCount} wallets</div></> : '—'}
                </Td>
                <Td align="right" mono>{c.status === 'sent' ? money(c.redeemedCents) : '—'}</Td>
                <Td align="right" mono>{c.status === 'sent' ? money(c.expiredCents) : '—'}</Td>
                <Td>
                  <span style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                    color: c.status === 'sent' ? 'var(--success)' : 'var(--text-tertiary)',
                  }}>
                    {c.status}
                  </span>
                  {c.status === 'sent' && c.sentAt ? (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(c.sentAt).toLocaleDateString()}</div>
                  ) : null}
                </Td>
                <Td>
                  {c.status === 'draft' ? (
                    <button onClick={() => setReviewingId(c.id)} style={secondaryBtn}>Review &amp; send</button>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/** The "are you sure" step: live audience count → total cost → owner-gated send. */
function CampaignReview({ campaign, onClose, onDone }: { campaign: Campaign; onClose: () => void; onDone: () => void }) {
  const preview = trpc.admin.previewCreditCampaign.useQuery({ audience: campaign.audience });
  const send = trpc.admin.sendCreditCampaign.useMutation({ onSuccess: onDone });
  const remove = trpc.admin.deleteCreditCampaign.useMutation({ onSuccess: onDone });

  const userCount = preview.data?.userCount;
  const totalCents = userCount != null ? userCount * campaign.amountCents : null;

  return (
    <div style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-500)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Send “{campaign.name}”?</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-tertiary)', cursor: 'pointer' }}>×</button>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
        {userCount == null ? (
          'Counting the audience…'
        ) : (
          <>
            <strong>{AUDIENCE_LABEL[campaign.audience]}</strong> resolves to <strong>{userCount.toLocaleString()}</strong> customers ×{' '}
            {money(campaign.amountCents)} = <strong>{money(totalCents!)}</strong> max liability (expires after {campaign.expiresAfterDays} days).
            Each gets a push + email: “{campaign.messageTitle}”.
          </>
        )}
      </div>
      {send.error ? <div style={{ marginTop: 8, fontSize: 13, color: 'var(--error)' }}>{send.error.message}</div> : null}
      {remove.error ? <div style={{ marginTop: 8, fontSize: 13, color: 'var(--error)' }}>{remove.error.message}</div> : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          onClick={() => { if (window.confirm('Discard this draft?')) remove.mutate({ campaignId: campaign.id }); }}
          disabled={remove.isPending || send.isPending}
          style={destructiveBtn}
        >
          Delete draft
        </button>
        <button onClick={onClose} disabled={send.isPending} style={secondaryBtn}>Not yet</button>
        <button
          onClick={() => {
            if (totalCents != null && window.confirm(`Grant ${money(campaign.amountCents)} to ${userCount!.toLocaleString()} customers (${money(totalCents)} total)? This cannot be undone.`)) {
              send.mutate({ campaignId: campaign.id });
            }
          }}
          disabled={send.isPending || userCount == null}
          style={primaryBtn}
        >
          {send.isPending ? 'Sending…' : 'Send now'}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────── User ledger lookup ─────────────────────────── */

function UserLedgerPanel() {
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const results = trpc.admin.listCustomers.useQuery(
    { query: search.trim() },
    { enabled: search.trim().length >= 2 && selectedUserId == null },
  );

  return (
    <Card>
      <h2 style={{ fontSize: 19, marginBottom: 4 }}>Customer wallet lookup</h2>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 12 }}>
        Find a customer to see their balance and full lot/entry ledger, grant credit manually, or revoke it.
      </p>

      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setSelectedUserId(null); }}
        placeholder="Search by name, email, or phone…"
        style={searchInput}
      />

      {selectedUserId == null && search.trim().length >= 2 ? (
        results.isLoading ? (
          <div style={{ color: 'var(--text-tertiary)', padding: '12px 0' }}>Searching…</div>
        ) : !results.data || results.data.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', padding: '12px 0', fontSize: 14 }}>No customers match.</div>
        ) : (
          <div style={{ marginTop: 10 }}>
            {results.data.slice(0, 8).map((c) => {
              const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || (c.email ?? '—');
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedUserId(c.id)}
                  style={resultRowBtn}
                >
                  <span style={{ fontWeight: 600 }}>{name}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{c.email ?? '—'} · joined {new Date(c.createdAt).toLocaleDateString()}</span>
                </button>
              );
            })}
          </div>
        )
      ) : null}

      {selectedUserId ? (
        <UserLedger userId={selectedUserId} onClear={() => setSelectedUserId(null)} />
      ) : null}
    </Card>
  );
}

/** Per-user wallet panel — also embedded by the Customer 360 page (GLO-56),
 *  which passes no onClear (the page IS the customer context). */
export function UserLedger({ userId, onClear }: { userId: string; onClear?: () => void }) {
  const utils = trpc.useUtils();
  const q = trpc.admin.creditUserLedger.useQuery({ userId });
  const invalidate = () => utils.admin.creditUserLedger.invalidate({ userId });

  const [grantOpen, setGrantOpen] = useState(false);
  const [grantDollars, setGrantDollars] = useState('');
  const [grantExpiresDays, setGrantExpiresDays] = useState('90');
  const [grantNote, setGrantNote] = useState('');

  const grant = trpc.admin.grantCreditToUser.useMutation({
    onSuccess: () => { void invalidate(); setGrantOpen(false); setGrantDollars(''); setGrantNote(''); },
  });
  const revoke = trpc.admin.revokeCreditLot.useMutation({ onSuccess: () => invalidate() });

  const d = q.data;

  const submitGrant = () => {
    grant.mutate({
      userId,
      amountCents: Math.round(parseFloat(grantDollars || '0') * 100),
      expiresAfterDays: grantExpiresDays.trim() === '' ? null : parseInt(grantExpiresDays, 10),
      note: grantNote.trim(),
    });
  };

  const onRevoke = (lotId: string, remainingCents: number) => {
    const reason = window.prompt(`Revoke the remaining ${money(remainingCents)} on this lot? Reason (logged):`);
    if (reason && reason.trim().length >= 3) revoke.mutate({ lotId, reason: reason.trim() });
    else if (reason != null) window.alert('A reason (3+ chars) is required.');
  };

  if (!d) return <div style={{ color: 'var(--text-tertiary)', padding: '14px 0' }}>Loading ledger…</div>;

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header: who + balance + actions */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        padding: 14, background: 'var(--brand-50)', border: '1px solid var(--brand-500)', borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {d.user.name ?? d.user.email ?? d.user.displayId}
            {d.user.creditFrozenAt ? (
              <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fff', background: 'var(--error)', padding: '2px 8px', borderRadius: 999 }}>
                Frozen — open dispute
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {d.user.email ?? '—'} · code {d.user.referralCode ?? '—'} · joined {new Date(d.user.createdAt).toLocaleDateString()}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--brand-600)' }}>{money(d.availableCents)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            spendable{d.balanceCents !== d.availableCents ? ` · ${money(d.balanceCents)} on the books` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!grantOpen ? <button onClick={() => setGrantOpen(true)} style={primaryBtn}>+ Grant credit</button> : null}
          {onClear ? <button onClick={onClear} style={secondaryBtn}>Change customer</button> : null}
        </div>
      </div>

      {grantOpen ? (
        <div style={{ background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)', padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Manual grant — the customer gets a push + email
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <LabeledInput label="Amount $" value={grantDollars} onChange={setGrantDollars} placeholder="20" type="number" />
            <LabeledInput label="Expires after (days, blank = never)" value={grantExpiresDays} onChange={setGrantExpiresDays} placeholder="90" type="number" />
          </div>
          <div style={{ marginTop: 10 }}>
            <LabeledInput label="Note (logged + shown in the email)" value={grantNote} onChange={setGrantNote} placeholder="Sorry about the mix-up — this one's on us." />
          </div>
          {grant.error ? <div style={{ marginTop: 10, fontSize: 13, color: 'var(--error)' }}>{grant.error.message}</div> : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button onClick={() => setGrantOpen(false)} style={secondaryBtn}>Cancel</button>
            <button onClick={submitGrant} disabled={grant.isPending} style={primaryBtn}>
              {grant.isPending ? 'Granting…' : 'Grant credit'}
            </button>
          </div>
        </div>
      ) : null}

      {/* Lots */}
      <div>
        <div style={sectionLabel}>Lots ({d.lots.length})</div>
        {d.lots.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '8px 0' }}>No credit has ever been granted to this customer.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-secondary)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                <Th>Source</Th>
                <Th align="right">Granted</Th>
                <Th align="right">Remaining</Th>
                <Th>Expires</Th>
                <Th>Granted on</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {d.lots.map((l) => {
                const expired = l.expiresAt != null && new Date(l.expiresAt) <= new Date() && l.remainingCents > 0;
                return (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <Td>
                      <div style={{ fontWeight: 600 }}>
                        {LOT_KIND_LABEL[l.kind] ?? l.kind}
                        {l.campaignName ? <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}> · {l.campaignName}</span> : null}
                      </div>
                      {l.note ? <div style={{ fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 320, whiteSpace: 'normal' }}>{l.note}</div> : null}
                      {l.kind === 'referral_give' && l.minFirstPurchaseCents ? (
                        <div style={{ fontSize: 11, color: 'var(--brand-600)' }}>locked until first booking ≥ {moneyShort(l.minFirstPurchaseCents)}</div>
                      ) : null}
                    </Td>
                    <Td align="right" mono>{money(l.amountCents)}</Td>
                    <Td align="right" mono>
                      <span style={{ color: l.remainingCents < 0 ? 'var(--error)' : l.remainingCents === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                        {money(l.remainingCents)}
                      </span>
                    </Td>
                    <Td>
                      {l.expiresAt == null ? 'never' : (
                        <span style={{ color: expired ? 'var(--error)' : 'var(--text-primary)' }}>
                          {new Date(l.expiresAt).toLocaleDateString()}{expired ? ' (lapsed)' : ''}
                        </span>
                      )}
                    </Td>
                    <Td>{new Date(l.createdAt).toLocaleDateString()}</Td>
                    <Td>
                      {l.remainingCents > 0 ? (
                        <button onClick={() => onRevoke(l.id, l.remainingCents)} disabled={revoke.isPending} style={destructiveBtn}>
                          Revoke
                        </button>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {revoke.error ? <div style={{ marginTop: 8, fontSize: 13, color: 'var(--error)' }}>{revoke.error.message}</div> : null}
      </div>

      {/* Entries */}
      {d.entries.length > 0 ? (
        <div>
          <div style={sectionLabel}>Activity ({d.entries.length})</div>
          {d.entries.map((e) => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
              <span>
                {ENTRY_KIND_LABEL[e.kind] ?? e.kind}
                {typeof e.meta.reason === 'string' ? <span style={{ color: 'var(--text-tertiary)' }}> — {e.meta.reason}</span> : null}
              </span>
              <span style={{ display: 'flex', gap: 12, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontWeight: 600 }}>{money(e.amountCents)}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>{new Date(e.createdAt).toLocaleDateString()}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────────── Shared bits ─────────────────────────── */

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
      padding: '8px 10px', textAlign: align ?? 'left',
    }}>
      {children}
    </th>
  );
}

function Td({ children, align, mono }: { children: React.ReactNode; align?: 'right'; mono?: boolean }) {
  return (
    <td style={{
      padding: '9px 10px',
      textAlign: align ?? 'left',
      fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
      whiteSpace: 'nowrap',
      verticalAlign: 'top',
    }}>
      {children}
    </td>
  );
}

function LabeledInput({
  label, value, onChange, placeholder, type = 'text', suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  suffix?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          style={{
            flex: 1,
            padding: '8px 10px',
            fontSize: 14,
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-elevated)',
            color: 'var(--text-primary)',
          }}
        />
        {suffix ? <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>{suffix}</span> : null}
      </div>
    </label>
  );
}

function TypeChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        border: on ? '1px solid var(--brand-500)' : '1px solid var(--border-default)',
        background: on ? 'var(--brand-500)' : 'var(--surface-elevated)',
        color: on ? 'white' : 'var(--text-primary)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 999,
  border: '1px solid var(--brand-500)',
  background: 'var(--brand-500)',
  color: 'white',
  cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 999,
  border: '1px solid var(--border-default)',
  background: 'var(--surface-elevated)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
};
const destructiveBtn: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 999,
  border: '1px solid var(--border-default)',
  background: 'var(--surface-elevated)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
};
const onChipStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
  padding: '3px 9px', borderRadius: 999,
  background: 'var(--success)', color: '#fff',
};
const offChipStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
  padding: '3px 9px', borderRadius: 999,
  background: 'var(--surface-secondary)', color: 'var(--text-tertiary)',
  border: '1px solid var(--border-default)',
};
const kindPill: React.CSSProperties = {
  fontSize: 12,
  padding: '4px 10px',
  borderRadius: 999,
  background: 'var(--surface-secondary)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)',
  fontVariantNumeric: 'tabular-nums',
};
const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'var(--text-tertiary)', marginBottom: 8,
};
const searchInput: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-default)',
  color: 'var(--text-primary)',
};
const resultRowBtn: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  width: '100%',
  textAlign: 'left',
  padding: '10px 12px',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--border-subtle)',
  cursor: 'pointer',
  font: 'inherit',
  color: 'var(--text-primary)',
};

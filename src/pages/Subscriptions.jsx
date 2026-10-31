import { useMemo } from 'react';
import { Repeat, TrendingUp, EyeOff, CheckCircle2, XCircle, ArrowRight, AlertTriangle } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { detectRecurring } from '../lib/finance.js';
import { inr, dateLabel } from '../lib/format.js';
import { Card, Badge, CatBadge, Empty, Stat } from '../components/ui.jsx';

export default function Subscriptions({ go }) {
  const { state, dispatch, notify } = useStore();
  const all = useMemo(() => detectRecurring(state.txns, state.subs), [state.txns, state.subs]);
  const subs = all.filter((s) => s.isSub);
  const bills = all.filter((s) => !s.isSub);
  const monthly = subs.reduce((a, s) => a + s.perMonth, 0);
  const waste = subs.filter((s) => s.status === 'unused' || s.status === 'cancel').reduce((a, s) => a + s.perMonth, 0);
  const hikes = all.filter((s) => s.alerts.some((a) => a.kind === 'price_up'));
  const ott = subs.filter((s) => /netflix|hotstar|prime|sonyliv|zee5|jiocinema/i.test(s.key));

  const set = (s, status) => {
    dispatch({ type: 'SET_SUB', key: s.key, status, label: s.merchant });
    notify(status === 'using' ? `Noted — ${s.merchant} is in use.` : `${s.merchant} flagged: ${inr(s.perYear)}/yr could go to your goals.`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recurring payments</h1>
        <p className="text-sm text-slate-500">Auto-detected from cadence + amount patterns. I watch for price hikes, missed charges and things you've stopped using.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Subscriptions" value={`${inr(monthly)}/mo`} sub={`${inr(monthly * 12)} a year`} />
        <Stat label="Recurring bills & SIPs" value={bills.length} sub={`${inr(bills.reduce((a, s) => a + s.perMonth, 0))}/mo`} />
        <Stat label="Price hikes" value={hikes.length} tone={hikes.length ? 'red' : 'green'} sub={hikes.map((h) => h.merchant).join(', ') || 'none'} />
        <Stat label="Unused / cancelling" value={`${inr(waste * 12)}/yr`} tone={waste ? 'amber' : 'green'} sub="money you could redirect" />
      </div>

      {(waste > 0 || ott.length >= 2) && (
        <div className="card p-4 bg-amber-50 border-amber-200 flex flex-wrap gap-3 items-center justify-between">
          <div className="text-sm text-amber-900 flex gap-2"><AlertTriangle size={16} className="mt-0.5" />
            <span>{waste > 0 ? <>Cancelling what you don't use frees <b>{inr(waste)}/mo</b>. </> : null}{ott.length >= 2 ? <>You pay for <b>{ott.length} video streaming</b> services ({ott.map((o) => o.merchant).join(', ')}) — rotating one at a time saves ~{inr(Math.min(...ott.map((o) => o.perMonth)) * 12)}/yr.</> : null}</span>
          </div>
          {waste > 0 && <button className="btn btn-dark" onClick={() => go('plan', { scenario: { label: 'Cancel unused subscriptions', cancelSubs: Math.round(waste) } })}>See goal impact <ArrowRight size={14} /></button>}
        </div>
      )}

      <Card title="Subscriptions" subtitle="Confirm what you still use — the coach tracks waste" pad={false}>
        <div className="divide-y divide-slate-100">
          {subs.map((s) => <Row key={s.key} s={s} set={set} />)}
          {!subs.length && <Empty>No subscriptions detected yet. Import a few months of SMS/statement.</Empty>}
        </div>
      </Card>

      <Card title="Other recurring payments" subtitle="Rent, bills, SIPs, EMIs, transfers" pad={false}>
        <div className="divide-y divide-slate-100">
          {bills.map((s) => <Row key={s.key} s={s} set={set} compact />)}
          {!bills.length && <Empty>Nothing else recurring yet.</Empty>}
        </div>
      </Card>
    </div>
  );
}

function Row({ s, set, compact }) {
  const max = Math.max(...s.history.map((h) => h.amount));
  return (
    <div className="px-5 py-4 flex flex-wrap items-center gap-4">
      <div className="h-10 w-10 rounded-xl bg-fuchsia-50 text-fuchsia-600 grid place-items-center"><Repeat size={17} /></div>
      <div className="flex-1 min-w-[200px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">{s.merchant}</span>
          <CatBadge cat={s.category} />
          <Badge>{s.cadence} · {s.count}×</Badge>
          {s.status === 'using' && <Badge tone="green">using</Badge>}
          {s.status === 'unused' && <Badge tone="amber">not using</Badge>}
          {s.status === 'cancel' && <Badge tone="red">cancelling</Badge>}
        </div>
        <div className="text-xs text-slate-500 mt-1">Last {dateLabel(s.lastDate)} · next ≈ {dateLabel(s.nextDate)} · {inr(s.perYear)}/yr</div>
        {s.alerts.map((a, i) => (
          <div key={i} className={`text-xs mt-1 flex items-center gap-1 ${a.kind === 'price_up' || a.kind === 'unused' ? 'text-red-700' : a.kind === 'missed' ? 'text-amber-700' : 'text-slate-500'}`}>
            {a.kind === 'price_up' ? <TrendingUp size={12} /> : a.kind === 'unused' ? <EyeOff size={12} /> : <AlertTriangle size={12} />}{a.text}
          </div>
        ))}
      </div>
      <div className="flex items-end gap-[3px] h-8" title="Charge history">
        {s.history.slice(-6).map((h, i) => (
          <div key={i} className="w-2 rounded-t-sm" style={{ height: `${Math.max(15, (h.amount / max) * 100)}%`, background: i === s.history.slice(-6).length - 1 && s.change > 3 ? '#dc2626' : '#cbd5e1' }} title={`${dateLabel(h.date)}: ${inr(h.amount)}`} />
        ))}
      </div>
      <div className="text-right w-24 font-semibold">{inr(s.lastAmount)}</div>
      {!compact && (
        <div className="flex gap-1">
          <button className="btn btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => set(s, 'using')}><CheckCircle2 size={14} className="text-emerald-600" /> Using</button>
          <button className="btn btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => set(s, 'unused')}><EyeOff size={14} className="text-amber-600" /> Not using</button>
          <button className="btn btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => set(s, 'cancel')}><XCircle size={14} className="text-red-600" /> Cancel</button>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState, useEffect } from 'react';
import { Printer, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { monthStats, monthsPresent, prevMonthKey, detectRecurring, simulate, budgets } from '../lib/finance.js';
import { callAI } from '../lib/ai.js';
import { inr, monthLabel, monthKey, todayISO, dateLabel } from '../lib/format.js';
import { Card, Stat, Markdown, Badge, Wave, Progress } from '../components/ui.jsx';
import { CAT_EMOJI } from '../lib/categories.js';

export default function Review() {
  const { state } = useStore();
  const months = monthsPresent(state.txns).reverse();
  const cur = monthKey(todayISO());
  const [m, setM] = useState(months.find((x) => x !== cur) || months[0] || cur);
  const [ai, setAi] = useState({});
  const [busy, setBusy] = useState(false);

  const st = useMemo(() => monthStats(state.txns, m), [state.txns, m]);
  const prev = useMemo(() => monthStats(state.txns, prevMonthKey(m)), [state.txns, m]);
  const bud = useMemo(() => budgets(state, m), [state, m]);
  const subs = useMemo(() => detectRecurring(state.txns, state.subs).filter((s) => s.isSub), [state]);
  const sim = useMemo(() => simulate(state), [state]);
  const cats = Object.entries(st.byCat).sort((a, b) => b[1] - a[1]);
  const maxCat = cats[0]?.[1] || 1;

  const facts = {
    month: monthLabel(m), income: st.income, spend: st.spend, invested: st.invested, savingsRate: Math.round(st.savingsRate),
    previousMonth: { spend: prev.spend, savingsRate: Math.round(prev.savingsRate) },
    categories: Object.fromEntries(cats.map(([c, v]) => [c, { spent: Math.round(v), budget: bud[c] || null, lastMonth: Math.round(prev.byCat[c] || 0) }])),
    topMerchants: Object.entries(st.byMerchant).sort((a, b) => b[1] - a[1]).slice(0, 5),
    subscriptions: subs.map((s) => ({ name: s.merchant, perMonth: Math.round(s.perMonth), alerts: s.alerts.map((a) => a.text) })),
    goals: sim.goals.map((g) => ({ name: g.name, target: g.target, saved: g.saved, onTrack: g.onTrack, eta: g.eta })),
    emergencyFundMonths: Number(sim.emergencyMonths.toFixed(1)),
  };

  async function generate() {
    setBusy(true);
    const res = await callAI('report', facts);
    setBusy(false);
    if (res.ok && res.data?.narrative) setAi((a) => ({ ...a, [m]: { ...res.data, provider: res.provider } }));
    else setAi((a) => ({ ...a, [m]: fallback(facts) }));
  }
  useEffect(() => { if (!ai[m] && st.count) generate(); }, [m]); // eslint-disable-line

  const r = ai[m];
  const diff = st.spend - prev.spend;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Monthly review</p>
          <h1 className="text-2xl font-bold tracking-tight">{monthLabel(m)}{m === cur ? ' (month to date)' : ''}</h1>
        </div>
        <div className="flex gap-2 no-print">
          <select className="input !w-40" value={m} onChange={(e) => setM(e.target.value)}>{months.map((x) => <option key={x} value={x}>{monthLabel(x)}</option>)}</select>
          <button className="btn btn-ghost" onClick={generate} disabled={busy}><Sparkles size={15} /> Regenerate</button>
          <button className="btn btn-dark" onClick={() => window.print()}><Printer size={15} /> Print / PDF</button>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 !border-0 text-white">
        {busy && !r ? <div className="flex items-center gap-2 text-slate-300 py-6"><Wave /> Writing your review…</div> : r ? (
          <div className="space-y-3 pt-2">
            <h2 className="text-xl font-bold">{r.headline}</h2>
            <div className="[&_.md]:text-slate-200 [&_p]:text-slate-200 [&_strong]:text-white"><Markdown text={r.narrative} /></div>
            <div>
              <div className="label !text-slate-400 mb-1.5">Next month, do this</div>
              <ol className="space-y-1.5">{(r.actions || []).map((a, i) => <li key={i} className="flex gap-2 text-sm"><span className="h-5 w-5 rounded-full bg-emerald-500 text-[11px] font-bold grid place-items-center shrink-0">{i + 1}</span>{a}</li>)}</ol>
            </div>
            <div className="text-[11px] text-slate-400">{r.provider}</div>
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Income" value={inr(st.income)} tone="green" />
        <Stat label="Spent" value={inr(st.spend)} sub={prev.spend ? <span className={diff > 0 ? 'text-red-600' : 'text-emerald-600'}>{diff > 0 ? <TrendingUp size={11} className="inline" /> : <TrendingDown size={11} className="inline" />} {inr(Math.abs(diff))} vs {monthLabel(prevMonthKey(m))}</span> : null} />
        <Stat label="Invested (SIPs etc.)" value={inr(st.invested)} />
        <Stat label="Savings rate" value={`${st.savingsRate.toFixed(0)}%`} tone={st.savingsRate >= 20 ? 'green' : 'amber'} sub={prev.income ? `last month ${prev.savingsRate.toFixed(0)}%` : ''} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Where it went" subtitle="vs budget and last month">
          <div className="space-y-2.5">
            {cats.map(([c, v]) => {
              const b = bud[c];
              const pv = prev.byCat[c] || 0;
              return (
                <div key={c}>
                  <div className="flex justify-between text-sm">
                    <span>{CAT_EMOJI[c]} {c}</span>
                    <span className="tabular-nums"><b>{inr(v)}</b>{b ? <span className="text-slate-400"> / {inr(b)}</span> : null}{pv ? <span className={`ml-2 text-xs ${v > pv ? 'text-red-600' : 'text-emerald-600'}`}>{v > pv ? '▲' : '▼'}{Math.abs(Math.round(((v - pv) / pv) * 100))}%</span> : null}</span>
                  </div>
                  <Progress value={(v / maxCat) * 100} color={b && v > b ? '#dc2626' : '#059669'} height={6} />
                </div>
              );
            })}
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Biggest spends">
            <div className="space-y-1.5">
              {st.biggest.map((t) => <div key={t.id} className="flex justify-between text-sm"><span>{dateLabel(t.date)} · {t.merchant}</span><b>{inr(t.amount)}</b></div>)}
            </div>
          </Card>
          <Card title="Subscriptions" subtitle={`${inr(subs.reduce((a, s) => a + s.perMonth, 0))}/month`}>
            <div className="flex flex-wrap gap-2">
              {subs.map((s) => <Badge key={s.key} tone={s.alerts.some((a) => a.kind === 'price_up' || a.kind === 'unused') ? 'red' : 'slate'}>{s.merchant} {inr(s.lastAmount)}{s.alerts.some((a) => a.kind === 'price_up') ? ' ▲' : ''}</Badge>)}
            </div>
          </Card>
          <Card title="Goals">
            <div className="space-y-2">
              {sim.goals.map((g) => <div key={g.id} className="flex justify-between text-sm"><span>{g.name}</span><Badge tone={g.onTrack ? 'green' : 'red'}>{g.onTrack ? 'on track' : `ETA ${g.eta ? dateLabel(g.eta) : '—'}`}</Badge></div>)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function fallback(f) {
  const cats = Object.entries(f.categories).sort((a, b) => b[1].spent - a[1].spent);
  const over = cats.filter(([, v]) => v.budget && v.spent > v.budget);
  return {
    headline: f.savingsRate >= 25 ? `Solid month — you kept ${f.savingsRate}% of your income.` : `You kept ${f.savingsRate}% — room to tighten up.`,
    narrative: `In **${f.month}** you earned **${inr(f.income)}**, spent **${inr(f.spend)}** and invested **${inr(f.invested)}**. ${f.previousMonth.spend ? `That's ${f.spend > f.previousMonth.spend ? 'more' : 'less'} than last month (${inr(f.previousMonth.spend)}).` : ''}\n\nBiggest buckets: ${cats.slice(0, 3).map(([c, v]) => `**${c}** ${inr(v.spent)}`).join(', ')}. ${over.length ? `Over plan in ${over.map(([c]) => c).join(', ')}.` : 'You stayed within plan everywhere.'} Emergency fund covers ${f.emergencyFundMonths} months of essentials.`,
    actions: [
      over[0] ? `Cap ${over[0][0]} at ${inr(over[0][1].budget)} — set a weekly check-in.` : 'Keep the same budgets — they worked.',
      f.subscriptions.some((s) => s.alerts.length) ? `Review flagged subscriptions: ${f.subscriptions.filter((s) => s.alerts.length).map((s) => s.name).join(', ')}.` : 'Audit subscriptions once — cancel anything unused for 30 days.',
      f.emergencyFundMonths < 6 ? 'Route surplus to the emergency fund until it covers 6 months.' : 'Emergency fund is healthy — direct surplus to your next goal.',
    ],
    provider: 'Local report engine (offline fallback)',
  };
}

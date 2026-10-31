import { useMemo } from 'react';
import { Mic, TrendingUp, Wallet, PiggyBank, ShieldCheck, AlertTriangle, Brain, Repeat, ArrowRight, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { useStore } from '../lib/store.jsx';
import { monthStats, budgets, nudges, detectRecurring, simulate, prevMonthKey } from '../lib/finance.js';
import { inr, inrShort, monthKey, todayISO, monthLabel, dateLabel } from '../lib/format.js';
import { Card, Stat, Badge, Progress, Empty } from '../components/ui.jsx';
import { CAT_EMOJI } from '../lib/categories.js';

export default function Dashboard({ go, openVoice }) {
  const { state } = useStore();
  const key = monthKey(todayISO());
  const st = useMemo(() => monthStats(state.txns, key), [state.txns, key]);
  const last = useMemo(() => monthStats(state.txns, prevMonthKey(key)), [state.txns, key]);
  const bud = useMemo(() => budgets(state, key), [state, key]);
  const nd = useMemo(() => nudges(state), [state]);
  const subs = useMemo(() => detectRecurring(state.txns, state.subs), [state.txns, state.subs]);
  const sim = useMemo(() => simulate(state), [state]);
  const subAlerts = subs.filter((s) => s.alerts.some((a) => a.kind !== 'check'));
  const day = Number(todayISO().slice(8, 10));
  const dim = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate();

  const chart = Object.entries(bud)
    .filter(([c]) => !['Transfers'].includes(c))
    .map(([c, b]) => ({ cat: c, short: { 'Food & Dining': 'Dining', 'Utilities & Bills': 'Bills', Entertainment: 'Fun', 'Health & Fitness': 'Health', 'Rent & Housing': 'Housing', Subscriptions: 'Subs', 'Investments & Savings': 'Invest', 'Personal Care': 'Care', 'EMI & Loans': 'EMI' }[c] || c.split(' ')[0], spent: Math.round(st.byCat[c] || 0), budget: b, pace: Math.round(b * (day / dim)) }))
    .filter((d) => d.spent || d.budget)
    .sort((a, b) => b.budget - a.budget)
    .slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{monthLabel(key)} · day {day} of {dim}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Namaste{state.profile?.name ? `, ${state.profile.name}` : ''} 👋</h1>
        </div>
        <button onClick={() => openVoice()} className="btn btn-dark !py-3 !px-5 !rounded-2xl">
          <span className="h-7 w-7 rounded-full bg-amber-500 grid place-items-center"><Mic size={15} /></span>
          Just say what you spent
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<Wallet size={13} />} label="Spent this month" value={inr(st.spend)} sub={last.spend ? `${monthLabel(prevMonthKey(key))}: ${inr(last.spend)}` : ' '} />
        <Stat icon={<TrendingUp size={13} />} label="Income this month" value={inr(st.income)} tone="green" sub={`Plan: ${inr(sim.income)}/mo`} />
        <Stat icon={<PiggyBank size={13} />} label="Monthly surplus (plan)" value={inr(sim.surplus)} tone={sim.surplus > 0 ? 'green' : 'red'} sub={`${sim.savingsRate.toFixed(0)}% savings rate`} />
        <Stat icon={<ShieldCheck size={13} />} label="Emergency fund" value={`${sim.emergencyMonths.toFixed(1)} mo`} tone={sim.emergencyMonths >= 6 ? 'green' : sim.emergencyMonths >= 3 ? 'amber' : 'red'} sub={`${inr(state.profile?.emergencyFund || 0)} · target 6 months`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="Spending vs plan" subtitle="Spent this month next to its budget · colour shows pace vs. day of month">
          {chart.length ? (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="#eef1f5" />
                  <XAxis dataKey="short" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tickFormatter={inrShort} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} content={<BudgetTip />} />
                  <Bar dataKey="budget" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spent" radius={[4, 4, 0, 0]}>
                    {chart.map((d) => <Cell key={d.cat} fill={d.spent > d.budget ? '#dc2626' : d.spent > d.pace * 1.15 ? '#d97706' : '#059669'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty>No spending yet this month.</Empty>}
          <div className="flex gap-4 text-xs text-slate-500 mt-2">
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#e2e8f0]" />Budget</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#059669]" />On track</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#d97706]" />Ahead of pace</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#dc2626]" />Over budget</span>
          </div>
        </Card>

        <Card title="Coach nudges" subtitle="Spending drifting off plan" right={<Badge tone={nd.length ? 'amber' : 'green'}>{nd.length || 'All good'}</Badge>}>
          <div className="space-y-2.5">
            {nd.slice(0, 4).map((n) => (
              <div key={n.id} className={`rounded-xl p-3 text-sm ${n.level === 'high' ? 'bg-red-50 text-red-900' : 'bg-amber-50 text-amber-900'}`}>
                <div className="flex gap-2"><AlertTriangle size={15} className="shrink-0 mt-0.5" /> <span>{n.text}</span></div>
                {n.goalImpact && <div className="text-xs mt-1 opacity-80 pl-6">{n.goalImpact}</div>}
              </div>
            ))}
            {nd.totalImpact && nd.length > 1 && <div className="text-xs font-semibold text-slate-600 px-1">{nd.totalImpact}</div>}
            {!nd.length && <Empty>You're within plan in every category. 🎉</Empty>}
            {!!nd.length && (
              <button className="btn btn-ghost w-full" onClick={() => go('plan', { scenario: { label: 'Fix the drift', categoryPct: Object.fromEntries(nd.slice(0, 2).map((n) => [n.cat, -20])) } })}>
                Simulate cutting these 20% <ArrowRight size={14} />
              </button>
            )}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Goals" subtitle="Projected with your current habits" right={<button className="text-xs text-emerald-700 font-semibold" onClick={() => go('plan')}>Planner →</button>}>
          <div className="space-y-4">
            {sim.goals.map((g) => (
              <div key={g.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-1.5"><Target size={14} className="text-slate-400" />{g.name}</span>
                  <Badge tone={g.onTrack ? 'green' : 'red'}>{g.onTrack ? 'On track' : g.eta ? `${g.slipMonths} mo late` : 'Not reachable'}</Badge>
                </div>
                <Progress value={(g.saved / g.target) * 100} />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>{inr(g.saved)} of {inr(g.target)}</span>
                  <span>Due {dateLabel(g.targetDate)} · ETA {g.eta ? dateLabel(g.eta) : '—'}</span>
                </div>
              </div>
            ))}
            {!sim.goals.length && <Empty>No goals yet. Say “I want to save 2 lakh for Japan by next December”.</Empty>}
          </div>
        </Card>

        <Card title="Subscriptions & recurring" subtitle={`${subs.length} detected · ${inr(subs.filter((s) => s.isSub).reduce((a, s) => a + s.perMonth, 0))}/mo on subscriptions`} right={<button className="text-xs text-emerald-700 font-semibold" onClick={() => go('subscriptions')}>All →</button>}>
          <div className="space-y-2">
            {subAlerts.slice(0, 4).map((s) => (
              <div key={s.key} className="flex items-start gap-2 text-sm rounded-xl bg-slate-50 p-2.5">
                <Repeat size={15} className="text-fuchsia-600 mt-0.5 shrink-0" />
                <div><b>{s.merchant}</b> <span className="text-slate-500">· {inr(s.lastAmount)}/{s.cadence === 'monthly' ? 'mo' : s.cadence}</span>
                  {s.alerts.filter((a) => a.kind !== 'check').map((a, i) => <div key={i} className="text-xs text-red-700">{a.text}</div>)}
                </div>
              </div>
            ))}
            {!subAlerts.length && <Empty>No price hikes or unused subscriptions flagged.</Empty>}
          </div>
        </Card>

        <Card title="What I've learned" subtitle="Your living money model updates as you talk & correct" right={<Brain size={16} className="text-violet-500" />}>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {state.learnLog.slice(0, 8).map((l) => (
              <div key={l.id} className="text-sm flex gap-2">
                <span className="text-xs mt-0.5">{{ rule: '🧠', import: '📥', profile: '👤', goal: '🎯', sub: '🔁' }[l.kind] || '•'}</span>
                <span className="text-slate-700">{l.text}</span>
              </div>
            ))}
            {!state.learnLog.length && (
              <div className="text-sm text-slate-500 space-y-2">
                <p>Nothing yet. Try teaching me:</p>
                <p className="italic">“Ramesh Kumar is my landlord, that's rent not transfer.”</p>
                <button className="btn btn-ghost w-full" onClick={() => openVoice("Ramesh Kumar is basically my landlord yaar, so that should be rent, not transfer")}><Mic size={14} /> Try it by voice</button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function BudgetTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold mb-1">{d.cat}</div>
      <div>Spent: <b>{inr(d.spent)}</b></div>
      <div>Budget: {inr(d.budget)}</div>
      <div className="text-slate-500">Expected by today: {inr(d.pace)}</div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Mic, RotateCcw, Target, ShieldCheck } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useStore } from '../lib/store.jsx';
import { simulate, planInputs } from '../lib/finance.js';
import { inr, inrShort, dateLabel } from '../lib/format.js';
import { Card, Badge, Stat } from '../components/ui.jsx';
import { CAT_EMOJI } from '../lib/categories.js';

const EMPTY = { label: '', categoryPct: {}, rentChange: 0, incomeChangePct: 0, extraMonthlySaving: 0, oneTimeExpense: 0, cancelSubs: 0 };
const PRESETS = [
  { label: 'Cut dining out 30%', categoryPct: { 'Food & Dining': -30 } },
  { label: 'Rent goes up ₹3,000', rentChange: 3000 },
  { label: '10% appraisal', incomeChangePct: 10 },
  { label: 'Shopping −50%, dining −20%', categoryPct: { Shopping: -50, 'Food & Dining': -20 } },
  { label: 'New bike EMI ₹4,000/mo', extraMonthlySaving: -4000 },
  { label: 'Goa trip ₹40k next month', oneTimeExpense: 40000 },
];

export default function Plan({ payload, openVoice }) {
  const { state } = useStore();
  const [sc, setSc] = useState(EMPTY);
  useEffect(() => { if (payload?.scenario) setSc({ ...EMPTY, ...payload.scenario, categoryPct: { ...(payload.scenario.categoryPct || {}) } }); }, [payload]);

  const { base } = useMemo(() => planInputs(state), [state]);
  const baseSim = useMemo(() => simulate(state, {}), [state]);
  const sim = useMemo(() => simulate(state, sc), [state, sc]);
  const series = baseSim.series.map((p, i) => ({ label: p.label, Today: p.cumulative, Scenario: sim.series[i].cumulative }));
  const sliders = Object.entries(base).filter(([c]) => !['Rent & Housing', 'Transfers', 'EMI & Loans'].includes(c)).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const active = JSON.stringify(sc) !== JSON.stringify(EMPTY);
  const delta = sim.surplus - baseSim.surplus;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Goal planner & what-if</h1>
          <p className="text-sm text-slate-500">Baseline = your last 3 months of real spending. Change a lever — or just ask out loud.</p>
        </div>
        <button className="btn btn-dark" onClick={() => openVoice('What if I, uh, cut dining out by like 30 percent and, you know, my rent goes up by 3k next year?')}><Mic size={15} className="text-amber-400" /> “What if…” by voice</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => <button key={p.label} className="chip bg-white border border-slate-200 hover:bg-slate-50 !py-1.5 !px-3" onClick={() => setSc({ ...EMPTY, ...p, categoryPct: { ...(p.categoryPct || {}) } })}>{p.label}</button>)}
        {active && <button className="chip bg-slate-900 text-white !py-1.5 !px-3" onClick={() => setSc(EMPTY)}><RotateCcw size={12} /> Reset</button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Monthly surplus" value={inr(sim.surplus)} tone={sim.surplus >= 0 ? 'green' : 'red'} sub={active ? `${delta >= 0 ? '+' : ''}${inr(delta)} vs today` : 'today'} />
        <Stat label="Savings rate" value={`${sim.savingsRate.toFixed(0)}%`} sub={active ? `today ${baseSim.savingsRate.toFixed(0)}%` : 'of income'} />
        <Stat label="In 12 months" value={inrShort(sim.series[11]?.cumulative)} sub={active ? `today ${inrShort(baseSim.series[11]?.cumulative)}` : 'cumulative savings'} />
        <Stat label="Emergency cover" value={`${sim.emergencyMonths.toFixed(1)} mo`} tone={sim.emergencyMonths >= 6 ? 'green' : 'amber'} sub={`essentials ${inr(sim.essentials)}/mo`} />
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2" title="Levers" subtitle={sc.label ? `Scenario: ${sc.label}` : 'Monthly averages from your data'}>
          <div className="space-y-4">
            {sliders.map(([c, v]) => {
              const p = sc.categoryPct[c] || 0;
              return (
                <div key={c}>
                  <div className="flex justify-between text-sm">
                    <span>{CAT_EMOJI[c]} {c}</span>
                    <span className="tabular-nums"><span className="text-slate-400">{inr(v)} →</span> <b>{inr(v * (1 + p / 100))}</b> <span className={p < 0 ? 'text-emerald-600' : p > 0 ? 'text-red-600' : 'text-slate-400'}>{p > 0 ? '+' : ''}{p}%</span></span>
                  </div>
                  <input type="range" min={-60} max={60} step={5} value={p} className="w-full accent-emerald-600" onChange={(e) => setSc({ ...sc, label: sc.label || 'Custom', categoryPct: { ...sc.categoryPct, [c]: Number(e.target.value) } })} />
                </div>
              );
            })}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <Field label="Rent change / mo" value={sc.rentChange} onChange={(v) => setSc({ ...sc, rentChange: v })} />
              <Field label="Income change %" value={sc.incomeChangePct} onChange={(v) => setSc({ ...sc, incomeChangePct: v })} />
              <Field label="Extra saving / mo" value={sc.extraMonthlySaving} onChange={(v) => setSc({ ...sc, extraMonthlySaving: v })} />
              <Field label="One-time expense" value={sc.oneTimeExpense} onChange={(v) => setSc({ ...sc, oneTimeExpense: v })} />
            </div>
          </div>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <Card title="Cumulative savings, next 3 years" subtitle={active ? 'Today’s habits vs your scenario' : 'Based on today’s habits'}>
            <div className="h-60">
              <ResponsiveContainer>
                <LineChart data={series} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef1f5" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={5} />
                  <YAxis tickFormatter={inrShort} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip formatter={(v, n) => [inr(v), n]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Line type="monotone" dataKey="Today" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray={active ? '5 4' : undefined} />
                  {active && <Line type="monotone" dataKey="Scenario" stroke="#059669" strokeWidth={2} dot={false} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {active && <div className="flex gap-4 text-xs text-slate-500"><span className="flex items-center gap-1"><i className="w-4 border-t-2 border-dashed border-slate-400" />Today</span><span className="flex items-center gap-1"><i className="w-4 border-t-2 border-emerald-600" />Scenario</span></div>}
          </Card>

          <Card title="Goals under this scenario" right={<Target size={16} className="text-slate-400" />}>
            <div className="space-y-3">
              {sim.goals.map((g, i) => {
                const b = baseSim.goals[i];
                const moved = b?.doneAt != null && g.doneAt != null ? b.doneAt - g.doneAt : null;
                return (
                  <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
                    <div>
                      <div className="font-medium">{g.name}</div>
                      <div className="text-xs text-slate-500">{inr(g.target)} by {dateLabel(g.targetDate)} · saved {inr(g.saved)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">ETA <b>{g.eta ? dateLabel(g.eta) : 'beyond 3 yrs'}</b></span>
                      {active && moved != null && moved !== 0 && <Badge tone={moved > 0 ? 'green' : 'red'}>{moved > 0 ? `${moved} mo sooner` : `${-moved} mo later`}</Badge>}
                      <Badge tone={g.onTrack ? 'green' : 'red'}>{g.onTrack ? 'on track' : 'at risk'}</Badge>
                    </div>
                  </div>
                );
              })}
              {!sim.goals.length && <div className="text-sm text-slate-500">Add goals in Profile, or say “save 2 lakh for Japan by next October”.</div>}
            </div>
          </Card>
          <div className="text-xs text-slate-500 flex items-start gap-1.5"><ShieldCheck size={14} className="text-emerald-600 shrink-0" /> Models cash-flow scenarios with your own numbers. It does not assume investment returns and does not recommend specific securities.</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input type="number" className="input mt-1" value={value || 0} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

import { useMemo, useState } from 'react';
import { Search, Brain, Trash2, Sparkles, X, Check } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { CATEGORIES } from '../lib/categories.js';
import { callAI } from '../lib/ai.js';
import { inr, dateLabel, monthKey, monthLabel } from '../lib/format.js';
import { monthsPresent } from '../lib/finance.js';
import { Card, CatBadge, Badge, Empty, Wave } from '../components/ui.jsx';

const SRC = { sms: ['SMS', 'indigo'], csv: ['CSV', 'violet'], pdf: ['PDF', 'violet'], voice: ['Voice', 'amber'], demo: ['Bank feed', 'slate'] };
const HOW = { rule: ['learned rule', 'green'], dict: ['merchant DB', 'slate'], ai: ['AI', 'indigo'], manual: ['you', 'amber'], voice: ['voice', 'amber'], default: ['unsure', 'red'] };

export default function Transactions() {
  const { state, dispatch, notify } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [month, setMonth] = useState('');
  const [pending, setPending] = useState(null); // {id, category, key, count}
  const [aiBusy, setAiBusy] = useState(false);
  const months = monthsPresent(state.txns).reverse();

  const list = useMemo(() => state.txns.filter((t) =>
    (!q || `${t.merchant} ${t.raw} ${t.category}`.toLowerCase().includes(q.toLowerCase())) &&
    (!cat || t.category === cat) && (!month || monthKey(t.date) === month)), [state.txns, q, cat, month]);

  const unsure = state.txns.filter((t) => t.category === 'Other' || t.catSource === 'default');

  function changeCat(t, category) {
    const key = t.merchantKey;
    const similar = state.txns.filter((x) => x.id !== t.id && x.catSource !== 'manual' && `${x.merchant} ${x.merchantKey} ${x.raw || ''}`.toLowerCase().includes(key)).length;
    dispatch({ type: 'SET_CATEGORY', id: t.id, category, learn: false });
    setPending({ id: t.id, category, key, count: similar, merchant: t.merchant, from: t.category });
  }

  function learn() {
    dispatch({ type: 'SET_CATEGORY', id: pending.id, category: pending.category, learn: true, key: pending.key });
    notify(`🧠 Learned: “${pending.key}” → ${pending.category}. Future & ${pending.count} past transactions updated.`);
    setPending(null);
  }

  async function aiCategorize() {
    setAiBusy(true);
    const merchants = [...new Set(unsure.map((t) => t.merchant))].slice(0, 30);
    const res = await callAI('categorize', merchants.map((m) => ({ merchant: m, sample: unsure.find((t) => t.merchant === m)?.raw })));
    setAiBusy(false);
    if (!res.ok) return notify('AI is busy right now — try again, or fix one manually and I will learn it.', 'warn');
    let n = 0;
    for (const r of res.data?.results || []) {
      if (!CATEGORIES.includes(r.category) || r.category === 'Other') continue;
      unsure.filter((t) => t.merchant === r.merchant).forEach((t) => { dispatch({ type: 'UPDATE_TXN', id: t.id, patch: { category: r.category, catSource: 'ai' } }); n++; });
    }
    notify(`✨ ${res.provider} categorised ${n} transaction${n === 1 ? '' : 's'}. Correct any — I'll learn from it.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-slate-500">Fix a category once → PaisaVaani learns the rule and re-labels the past.</p>
        </div>
        {!!unsure.length && (
          <button className="btn btn-ghost" onClick={aiCategorize} disabled={aiBusy}>{aiBusy ? <><Wave /> Thinking…</> : <><Sparkles size={15} className="text-indigo-600" /> AI-categorise {unsure.length} unsure</>}</button>
        )}
      </div>

      {pending && (
        <div className="card p-4 border-emerald-300 bg-emerald-50 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-start gap-3">
            <Brain className="text-emerald-700 mt-0.5" size={20} />
            <div className="text-sm">
              <div className="font-semibold text-emerald-900">Should I remember this?</div>
              <div className="text-emerald-800">Always file <b>“{pending.key}”</b> under <b>{pending.category}</b>{pending.count ? <> — and fix <b>{pending.count}</b> similar past transaction{pending.count === 1 ? '' : 's'}</> : ''}.</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => setPending(null)}><X size={14} /> Just this one</button>
            <button className="btn btn-primary" onClick={learn}><Check size={14} /> Learn rule</button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3" pad={false}>
          <div className="flex flex-wrap gap-2 p-4 border-b border-slate-100">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input className="input !pl-9" placeholder="Search merchant, note…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input !w-48" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="input !w-36" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">All months</option>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-2 font-medium">Date</th><th className="font-medium">Merchant</th><th className="font-medium">Category</th><th className="font-medium">Source</th><th className="text-right px-4 font-medium">Amount</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, 250).map((t) => (
                  <tr key={t.id} className={`border-b border-slate-50 hover:bg-slate-50/70 ${pending?.id === t.id ? 'bg-emerald-50/60' : ''}`}>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-500">{dateLabel(t.date)}</td>
                    <td className="pr-2">
                      <div className="font-medium text-slate-800">{t.merchant}</div>
                      {t.raw && t.raw !== t.merchant && <div className="text-[11px] text-slate-400 truncate max-w-[260px]" title={t.raw}>{t.raw}</div>}
                    </td>
                    <td className="pr-2">
                      <div className="flex items-center gap-1.5">
                        <select className="text-xs bg-transparent border border-transparent hover:border-slate-200 rounded-md py-1 cursor-pointer max-w-[170px]" value={t.category} onChange={(e) => changeCat(t, e.target.value)}>
                          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                        {HOW[t.catSource] && <Badge tone={HOW[t.catSource][1]}>{HOW[t.catSource][0]}</Badge>}
                      </div>
                    </td>
                    <td><Badge tone={(SRC[t.source] || ['', 'slate'])[1]}>{(SRC[t.source] || [t.source])[0]}</Badge></td>
                    <td className={`text-right px-4 font-semibold whitespace-nowrap ${t.direction === 'credit' ? 'text-emerald-600' : 'text-slate-800'}`}>{t.direction === 'credit' ? '+' : '−'}{inr(t.amount)}</td>
                    <td className="pr-3"><button className="p-1 text-slate-300 hover:text-red-500" onClick={() => dispatch({ type: 'DELETE_TXN', id: t.id })}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.length && <Empty>No transactions match.</Empty>}
            {list.length > 250 && <div className="text-xs text-slate-400 p-3">Showing 250 of {list.length}</div>}
          </div>
        </Card>

        <Card title="Learned rules" subtitle="Rules beat the merchant DB and AI" right={<Brain size={16} className="text-violet-500" />}>
          <div className="space-y-2">
            {state.rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">“{r.key}”</div>
                  <div className="mt-1"><CatBadge cat={r.category} /></div>
                  <div className="text-[11px] text-slate-400 mt-1">from {r.source}</div>
                </div>
                <button className="p-1 text-slate-300 hover:text-red-500" onClick={() => dispatch({ type: 'DELETE_RULE', id: r.id })}><Trash2 size={14} /></button>
              </div>
            ))}
            {!state.rules.length && <Empty>Change any category in the table — or say “Ramesh Kumar is my rent” — and I'll learn it.</Empty>}
          </div>
        </Card>
      </div>
    </div>
  );
}

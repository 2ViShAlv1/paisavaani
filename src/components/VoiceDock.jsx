import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, X, Sparkles, Check, Wand2, ArrowRight, Cpu, ShieldCheck } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { callAI } from '../lib/ai.js';
import { localUnderstand } from '../lib/parse.js';
import { CATEGORIES, merchantKey, categorize } from '../lib/categories.js';
import { moneySummary, detectRecurring } from '../lib/finance.js';
import { inr, todayISO } from '../lib/format.js';
import { useSpeech, Wave, Badge } from './ui.jsx';

export const VOICE_EXAMPLES = [
  { label: 'Log spends (with self-correction)', text: "Umm so yesterday I spent like 400, no wait, 450 on Swiggy, and uh my Uber to office was, like, 230 rupees" },
  { label: 'Teach a category', text: "Ramesh Kumar is basically my landlord yaar, so that should be rent, not transfer" },
  { label: 'What-if', text: "What if I, uh, cut dining out by like 30 percent and, you know, my rent goes up by 3k next year?" },
  { label: 'Unused subscription', text: "Honestly I'm not using cult fit anymore, umm, haven't gone since August" },
  { label: 'New goal', text: "So I want to save for a, uh, a bike, around 1.2 lakh, no wait 1.5 lakh, by June next year" },
  { label: 'Guardrail test', text: "Which stock should I buy with my Diwali bonus? Like Reliance or something?" },
];

function highlight(raw, fillers = [], corrections = []) {
  const spans = [];
  const lower = raw.toLowerCase();
  const mark = (needle, kind, from = 0) => {
    if (!needle) return -1;
    const i = lower.indexOf(String(needle).toLowerCase().trim(), from);
    if (i >= 0) spans.push({ s: i, e: i + String(needle).trim().length, kind });
    return i;
  };
  for (const c of corrections) {
    const i = mark(c.heard, 'heard');
    mark(c.final, 'final', i >= 0 ? i + String(c.heard).length : 0);
  }
  const markers = /\b(no+,? wait|wait,? no|sorry|i mean|actually|make that|scratch that|nahi nahi)\b/gi;
  let m;
  while ((m = markers.exec(raw))) spans.push({ s: m.index, e: m.index + m[0].length, kind: 'filler' });
  for (const f of [...new Set(fillers)]) {
    const re = new RegExp(`(^|[^a-z])(${String(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[^a-z]|$)`, 'gi');
    while ((m = re.exec(raw))) spans.push({ s: m.index + m[1].length, e: m.index + m[1].length + m[2].length, kind: 'filler' });
  }
  spans.sort((a, b) => a.s - b.s || (a.kind === 'heard' ? -1 : 1));
  const out = [];
  let pos = 0;
  for (const sp of spans) {
    if (sp.s < pos) continue;
    if (sp.s > pos) out.push({ t: raw.slice(pos, sp.s) });
    out.push({ t: raw.slice(sp.s, sp.e), kind: sp.kind });
    pos = sp.e;
  }
  out.push({ t: raw.slice(pos) });
  return out;
}

function normalize(result, rules) {
  const actions = (result?.actions || []).map((a) => {
    if (a.type === 'log_transactions') {
      return {
        ...a,
        transactions: (a.transactions || []).filter((t) => Number(t.amount) > 0).map((t) => {
          const base = { date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : todayISO(), amount: Math.round(Number(t.amount)), direction: t.direction === 'credit' ? 'credit' : 'debit', merchant: t.merchant || 'Cash expense', note: t.note || '' };
          const learned = categorize({ ...base, merchantKey: merchantKey(base.merchant) }, rules);
          const cat = learned?.catSource === 'rule' ? learned.category : CATEGORIES.includes(t.category) ? t.category : learned?.category || 'Other';
          return { ...base, category: cat, include: true };
        }),
      };
    }
    if (a.type === 'set_rule') return { ...a, category: CATEGORIES.includes(a.category) ? a.category : 'Other', merchant: String(a.merchant || '').toLowerCase() };
    return a;
  }).filter((a) => a.type !== 'log_transactions' || a.transactions.length);
  return { ...result, actions: actions.map((a) => ({ ...a, include: true })) };
}

export default function VoiceDock({ open, setOpen, go, preset }) {
  const { state, dispatch, notify } = useStore();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | thinking | review
  const [result, setResult] = useState(null);
  const [provider, setProvider] = useState('');
  const taRef = useRef(null);
  const speech = useSpeech({ onFinal: (t) => setText((p) => (p ? `${p} ${t}` : t)) });

  useEffect(() => {
    if (open) {
      setTimeout(() => taRef.current?.focus(), 50);
      if (preset) { setText(preset); setPhase('idle'); setResult(null); }
    }
  }, [open, preset]);

  const reset = () => { setText(''); setPhase('idle'); setResult(null); setProvider(''); };

  async function understand(input = text) {
    if (!input.trim()) return;
    setPhase('thinking');
    const ctx = { today: todayISO(), summary: { categories_in_use: Object.keys(moneySummary(state).avgMonthlySpendByCategory), goals: state.goals.map((g) => g.name), learnedRules: state.rules.map((r) => `${r.key}→${r.category}`) } };
    const ai = await callAI('voice', input, ctx, 40000);
    let res;
    if (ai.ok && ai.data && Array.isArray(ai.data.actions)) {
      res = ai.data;
      setProvider(ai.provider);
    } else {
      res = localUnderstand(input, { today: todayISO() });
      setProvider('Local rule engine (offline fallback)');
    }
    setResult(normalize(res, state.rules));
    setPhase('review');
  }

  const segments = useMemo(() => (result ? highlight(text, result.fillers, result.corrections) : []), [result, text]);

  const patchAction = (i, patch) => setResult((r) => ({ ...r, actions: r.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const patchTxn = (i, k, patch) => setResult((r) => ({ ...r, actions: r.actions.map((a, j) => (j === i ? { ...a, transactions: a.transactions.map((t, x) => (x === k ? { ...t, ...patch } : t)) } : a)) }));

  function apply() {
    const msgs = [];
    let nav = null;
    for (const a of result.actions.filter((x) => x.include)) {
      if (a.type === 'log_transactions') {
        const txns = a.transactions.filter((t) => t.include).map(({ include, ...t }) => ({ ...t, merchantKey: merchantKey(t.merchant), source: 'voice', catSource: 'voice', raw: text }));
        if (txns.length) { dispatch({ type: 'ADD_TXNS', txns, source: 'voice' }); msgs.push(`${txns.length} txn logged`); }
      } else if (a.type === 'set_rule' && a.merchant) {
        dispatch({ type: 'ADD_RULE', key: a.merchant, category: a.category, source: 'voice' });
        msgs.push(`learned ${a.merchant} → ${a.category}`);
      } else if (a.type === 'update_profile') {
        dispatch({ type: 'UPDATE_PROFILE', profile: a.profile });
        msgs.push('profile updated');
      } else if (a.type === 'add_goal' && a.goal?.name) {
        dispatch({ type: 'ADD_GOAL', goal: { name: a.goal.name, target: Number(a.goal.target) || 0, saved: Number(a.goal.saved) || 0, targetDate: a.goal.targetDate || todayISO() } });
        msgs.push(`goal “${a.goal.name}” added`);
      } else if (a.type === 'subscription') {
        const subs = detectRecurring(state.txns, state.subs);
        const k = merchantKey(a.merchant).replace(/\s+/g, '');
        const hit = subs.find((s) => s.key.replace(/\s+/g, '').includes(k) || k.includes(s.key.replace(/\s+/g, '')) || s.merchant.toLowerCase().replace(/[^a-z]/g, '').includes(k.replace(/[^a-z]/g, '')));
        dispatch({ type: 'SET_SUB', key: hit?.key || merchantKey(a.merchant), status: a.status === 'cancel' ? 'cancel' : a.status === 'using' ? 'using' : 'unused', label: hit?.merchant || a.merchant });
        msgs.push(`${hit?.merchant || a.merchant} marked ${a.status}`);
        nav = nav || ['subscriptions'];
      } else if (a.type === 'what_if') {
        nav = ['plan', { scenario: a.scenario }];
      } else if (a.type === 'ask_coach') {
        nav = ['coach', { ask: a.question || result.clean_text }];
      }
    }
    if (msgs.length) notify(`✓ ${msgs.join(' · ')}`);
    setOpen(false);
    reset();
    if (nav) go(...nav);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-amber-100 text-amber-600 grid place-items-center"><Mic size={16} /></div>
            <div>
              <div className="font-semibold">Speak to PaisaVaani</div>
              <div className="text-xs text-slate-500">Talk naturally — fillers, Hinglish and “no wait…” corrections are fine.</div>
            </div>
          </div>
          <button className="p-2 rounded-lg hover:bg-slate-100" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>

        {phase !== 'review' && (
          <div className="px-6 py-4 space-y-3">
            <div className="relative">
              <textarea
                ref={taRef}
                rows={4}
                value={speech.listening ? speech.interim || text : text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) understand(); }}
                placeholder="Hold your Wispr Flow key and talk here… or tap the mic. e.g. “umm spent like 400, no wait, 450 on Swiggy yesterday”"
                className="input text-base leading-relaxed pr-16 min-h-[120px]"
              />
              <button
                onClick={() => (speech.listening ? speech.stop() : speech.start())}
                disabled={!speech.supported}
                title={speech.supported ? 'Browser mic (en-IN)' : 'Browser speech not supported — use Wispr Flow dictation'}
                className={`absolute right-3 top-3 h-11 w-11 rounded-full grid place-items-center text-white ${speech.listening ? 'bg-red-500 recording' : 'bg-amber-500 hover:bg-amber-600'} disabled:bg-slate-300`}
              >
                {speech.listening ? <Square size={16} /> : <Mic size={18} />}
              </button>
            </div>
            {speech.listening && <div className="text-amber-600 text-sm flex items-center gap-2"><Wave /> Listening (en-IN)… tap stop when done</div>}
            <div className="flex flex-wrap gap-2">
              {VOICE_EXAMPLES.map((ex) => (
                <button key={ex.label} className="chip bg-slate-100 hover:bg-slate-200 text-slate-700" onClick={() => setText(ex.text)}>{ex.label}</button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-400">Ctrl/⌘ + Enter to send · Nothing is saved until you confirm</span>
              <button className="btn btn-primary" disabled={!text.trim() || phase === 'thinking'} onClick={() => understand()}>
                {phase === 'thinking' ? <><Wave /> Understanding…</> : <><Sparkles size={16} /> Understand</>}
              </button>
            </div>
            {phase === 'thinking' && (
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 space-y-1">
                <div>① Stripping fillers & hesitations…</div>
                <div>② Resolving self-corrections (last value wins)…</div>
                <div>③ Extracting amounts, merchants, dates, intents → structured actions…</div>
              </div>
            )}
          </div>
        )}

        {phase === 'review' && result && (
          <div className="px-6 py-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="label mb-2">What you said</div>
                <p className="text-[15px] leading-relaxed">
                  {segments.map((s, i) => <span key={i} className={s.kind || ''}>{s.t}</span>)}
                </p>
                <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
                  <span className="filler">filler</span><span className="heard">retracted</span><span className="final">final value</span>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="label mb-2 text-emerald-700 flex items-center gap-1"><Wand2 size={12} /> What I understood</div>
                <p className="text-[15px] leading-relaxed font-medium text-slate-800">{result.clean_text}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge tone="slate">{(result.fillers || []).length} fillers removed</Badge>
                  <Badge tone="red">{(result.corrections || []).length} self-correction{(result.corrections || []).length === 1 ? '' : 's'} resolved</Badge>
                  <Badge tone="indigo"><Cpu size={11} /> {provider}</Badge>
                </div>
              </div>
            </div>

            <div className="label">Proposed actions — review, edit, confirm</div>
            <div className="space-y-3">
              {result.actions.map((a, i) => (
                <ActionCard key={i} a={a} i={i} patchAction={patchAction} patchTxn={patchTxn} />
              ))}
              {!result.actions.length && <div className="text-sm text-slate-500">I couldn't find an action in that — try rephrasing or add an amount.</div>}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button className="btn btn-ghost" onClick={() => setPhase('idle')}>← Edit what I said</button>
              <button className="btn btn-primary" onClick={apply} disabled={!result.actions.some((a) => a.include)}><Check size={16} /> Confirm & apply</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionCard({ a, i, patchAction, patchTxn }) {
  const head = {
    log_transactions: '🧾 Log transactions', set_rule: '🧠 Learn a category rule', update_profile: '👤 Update money profile',
    add_goal: '🎯 Add goal', what_if: '🔮 Run what-if simulation', subscription: '🔁 Subscription status', ask_coach: '💬 Ask the coach',
  }[a.type] || a.type;
  return (
    <div className={`rounded-2xl border p-4 ${a.include ? 'border-slate-200' : 'border-dashed border-slate-200 opacity-50'}`}>
      <label className="flex items-center gap-2 font-medium text-sm mb-2">
        <input type="checkbox" checked={a.include} onChange={(e) => patchAction(i, { include: e.target.checked })} className="accent-emerald-600" />
        {head}
      </label>
      {a.type === 'log_transactions' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1 w-6"></th><th>Date</th><th>Merchant</th><th>Category</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {a.transactions.map((t, k) => (
                <tr key={k} className="border-t border-slate-100">
                  <td><input type="checkbox" checked={t.include} onChange={(e) => patchTxn(i, k, { include: e.target.checked })} className="accent-emerald-600" /></td>
                  <td className="py-1.5 pr-2"><input type="date" className="input !py-1 !px-2 w-[140px]" value={t.date} onChange={(e) => patchTxn(i, k, { date: e.target.value })} /></td>
                  <td className="pr-2"><input className="input !py-1 !px-2" value={t.merchant} onChange={(e) => patchTxn(i, k, { merchant: e.target.value })} /></td>
                  <td className="pr-2">
                    <select className="input !py-1 !px-2" value={t.category} onChange={(e) => patchTxn(i, k, { category: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className={t.direction === 'credit' ? 'text-emerald-600' : 'text-slate-400'}>{t.direction === 'credit' ? '+' : '−'}₹</span>
                      <input type="number" className="input !py-1 !px-2 w-24 text-right" value={t.amount} onChange={(e) => patchTxn(i, k, { amount: Number(e.target.value) })} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {a.type === 'set_rule' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Always categorise anything matching
          <input className="input !w-44 !py-1" value={a.merchant} onChange={(e) => patchAction(i, { merchant: e.target.value.toLowerCase() })} />
          as
          <select className="input !w-48 !py-1" value={a.category} onChange={(e) => patchAction(i, { category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <span className="text-xs text-slate-500 w-full">Also re-labels matching past transactions (except ones you fixed by hand).</span>
        </div>
      )}
      {a.type === 'update_profile' && (
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.entries(a.profile || {}).map(([k, v]) => (
            <Badge key={k} tone="indigo">{k}: {Array.isArray(v) ? v.map((f) => `${f.name} ${inr(f.amount)}`).join(', ') : typeof v === 'number' ? inr(v) : String(v)}</Badge>
          ))}
        </div>
      )}
      {a.type === 'add_goal' && (
        <div className="grid grid-cols-3 gap-2 text-sm">
          <input className="input" value={a.goal?.name || ''} onChange={(e) => patchAction(i, { goal: { ...a.goal, name: e.target.value } })} />
          <input className="input" type="number" value={a.goal?.target || 0} onChange={(e) => patchAction(i, { goal: { ...a.goal, target: Number(e.target.value) } })} />
          <input className="input" type="date" value={a.goal?.targetDate || ''} onChange={(e) => patchAction(i, { goal: { ...a.goal, targetDate: e.target.value } })} />
        </div>
      )}
      {a.type === 'what_if' && (
        <div className="text-sm text-slate-700 flex flex-wrap gap-2 items-center">
          {Object.entries(a.scenario?.categoryPct || {}).map(([c, p]) => <Badge key={c} tone="amber">{c} {p > 0 ? '+' : ''}{p}%</Badge>)}
          {!!a.scenario?.rentChange && <Badge tone="amber">Rent {a.scenario.rentChange > 0 ? '+' : ''}{inr(a.scenario.rentChange)}/mo</Badge>}
          {!!a.scenario?.incomeChangePct && <Badge tone="amber">Income {a.scenario.incomeChangePct > 0 ? '+' : ''}{a.scenario.incomeChangePct}%</Badge>}
          {!!a.scenario?.extraMonthlySaving && <Badge tone="amber">Extra saving {inr(a.scenario.extraMonthlySaving)}/mo</Badge>}
          {!!a.scenario?.oneTimeExpense && <Badge tone="amber">One-time {inr(a.scenario.oneTimeExpense)}</Badge>}
          <span className="text-slate-500 flex items-center gap-1">Opens in the planner <ArrowRight size={14} /></span>
        </div>
      )}
      {a.type === 'subscription' && (
        <div className="text-sm flex items-center gap-2">
          <b className="capitalize">{a.merchant}</b> →
          <select className="input !w-40 !py-1" value={a.status} onChange={(e) => patchAction(i, { status: e.target.value })}>
            <option value="unused">not using</option><option value="cancel">plan to cancel</option><option value="using">still using</option>
          </select>
        </div>
      )}
      {a.type === 'ask_coach' && (
        <div className="text-sm text-slate-700 flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-600" /> “{a.question}” <span className="text-slate-400">→ coach (with guardrails)</span></div>
      )}
    </div>
  );
}

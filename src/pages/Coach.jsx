import { useEffect, useRef, useState } from 'react';
import { Send, Mic, Square, ShieldCheck, Sparkles, Trash2, ArrowRight, Cpu } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { callAI, asksForPicks, guardOutput, GUARDRAIL_ANSWER } from '../lib/ai.js';
import { moneySummary } from '../lib/finance.js';
import { inr } from '../lib/format.js';
import { Markdown, useSpeech, Wave, Badge } from '../components/ui.jsx';

const STARTERS = [
  'Umm, can I actually afford the Japan trip if I, like, cut down on Swiggy?',
  'How big should my emergency fund be, and how long till I get there?',
  'Which stock should I buy with my Diwali bonus? Like Reliance or something?',
  'Where is most of my money leaking every month?',
];

function localCoach(q, s) {
  if (asksForPicks(q)) return { answer: GUARDRAIL_ANSWER, guardrail_triggered: true };
  const cats = Object.entries(s.avgMonthlySpendByCategory || {}).sort((a, b) => b[1] - a[1]);
  const top = cats.filter(([c]) => !['Rent & Housing', 'Transfers'].includes(c)).slice(0, 3);
  const late = (s.goals || []).filter((g) => !g.onTrack);
  return {
    answer: `Here's what your numbers say:\n- You keep about **${inr(s.monthlySurplus)}/month** after spending (income ${inr(s.profile?.monthlyIncome)}).\n- Biggest flexible spends: ${top.map(([c, v]) => `**${c}** ${inr(v)}`).join(', ')}.\n- Emergency fund covers **${s.emergencyFundMonths} months** of essentials (aim for 6).\n${late.length ? `- At risk: ${late.map((g) => `**${g.name}**`).join(', ')}. Trimming ${top[0]?.[0]} by 30% frees ~${inr((top[0]?.[1] || 0) * 0.3)}/month.` : '- All goals are on track. 🎯'}\n\nWant me to simulate a change? Say “what if I cut ${top[0]?.[0] || 'dining'} by 30%”.`,
    guardrail_triggered: false,
    suggested_what_if: top[0] ? { label: `Cut ${top[0][0]} 30%`, categoryPct: { [top[0][0]]: -30 } } : null,
  };
}

export default function Coach({ payload, go }) {
  const { state, dispatch } = useStore();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const handled = useRef(null);
  const speech = useSpeech({ onFinal: (t) => setQ((p) => (p ? `${p} ${t}` : t)) });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [state.chat.length, busy]);
  useEffect(() => {
    if (payload?.ask && handled.current !== payload) { handled.current = payload; ask(payload.ask); }
  }, [payload]); // eslint-disable-line

  async function ask(text = q) {
    const question = text.trim();
    if (!question || busy) return;
    setQ('');
    dispatch({ type: 'CHAT', messages: [{ role: 'user', content: question }] });
    setBusy(true);
    const summary = moneySummary(state);
    const preFlag = asksForPicks(question);
    const history = state.chat.slice(-6).map((m) => `${m.role}: ${m.content.slice(0, 400)}`).join('\n');
    const res = await callAI('coach', history ? `Earlier conversation:\n${history}\n\nUser now says: ${question}` : question, { summary });
    let out;
    if (res.ok && res.data?.answer) out = { ...res.data, provider: res.provider };
    else out = { ...localCoach(question, summary), provider: 'Local coach (offline fallback)' };
    const g = guardOutput(out.answer);
    dispatch({
      type: 'CHAT',
      messages: [{ role: 'assistant', content: g.answer, guardrail: preFlag || out.guardrail_triggered || g.filtered, provider: out.provider, whatIf: out.suggested_what_if && (Object.keys(out.suggested_what_if.categoryPct || {}).length || out.suggested_what_if.rentChange || out.suggested_what_if.incomeChangePct || out.suggested_what_if.extraMonthlySaving) ? out.suggested_what_if : null }],
    });
    setBusy(false);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-3xl mx-auto">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Money coach</h1>
          <p className="text-sm text-slate-500 flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-600" /> Educates & models with your numbers. Never picks stocks, funds or coins.</p>
        </div>
        {!!state.chat.length && <button className="btn btn-ghost !px-2.5" onClick={() => dispatch({ type: 'CLEAR_CHAT' })}><Trash2 size={14} /></button>}
      </div>

      <div className="flex-1 overflow-y-auto card p-4 space-y-4">
        {!state.chat.length && (
          <div className="py-6 text-center space-y-4">
            <div className="text-4xl">🎙️</div>
            <p className="text-sm text-slate-500">Ask anything about your money — out loud is best.</p>
            <div className="grid sm:grid-cols-2 gap-2 text-left">
              {STARTERS.map((s) => <button key={s} className="rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50" onClick={() => ask(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {state.chat.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-50 border border-slate-100'}`}>
              {m.role === 'user' ? <p className="text-sm">{m.content}</p> : <Markdown text={m.content} />}
              {m.role === 'assistant' && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {m.guardrail && <Badge tone="green"><ShieldCheck size={11} /> Guardrail: no security picks</Badge>}
                  {m.provider && <Badge tone="slate"><Cpu size={11} /> {m.provider}</Badge>}
                  {m.whatIf && <button className="chip bg-emerald-600 text-white" onClick={() => go('plan', { scenario: m.whatIf })}><Sparkles size={11} /> Simulate “{m.whatIf.label}” <ArrowRight size={11} /></button>}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-sm text-slate-500"><Wave /> Thinking with your money model…</div>}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <input className="input !py-3 !pr-12" placeholder="Ask, or dictate with Wispr Flow…" value={speech.listening ? speech.interim || q : q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} />
          <button onClick={() => (speech.listening ? speech.stop() : speech.start())} disabled={!speech.supported} className={`absolute right-2 top-1.5 h-9 w-9 rounded-full grid place-items-center text-white ${speech.listening ? 'bg-red-500 recording' : 'bg-amber-500'} disabled:bg-slate-300`}>
            {speech.listening ? <Square size={13} /> : <Mic size={15} />}
          </button>
        </div>
        <button className="btn btn-primary !px-4" onClick={() => ask()} disabled={busy || !q.trim()}><Send size={16} /></button>
      </div>
    </div>
  );
}

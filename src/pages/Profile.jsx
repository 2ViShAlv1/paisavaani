import { useState } from 'react';
import { Mic, Plus, Trash2, RefreshCw, Eraser, Download } from 'lucide-react';
import { useStore, freshState } from '../lib/store.jsx';
import { demoState } from '../lib/demo.js';
import { budgets } from '../lib/finance.js';
import { inr } from '../lib/format.js';
import { Card } from '../components/ui.jsx';
import { CAT_EMOJI } from '../lib/categories.js';

export default function Profile({ openVoice }) {
  const { state, dispatch, notify } = useStore();
  const p = state.profile;
  const bud = budgets(state);
  const [goal, setGoal] = useState({ name: '', target: '', targetDate: '', saved: '' });
  const up = (patch) => dispatch({ type: 'UPDATE_PROFILE', profile: patch, silent: true });

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your money profile</h1>
          <p className="text-sm text-slate-500">The persistent model the coach reasons over. Saved on this device.</p>
        </div>
        <button className="btn btn-dark" onClick={() => openVoice("So umm I earn about 95k a month in hand, rent is 22k, uh, and I've got like 1.2 lakh, no sorry, 1.5 lakh as emergency savings")}><Mic size={15} className="text-amber-400" /> Set up by voice</button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Basics">
          <div className="grid grid-cols-2 gap-3">
            <L label="Name"><input className="input" value={p.name || ''} onChange={(e) => up({ name: e.target.value })} /></L>
            <L label="Monthly take-home income"><input type="number" className="input" value={p.monthlyIncome || ''} onChange={(e) => up({ monthlyIncome: Number(e.target.value) })} /></L>
            <L label="Emergency fund (current)"><input type="number" className="input" value={p.emergencyFund || ''} onChange={(e) => up({ emergencyFund: Number(e.target.value) })} /></L>
          </div>
          <div className="label mt-4 mb-2">Fixed costs</div>
          <div className="space-y-2">
            {(p.fixedCosts || []).map((f, i) => (
              <div key={i} className="flex gap-2">
                <input className="input" value={f.name} onChange={(e) => dispatch({ type: 'RESET', state: { ...state, profile: { ...p, fixedCosts: p.fixedCosts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) } } })} />
                <input type="number" className="input !w-36" value={f.amount} onChange={(e) => dispatch({ type: 'RESET', state: { ...state, profile: { ...p, fixedCosts: p.fixedCosts.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)) } } })} />
                <button className="p-2 text-slate-300 hover:text-red-500" onClick={() => dispatch({ type: 'RESET', state: { ...state, profile: { ...p, fixedCosts: p.fixedCosts.filter((_, j) => j !== i) } } })}><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="btn btn-ghost" onClick={() => up({ fixedCosts: [...(p.fixedCosts || []), { name: 'New cost', amount: 0 }] })}><Plus size={14} /> Add fixed cost</button>
          </div>
        </Card>

        <Card title="Goals" subtitle="With target dates — the planner funds them earliest-first">
          <div className="space-y-2">
            {state.goals.map((g) => (
              <div key={g.id} className="grid grid-cols-12 gap-2 items-center">
                <input className="input col-span-4" value={g.name} onChange={(e) => dispatch({ type: 'UPDATE_GOAL', id: g.id, patch: { name: e.target.value } })} />
                <input type="number" title="Target" className="input col-span-3" value={g.target} onChange={(e) => dispatch({ type: 'UPDATE_GOAL', id: g.id, patch: { target: Number(e.target.value) } })} />
                <input type="number" title="Saved" className="input col-span-2" value={g.saved} onChange={(e) => dispatch({ type: 'UPDATE_GOAL', id: g.id, patch: { saved: Number(e.target.value) } })} />
                <input type="date" className="input col-span-2 !px-1 text-xs" value={g.targetDate} onChange={(e) => dispatch({ type: 'UPDATE_GOAL', id: g.id, patch: { targetDate: e.target.value } })} />
                <button className="col-span-1 text-slate-300 hover:text-red-500" onClick={() => dispatch({ type: 'DELETE_GOAL', id: g.id })}><Trash2 size={14} /></button>
              </div>
            ))}
            <div className="grid grid-cols-12 gap-2 pt-2 border-t border-slate-100">
              <input className="input col-span-4" placeholder="Goal" value={goal.name} onChange={(e) => setGoal({ ...goal, name: e.target.value })} />
              <input type="number" className="input col-span-3" placeholder="Target ₹" value={goal.target} onChange={(e) => setGoal({ ...goal, target: e.target.value })} />
              <input type="number" className="input col-span-2" placeholder="Saved" value={goal.saved} onChange={(e) => setGoal({ ...goal, saved: e.target.value })} />
              <input type="date" className="input col-span-2 !px-1 text-xs" value={goal.targetDate} onChange={(e) => setGoal({ ...goal, targetDate: e.target.value })} />
              <button className="col-span-1 btn btn-primary !px-0" disabled={!goal.name || !goal.target || !goal.targetDate} onClick={() => { dispatch({ type: 'ADD_GOAL', goal: { ...goal, target: Number(goal.target), saved: Number(goal.saved) || 0 } }); setGoal({ name: '', target: '', targetDate: '', saved: '' }); }}><Plus size={14} /></button>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Monthly budgets" subtitle="Auto-suggested from your last 3 months — edit to set your plan. Nudges fire when you drift.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(bud).filter(([c]) => c !== 'Transfers').map(([c, v]) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{CAT_EMOJI[c]} {c}</span>
              <input type="number" className="input !w-28" value={v} onChange={(e) => dispatch({ type: 'SET_BUDGET', cat: c, amount: e.target.value })} />
            </label>
          ))}
        </div>
      </Card>

      <Card title="Data" subtitle="Everything stays in your browser (localStorage). AI calls send only the text you're parsing + a numeric summary.">
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => { dispatch({ type: 'RESET', state: demoState() }); notify('Demo data reloaded (Riya, Bengaluru).'); }}><RefreshCw size={14} /> Load demo persona</button>
          <button className="btn btn-ghost" onClick={() => { dispatch({ type: 'RESET', state: freshState() }); notify('Started fresh. Import SMS/CSV or just talk.'); }}><Eraser size={14} /> Start fresh (my own data)</button>
          <button className="btn btn-ghost" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); a.download = 'paisavaani-money-model.json'; a.click(); }}><Download size={14} /> Export money model</button>
        </div>
        <div className="text-xs text-slate-500 mt-3">{state.txns.length} transactions · {state.rules.length} learned rules · {state.goals.length} goals · income {inr(p.monthlyIncome)}</div>
      </Card>
    </div>
  );
}

const L = ({ label, children }) => <label className="block"><span className="label">{label}</span><div className="mt-1">{children}</div></label>;

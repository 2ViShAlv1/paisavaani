import { createContext, useContext, useEffect, useReducer, useState, useCallback } from 'react';
import { categorize, merchantKey } from './categories.js';
import { demoState } from './demo.js';
import { uid } from './format.js';

const KEY = 'paisavaani:v1';
const Ctx = createContext(null);

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.version === 1) return s;
  } catch { /* ignore */ }
  return demoState();
}

const dedupeKey = (t) => `${t.date}|${Math.round(t.amount)}|${t.direction}|${(t.merchantKey || '').slice(0, 12)}`;

function applyRule(txns, rule) {
  let n = 0;
  const out = txns.map((t) => {
    if (t.catSource === 'manual') return t;
    const hay = `${t.merchant} ${t.merchantKey} ${t.raw || ''}`.toLowerCase();
    if (hay.includes(rule.key) && t.category !== rule.category) {
      n++;
      return { ...t, category: rule.category, catSource: 'rule', ruleId: rule.id };
    }
    return t;
  });
  return { txns: out, n };
}

function reducer(state, a) {
  switch (a.type) {
    case 'ADD_TXNS': {
      const seen = new Set(state.txns.map(dedupeKey));
      const fresh = [];
      let dup = 0;
      for (const t0 of a.txns) {
        const t = { id: uid(), ...t0, merchantKey: t0.merchantKey || merchantKey(t0.merchant) };
        if (seen.has(dedupeKey(t))) { dup++; continue; }
        seen.add(dedupeKey(t));
        const ruleHit = categorize(t, state.rules);
        if (ruleHit?.catSource === 'rule') Object.assign(t, ruleHit);
        else if (!t.category) Object.assign(t, ruleHit || { category: t.direction === 'credit' ? 'Transfers' : 'Other', catSource: 'default' });
        fresh.push(t);
      }
      const log = { id: uid(), ts: Date.now(), kind: 'import', text: `Added ${fresh.length} transaction${fresh.length === 1 ? '' : 's'} from ${a.source || 'input'}${dup ? ` · skipped ${dup} duplicate${dup === 1 ? '' : 's'}` : ''}` };
      return { ...state, txns: [...fresh, ...state.txns].sort((x, y) => y.date.localeCompare(x.date)), learnLog: [log, ...state.learnLog].slice(0, 60) };
    }
    case 'SET_CATEGORY': {
      const t = state.txns.find((x) => x.id === a.id);
      if (!t) return state;
      let txns = state.txns.map((x) => (x.id === a.id ? { ...x, category: a.category, catSource: 'manual' } : x));
      let rules = state.rules;
      let learnLog = state.learnLog;
      if (a.learn) {
        const key = (a.key || t.merchantKey || merchantKey(t.merchant)).toLowerCase();
        const rule = { id: uid(), key, category: a.category, source: a.source || 'correction', createdAt: Date.now(), from: t.category };
        rules = [rule, ...state.rules.filter((r) => r.key !== key)];
        const res = applyRule(txns, rule);
        txns = res.txns;
        learnLog = [{ id: uid(), ts: Date.now(), kind: 'rule', text: `Learned “${key}” → ${a.category} (was ${t.category}) · re-labelled ${res.n} past transaction${res.n === 1 ? '' : 's'}` }, ...learnLog].slice(0, 60);
      }
      return { ...state, txns, rules, learnLog };
    }
    case 'ADD_RULE': {
      const key = a.key.toLowerCase().trim();
      const rule = { id: uid(), key, category: a.category, source: a.source || 'voice', createdAt: Date.now() };
      const res = applyRule(state.txns, rule);
      return {
        ...state, txns: res.txns, rules: [rule, ...state.rules.filter((r) => r.key !== key)],
        learnLog: [{ id: uid(), ts: Date.now(), kind: 'rule', text: `Learned “${key}” → ${a.category} from ${rule.source} · re-labelled ${res.n} past transaction${res.n === 1 ? '' : 's'}` }, ...state.learnLog].slice(0, 60),
      };
    }
    case 'DELETE_RULE':
      return { ...state, rules: state.rules.filter((r) => r.id !== a.id) };
    case 'UPDATE_TXN':
      return { ...state, txns: state.txns.map((t) => (t.id === a.id ? { ...t, ...a.patch } : t)) };
    case 'DELETE_TXN':
      return { ...state, txns: state.txns.filter((t) => t.id !== a.id) };
    case 'UPDATE_PROFILE': {
      const p = { ...state.profile };
      for (const [k, v] of Object.entries(a.profile || {})) {
        if (v == null || v === '') continue;
        if (k === 'fixedCosts' && Array.isArray(v)) {
          const map = new Map((p.fixedCosts || []).map((f) => [f.name.toLowerCase(), f]));
          v.forEach((f) => f?.name && map.set(f.name.toLowerCase(), { name: f.name, amount: Number(f.amount) || 0 }));
          p.fixedCosts = [...map.values()];
        } else p[k] = v;
      }
      return { ...state, profile: p, learnLog: a.silent ? state.learnLog : [{ id: uid(), ts: Date.now(), kind: 'profile', text: `Profile updated: ${Object.keys(a.profile).join(', ')}` }, ...state.learnLog].slice(0, 60) };
    }
    case 'SET_BUDGET':
      return { ...state, profile: { ...state.profile, budgets: { ...(state.profile.budgets || {}), [a.cat]: Number(a.amount) || 0 } } };
    case 'ADD_GOAL':
      return { ...state, goals: [...state.goals, { id: uid(), saved: 0, ...a.goal }], learnLog: [{ id: uid(), ts: Date.now(), kind: 'goal', text: `New goal: ${a.goal.name}` }, ...state.learnLog].slice(0, 60) };
    case 'UPDATE_GOAL':
      return { ...state, goals: state.goals.map((g) => (g.id === a.id ? { ...g, ...a.patch } : g)) };
    case 'DELETE_GOAL':
      return { ...state, goals: state.goals.filter((g) => g.id !== a.id) };
    case 'SET_SUB': {
      const subs = { ...state.subs, [a.key]: { status: a.status, checkedAt: new Date().toISOString().slice(0, 10) } };
      return { ...state, subs, learnLog: [{ id: uid(), ts: Date.now(), kind: 'sub', text: `Subscription “${a.label || a.key}” marked ${a.status}` }, ...state.learnLog].slice(0, 60) };
    }
    case 'CHAT':
      return { ...state, chat: [...state.chat, ...a.messages].slice(-40) };
    case 'CLEAR_CHAT':
      return { ...state, chat: [] };
    case 'RESET':
      return a.state;
    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);
  const [toast, setToast] = useState(null);
  const notify = useCallback((text, kind = 'ok') => {
    setToast({ text, kind, id: uid() });
    setTimeout(() => setToast(null), 4200);
  }, []);
  return <Ctx.Provider value={{ state, dispatch, toast, notify }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

export function freshState() {
  return { version: 1, demo: false, txns: [], rules: [], profile: { name: '', monthlyIncome: 0, emergencyFund: 0, fixedCosts: [], budgets: {} }, goals: [], subs: {}, learnLog: [], chat: [] };
}

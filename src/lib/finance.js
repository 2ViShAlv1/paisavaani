import { SAVINGS_CATS, ESSENTIAL_CATS } from './categories.js';
import { monthKey, daysBetween, addDays, addMonths, todayISO, inr, monthLabel } from './format.js';

export const isSpend = (t) => t.direction === 'debit' && !SAVINGS_CATS.has(t.category);

export function monthsPresent(txns) {
  return [...new Set(txns.map((t) => monthKey(t.date)))].sort();
}

export function prevMonthKey(key, n = 1) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthStats(txns, key) {
  const list = txns.filter((t) => monthKey(t.date) === key);
  const income = list.filter((t) => t.direction === 'credit' && t.category === 'Income').reduce((s, t) => s + t.amount, 0);
  const otherIn = list.filter((t) => t.direction === 'credit' && t.category !== 'Income').reduce((s, t) => s + t.amount, 0);
  const spend = list.filter(isSpend).reduce((s, t) => s + t.amount, 0);
  const invested = list.filter((t) => t.direction === 'debit' && SAVINGS_CATS.has(t.category)).reduce((s, t) => s + t.amount, 0);
  const byCat = {};
  for (const t of list.filter(isSpend)) byCat[t.category] = (byCat[t.category] || 0) + t.amount;
  const byMerchant = {};
  for (const t of list.filter(isSpend)) byMerchant[t.merchant] = (byMerchant[t.merchant] || 0) + t.amount;
  const saved = income + otherIn - spend;
  return {
    key, count: list.length, income, otherIn, spend, invested, saved,
    savingsRate: income ? (saved / income) * 100 : 0,
    byCat, byMerchant,
    biggest: list.filter(isSpend).sort((a, b) => b.amount - a.amount).slice(0, 5),
  };
}

// Average monthly spend per category over the last N complete months before `key`.
export function baselineByCat(txns, key, n = 3) {
  const out = {};
  let months = 0;
  for (let i = 1; i <= n; i++) {
    const k = prevMonthKey(key, i);
    const st = monthStats(txns, k);
    if (!st.count) continue;
    months++;
    for (const [c, v] of Object.entries(st.byCat)) out[c] = (out[c] || 0) + v;
  }
  if (!months) return { byCat: monthStats(txns, key).byCat, months: 0 };
  for (const c of Object.keys(out)) out[c] = Math.round(out[c] / months);
  return { byCat: out, months };
}

export function avgIncome(txns, key, n = 3) {
  let total = 0, months = 0;
  for (let i = 1; i <= n; i++) {
    const st = monthStats(txns, prevMonthKey(key, i));
    if (st.income) { total += st.income; months++; }
  }
  return months ? Math.round(total / months) : 0;
}

// Budgets: user-set overrides, otherwise last-3-month average (rounded up to ₹500).
export function budgets(state, key = monthKey(todayISO())) {
  const base = baselineByCat(state.txns, key).byCat;
  const out = {};
  for (const [c, v] of Object.entries(base)) out[c] = Math.ceil(v / 500) * 500;
  return { ...out, ...(state.profile?.budgets || {}) };
}

// ---------- Recurring payments & subscriptions ----------
export function detectRecurring(txns, subsState = {}, today = todayISO()) {
  const groups = {};
  for (const t of txns.filter((x) => x.direction === 'debit')) {
    const k = t.merchantKey || t.merchant.toLowerCase();
    (groups[k] ||= []).push(t);
  }
  const out = [];
  for (const [key, list] of Object.entries(groups)) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.date.localeCompare(b.date));
    const gaps = list.slice(1).map((t, i) => daysBetween(list[i].date, t.date));
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const cadence = avgGap >= 25 && avgGap <= 35 ? 'monthly' : avgGap >= 6 && avgGap <= 8 ? 'weekly' : avgGap >= 85 && avgGap <= 95 ? 'quarterly' : avgGap >= 350 && avgGap <= 380 ? 'yearly' : null;
    if (!cadence) continue;
    const consistentGaps = gaps.every((g) => Math.abs(g - avgGap) <= (cadence === 'weekly' ? 2 : 6));
    if (!consistentGaps) continue;
    const amounts = list.map((t) => t.amount);
    const prev = amounts.slice(0, -1);
    const prevAvg = prev.reduce((s, a) => s + a, 0) / prev.length;
    const last = list[list.length - 1];
    const tol = last.category === 'Utilities & Bills' ? 0.35 : 0.12;
    const fixedPrice = prev.length >= 2 && prev.every((a) => Math.abs(a - prevAvg) / prevAvg < 0.03);
    const allAvg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const allStable = amounts.every((a) => Math.abs(a - allAvg) / allAvg < tol);
    // stable amounts, OR a fixed price followed by one price change (subscription hike)
    if (!allStable && !(fixedPrice && Math.abs(last.amount - prevAvg) / prevAvg <= 0.6)) continue;
    // two data points are only trusted when the amount is identical
    if (list.length < 3 && Math.abs(amounts[0] - amounts[1]) / amounts[0] > 0.03) continue;
    const change = prevAvg ? ((last.amount - prevAvg) / prevAvg) * 100 : 0;
    const days = { weekly: 7, monthly: 30, quarterly: 91, yearly: 365 }[cadence];
    const nextDate = addDays(last.date, Math.round(avgGap));
    const perMonth = cadence === 'monthly' ? last.amount : last.amount * (30.44 / days);
    const st = subsState[key] || {};
    const isSub = ['Subscriptions', 'Entertainment', 'Health & Fitness', 'Education'].includes(last.category) || /netflix|spotify|prime|hotstar|youtube|cult|gym|icloud|google one/i.test(key);
    const alerts = [];
    if (fixedPrice && Math.abs(change) >= 3 && prev.length >= 1) {
      alerts.push({ kind: change > 0 ? 'price_up' : 'price_down', text: `${change > 0 ? 'Price went up' : 'Price dropped'}: ${inr(prevAvg)} → ${inr(last.amount)} (${change > 0 ? '+' : ''}${change.toFixed(0)}%)` });
    }
    const overdue = daysBetween(nextDate, today);
    if (overdue > 7) alerts.push({ kind: 'missed', text: `Expected around ${nextDate} but not seen — cancelled, failed, or moved?` });
    if (st.status === 'unused') alerts.push({ kind: 'unused', text: `You said you're not using this — ${inr(perMonth * 12)}/yr going nowhere` });
    else if (isSub && st.status !== 'using' && st.status !== 'cancel') {
      alerts.push({ kind: 'check', text: 'Still using it? Confirm so the coach can track waste' });
    } else if (isSub && st.status === 'using' && st.checkedAt && daysBetween(st.checkedAt, today) > 60) {
      alerts.push({ kind: 'check', text: `Last confirmed ${daysBetween(st.checkedAt, today)} days ago — still using?` });
    }
    out.push({
      key, merchant: last.merchant, category: last.category, cadence, count: list.length, lastAmount: last.amount,
      prevAvg: Math.round(prevAvg), change, lastDate: last.date, nextDate, perMonth, perYear: perMonth * 12,
      isSub, status: st.status || null, alerts, history: list.map((t) => ({ date: t.date, amount: t.amount })),
    });
  }
  return out.sort((a, b) => b.perMonth - a.perMonth);
}

// ---------- Drift nudges ----------
export function nudges(state, today = todayISO()) {
  const key = monthKey(today);
  const st = monthStats(state.txns, key);
  const bud = budgets(state, key);
  const [y, m, d] = today.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  const progress = d / dim;
  const out = [];
  for (const [cat, b] of Object.entries(bud)) {
    if (!b || ['Rent & Housing', 'EMI & Loans', 'Transfers'].includes(cat)) continue;
    const spent = st.byCat[cat] || 0;
    const expected = b * progress;
    const projected = progress > 0 ? spent / progress : spent;
    if (spent > b && spent - b > Math.max(250, b * 0.08)) {
      out.push({ id: `${key}-${cat}-over`, level: 'high', cat, spent, budget: b, projected, text: `${cat} is already ${inr(spent - b)} over plan (${inr(spent)} of ${inr(b)}).` });
    } else if (spent > expected * 1.15 && spent > b * 0.35 && progress < 0.97) {
      out.push({ id: `${key}-${cat}-pace`, level: 'medium', cat, spent, budget: b, projected, text: `${cat} is running ${Math.round((spent / expected - 1) * 100)}% ahead of pace — on track for ${inr(projected)} vs ${inr(b)} plan.` });
    }
  }
  // goal impact framing
  const goals = (state.goals || []).filter((g) => g.target > g.saved);
  if (goals.length) {
    const g = [...goals].sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0];
    const monthly = Math.max(1, (g.target - g.saved) / Math.max(1, daysBetween(today, g.targetDate) / 30.44));
    const days = (amt) => Math.round((amt / monthly) * 30.44);
    out.forEach((n) => {
      const drift = Math.max(0, Math.max(n.spent, n.projected) - n.budget);
      const dd = days(drift);
      if (dd >= 1) n.goalImpact = `${inr(drift)} of drift ≈ ${dd} day${dd === 1 ? '' : 's'} later for “${g.name}”.`;
    });
    const total = days(out.reduce((s, n) => s + Math.max(0, Math.max(n.spent, n.projected) - n.budget), 0));
    if (out.length > 1 && total >= 1) out.totalImpact = `Together: “${g.name}” slips ≈ ${total} days.`;
  }
  return out.sort((a, b) => (a.level === 'high' ? -1 : 1) - (b.level === 'high' ? -1 : 1));
}

// ---------- Goal planner / what-if simulation ----------
export function planInputs(state, today = todayISO()) {
  const key = monthKey(today);
  const base = baselineByCat(state.txns, key).byCat;
  const income = state.profile?.monthlyIncome || avgIncome(state.txns, key) || 0;
  let invest = 0, months = 0;
  for (let i = 1; i <= 3; i++) {
    const st = monthStats(state.txns, prevMonthKey(key, i));
    if (st.count) { invest += st.invested; months++; }
  }
  return { base, income, invest: months ? Math.round(invest / months) : 0 };
}

export function simulate(state, scenario = {}, horizon = 36, today = todayISO()) {
  const { base, income: inc0, invest } = planInputs(state, today);
  const spendByCat = { ...base };
  for (const [c, p] of Object.entries(scenario.categoryPct || {})) {
    if (spendByCat[c] != null) spendByCat[c] = spendByCat[c] * (1 + Number(p) / 100);
  }
  if (scenario.rentChange) spendByCat['Rent & Housing'] = (spendByCat['Rent & Housing'] || 0) + Number(scenario.rentChange);
  if (scenario.cancelSubs) spendByCat.Subscriptions = Math.max(0, (spendByCat.Subscriptions || 0) - Number(scenario.cancelSubs));
  const income = inc0 * (1 + (Number(scenario.incomeChangePct) || 0) / 100);
  const spend = Object.values(spendByCat).reduce((s, v) => s + v, 0);
  // SIPs / RDs already leave the account every month: treat them as committed, not free cash
  const committed = invest || 0;
  const surplus = income - spend - committed + (Number(scenario.extraMonthlySaving) || 0);

  const goals = (state.goals || []).map((g) => ({ ...g, bal: Number(g.saved) || 0, doneAt: g.saved >= g.target ? 0 : null }))
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  let cumulative = -(Number(scenario.oneTimeExpense) || 0);
  const series = [];
  for (let mo = 1; mo <= horizon; mo++) {
    let pool = Math.max(0, surplus) + (mo === 1 ? Math.min(0, cumulative) : 0);
    cumulative += surplus;
    const open = goals.filter((g) => g.doneAt == null);
    const needs = open.map((g) => {
      const monthsLeft = Math.max(1, Math.round(daysBetween(addMonths(today, mo - 1), g.targetDate) / 30.44));
      return Math.max(0, (g.target - g.bal) / monthsLeft);
    });
    // fund in target-date order: earliest deadline gets its full monthly need first
    open.forEach((g, i) => {
      const give = Math.max(0, Math.min(g.target - g.bal, needs[i], pool));
      g.bal += give;
      pool -= give;
    });
    // leftover flows to the earliest unfinished goal
    for (const g of goals.filter((x) => x.doneAt == null)) {
      if (pool <= 0) break;
      const give = Math.min(g.target - g.bal, pool);
      g.bal += give;
      pool -= give;
    }
    goals.forEach((g) => { if (g.doneAt == null && g.bal >= g.target - 1) g.doneAt = mo; });
    series.push({ month: mo, label: monthLabel(addMonths(today, mo).slice(0, 7)), cumulative: Math.round(cumulative) });
  }
  const goalResults = goals.map((g) => {
    const targetMonths = Math.round(daysBetween(today, g.targetDate) / 30.44);
    const eta = g.doneAt == null ? null : addMonths(today, g.doneAt);
    return { id: g.id, name: g.name, target: g.target, saved: g.saved, targetDate: g.targetDate, eta, doneAt: g.doneAt, onTrack: g.doneAt != null && g.doneAt <= targetMonths, slipMonths: g.doneAt == null ? null : g.doneAt - targetMonths };
  });
  const essentials = Object.entries(spendByCat).filter(([c]) => ESSENTIAL_CATS.has(c)).reduce((s, [, v]) => s + v, 0);
  return {
    income, spend, surplus, spendByCat, series, goals: goalResults, committed,
    savingsRate: income ? (surplus / income) * 100 : 0,
    emergencyMonths: essentials ? (Number(state.profile?.emergencyFund) || 0) / essentials : 0,
    essentials,
  };
}

// Compact summary given to the LLM as "living money model" context.
export function moneySummary(state, today = todayISO()) {
  const key = monthKey(today);
  const st = monthStats(state.txns, key);
  const last = monthStats(state.txns, prevMonthKey(key));
  const sim = simulate(state, {}, 36, today);
  const subs = detectRecurring(state.txns, state.subs, today);
  return {
    today,
    profile: { monthlyIncome: sim.income, emergencyFund: state.profile?.emergencyFund, fixedCosts: state.profile?.fixedCosts },
    avgMonthlySpendByCategory: Object.fromEntries(Object.entries(sim.spendByCat).map(([c, v]) => [c, Math.round(v)])),
    monthlySurplus: Math.round(sim.surplus),
    emergencyFundMonths: Number(sim.emergencyMonths.toFixed(1)),
    thisMonthToDate: { spend: st.spend, byCat: st.byCat },
    lastMonth: { income: last.income, spend: last.spend, savingsRate: Math.round(last.savingsRate) },
    goals: sim.goals.map((g) => ({ name: g.name, target: g.target, saved: g.saved, targetDate: g.targetDate, projectedDate: g.eta, onTrack: g.onTrack })),
    recurring: subs.slice(0, 10).map((s) => ({ merchant: s.merchant, perMonth: Math.round(s.perMonth), alerts: s.alerts.map((a) => a.kind), status: s.status })),
    nudges: nudges(state, today).map((n) => n.text),
    learnedRules: (state.rules || []).slice(0, 15).map((r) => `${r.key} → ${r.category}`),
  };
}

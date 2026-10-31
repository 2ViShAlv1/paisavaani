import Papa from 'papaparse';
import { merchantKey, dictLookup, titleCase, CATEGORIES } from './categories.js';
import { todayISO, addDays, toISO, uid } from './format.js';

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

export function parseDate(str, fallback = todayISO()) {
  if (!str) return fallback;
  const s = String(str).trim().toLowerCase();
  let m;
  if ((m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})/))) return iso(yr(m[3]), +m[2], +m[1]);
  if ((m = s.match(/(\d{1,2})[-/ ]?([a-z]{3,4})[a-z]*[-/ ,]*(\d{2,4})/))) {
    const mo = MON[m[2]];
    if (mo) return iso(yr(m[3]), mo, +m[1]);
  }
  if ((m = s.match(/([a-z]{3,4})[a-z]* (\d{1,2}),? (\d{4})/))) {
    const mo = MON[m[1]];
    if (mo) return iso(+m[3], mo, +m[2]);
  }
  return fallback;
}
const yr = (y) => (String(y).length === 2 ? 2000 + Number(y) : Number(y));
const iso = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : todayISO());

export const parseAmount = (s) => Number(String(s).replace(/[,₹\s]/g, '')) || 0;

function cleanMerchant(raw) {
  let s = String(raw || '').trim();
  const vpa = s.match(/^([a-z0-9._-]+)@([a-z]+)/i);
  if (vpa) {
    const handle = vpa[1].replace(/[._-]/g, ' ').replace(/\d+/g, '').trim();
    if (/^paytmqr|^q\d|^bharatpe|^gpay/i.test(vpa[1])) return 'UPI QR merchant';
    s = handle || vpa[1];
  }
  s = s.replace(/\b(ref|upi ref|ref no|txn|avl bal|avl lmt|not you|call).*$/i, '');
  s = s.replace(/[*#]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[.,;:-]+$/, '');
  const d = dictLookup(s);
  return d?.name || titleCase(s).slice(0, 40) || 'Unknown';
}

// ---------- Bank / UPI SMS ----------
export function parseSMSBlock(text) {
  const chunks = String(text)
    .split(/\n\s*\n|\n(?=(?:dear|your|rs|inr|₹|sent|received|a\/c|acct|alert|txn|spent|debited|credited|update|hdfc|icici|sbi|axis|kotak)\b)/i)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 12);
  const out = [];
  const skipped = [];
  for (const sms of chunks) {
    const t = parseSMS(sms);
    if (t) out.push(t);
    else skipped.push(sms);
  }
  return { txns: out, skipped };
}

export function parseSMS(sms) {
  const s = sms.replace(/\s+/g, ' ');
  if (/\botp\b|one time password|is your verification/i.test(s)) return null;
  const amt = s.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amt) return null;
  let direction = null;
  if (/\b(credited|received|deposited|credit of|has been credited|refund)\b/i.test(s)) direction = 'credit';
  if (/\b(debited|spent|sent|paid|withdrawn|debit of|purchase|charged|autopay|deducted|transferred to)\b/i.test(s)) {
    // "credited to beneficiary ... debited from your a/c" => debit; take first strong verb
    const di = s.search(/\b(debited|spent|sent|paid|withdrawn|debit of|purchase|charged|autopay|deducted)\b/i);
    const ci = s.search(/\b(credited|received|deposited)\b/i);
    direction = ci === -1 || (di !== -1 && di < ci) ? 'debit' : 'credit';
  }
  if (!direction) return null;
  const dateM = s.match(/\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[- ]?[A-Za-z]{3}[- ,]*\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
  const date = parseDate(dateM?.[1]);
  const pats = [
    /\bto vpa ([^\s]+)/i,
    /\bvpa ([^\s]+)/i,
    /\b(?:at|@) ([A-Za-z0-9&'. _-]{2,40}?)(?= on | via | using |\.|,| ref| avl| txn|$)/i,
    /\bto ([A-Za-z0-9&'. @_-]{2,40}?)(?= on | via | ref|\.|,| upi| avl| from|$)/i,
    /\btowards ([A-Za-z0-9&'. _-]{2,40}?)(?= autopay| mandate| on |\.|,|$)/i,
    /\bfor ([A-Za-z0-9&'. _-]{2,40}?)(?= autopay| mandate| on |\.|,|$)/i,
    /\bby ([A-Za-z0-9&'. @_-]{2,40}?)(?= on |\.|,| ref| upi| avl|$)/i,
    /\bfrom ([A-Za-z0-9&'. @_-]{2,40}?)(?= on |\.|,| ref| upi| avl|$)/i,
    /info[:\s-]+([A-Za-z0-9&'. @/_-]{2,40})/i,
  ];
  let merchantRaw = '';
  for (const p of pats) {
    const m = s.match(p);
    if (m && !/^(?:(?:your|a\/c|ac|acct|account|card|bank|inr|rs|upi|neft|imps)\b|xx|\*)/i.test(m[1].trim())) {
      merchantRaw = m[1];
      break;
    }
  }
  if (!merchantRaw) {
    const neft = s.match(/(neft|imps|rtgs)[-\s:]+([A-Za-z][A-Za-z ]{2,40})/i);
    if (neft) merchantRaw = neft[2];
  }
  const merchant = cleanMerchant(merchantRaw || (direction === 'credit' ? 'Incoming transfer' : 'Unknown'));
  return {
    id: uid(), date, amount: parseAmount(amt[1]), direction, merchant,
    merchantKey: merchantKey(merchantRaw || merchant), raw: sms, source: 'sms',
  };
}

// ---------- CSV statements ----------
export function parseCSV(text) {
  const res = Papa.parse(String(text).trim(), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
  const headers = res.meta.fields || [];
  const find = (...names) => headers.find((h) => names.some((n) => h.includes(n)));
  const hDate = find('txn date', 'transaction date', 'value date', 'date');
  const hDesc = find('narration', 'description', 'particulars', 'remarks', 'details', 'merchant');
  const hDebit = find('withdrawal', 'debit', 'dr');
  const hCredit = find('deposit', 'credit', 'cr');
  const hAmt = find('amount');
  const hType = find('type', 'dr/cr', 'cr/dr');
  const txns = [];
  for (const row of res.data) {
    const desc = row[hDesc] || '';
    let amount = 0;
    let direction = 'debit';
    const deb = parseAmount(row[hDebit]);
    const cred = parseAmount(row[hCredit]);
    if (hDebit && deb) { amount = deb; direction = 'debit'; }
    else if (hCredit && cred) { amount = cred; direction = 'credit'; }
    else if (hAmt) {
      const a = parseAmount(row[hAmt]);
      amount = Math.abs(a);
      const typ = String(row[hType] || '').toLowerCase();
      direction = a < 0 || /dr|debit/.test(typ) ? 'debit' : /cr|credit/.test(typ) ? 'credit' : 'debit';
    }
    if (!amount || !row[hDate]) continue;
    const merchant = cleanMerchant(extractNarration(desc));
    txns.push({ id: uid(), date: parseDate(row[hDate]), amount, direction, merchant, merchantKey: merchantKey(extractNarration(desc)), raw: desc, source: 'csv' });
  }
  return { txns, headers };
}

function extractNarration(desc) {
  // UPI/123456/SWIGGY/swiggy@icici/... -> SWIGGY ; POS 1234 AMAZON -> AMAZON
  const d = String(desc);
  const upi = d.split(/[/|]/).map((p) => p.trim()).filter((p) => p && !/^\d+$/.test(p) && !/^(upi|neft|imps|pos|ach|nach|rtgs|dr|cr|p2m|p2a|bil|onl|payment from phone|paid via)$/i.test(p));
  if (upi.length > 1) return upi.find((p) => /[a-z]{3,}/i.test(p) && !/@/.test(p)) || upi[0];
  return d.replace(/^(upi|pos|neft|imps|ach|nach)\s*(cr|dr|d|c)?[-\s:]*\d*\s*/i, '').replace(/[-]+/g, ' ').replace(/\b(pvt|ltd)\b/gi, '').replace(/\s+/g, ' ').trim();
}

// ---------- PDF statements ----------
export async function pdfToText(file) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const lines = [];
  for (let p = 1; p <= Math.min(doc.numPages, 15); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map();
    for (const it of content.items) {
      const y = Math.round(it.transform[5]);
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ x: it.transform[4], s: it.str });
    }
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => {
      lines.push(items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim());
    });
  }
  return lines.filter(Boolean).join('\n');
}

// Heuristic line parser for statement text; AI handles what this misses.
export function parseStatementText(text) {
  const txns = [];
  for (const line of String(text).split('\n')) {
    const dm = line.match(/^\s*(\d{1,2}[-/.][A-Za-z0-9]{2,3}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2})/);
    if (!dm) continue;
    if (/opening|closing balance|b\/f|c\/f/i.test(line)) continue;
    const nums = [...line.matchAll(/(?<![\w/])(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})|\d+\.\d{2})(?![\w/])/g)].map((m) => parseAmount(m[1]));
    if (!nums.length) continue;
    const amount = nums.length >= 2 ? nums[nums.length - 2] : nums[0];
    const desc = line.slice(dm[0].length).replace(/[\d,]+\.\d{2}/g, '').replace(/\s+(dr|cr)\b/gi, '').trim();
    const direction = /\b(cr|credit|salary|neft cr|refund|interest)\b/i.test(line) ? 'credit' : 'debit';
    const nar = extractNarration(desc);
    txns.push({ id: uid(), date: parseDate(dm[1]), amount, direction, merchant: cleanMerchant(nar), merchantKey: merchantKey(nar), raw: line, source: 'pdf' });
  }
  return txns;
}

// ---------- Local speech understanding (fallback when no LLM reachable) ----------
const FILLERS = ['umm+', 'um+', 'uhh+', 'uh+', 'hmm+', 'erm', 'like', 'basically', 'you know', 'i guess', 'kind of', 'sort of', 'matlab', 'yaar', 'na', 'toh', 'so yeah', 'okay so', 'ok so', 'actually', 'literally', 'i think'];
const CORR = '(?:no+,?\\s*)?(?:no+,? wait|no+ no+|wait,? no|sorry|i mean|actually|rather|correction|make (?:that|it)|scratch that|nahi nahi|nahi)';
const NUM = '(?:₹\\s*)?\\d+(?:,\\d{2,3})*(?:\\.\\d+)?(?:\\s*(?:k|K|thousand|lakhs|lakh|lac|crore|cr|hundred)\\b)?(?:\\s*(?:rupees|rs|bucks)\\b)?';

export function wordsToNumber(s) {
  let str = String(s).toLowerCase().replace(/[,₹]|rupees|rs|bucks/g, '').trim();
  const m = str.match(/([\d.]+)\s*(k|thousand|lakh|lac|lakhs|crore|cr|hundred)?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const mult = { k: 1e3, thousand: 1e3, lakh: 1e5, lac: 1e5, lakhs: 1e5, crore: 1e7, cr: 1e7, hundred: 100 }[m[2]] || 1;
  return Math.round(n * mult);
}

function relDate(text, today = todayISO()) {
  const t = text.toLowerCase();
  if (/day before yesterday|parso/.test(t)) return addDays(today, -2);
  if (/yesterday|kal\b/.test(t)) return addDays(today, -1);
  const wd = t.match(/last (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (wd) {
    const target = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(wd[1]);
    const [y, m, d] = today.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    let diff = (dt.getDay() - target + 7) % 7 || 7;
    return addDays(today, -diff);
  }
  const on = t.match(/on the (\d{1,2})(?:st|nd|rd|th)?/);
  if (on) return today.slice(0, 8) + String(on[1]).padStart(2, '0');
  return today;
}

export function localUnderstand(raw, ctx = {}) {
  const text = String(raw || '');
  const today = ctx.today || todayISO();
  const fillers = [];
  const corrections = [];

  // 1) self-corrections between numbers: "400, no wait, 450"
  let work = text.replace(new RegExp(`(${NUM})[\\s,.-]*${CORR}[\\s,.-]*(?:it'?s\\s*|it was\\s*)?(${NUM})`, 'gi'), (all, a, b) => {
    corrections.push({ heard: a.trim(), final: b.trim() });
    return b;
  });
  // merchant corrections: "Zomato, sorry, Swiggy"
  work = work.replace(new RegExp(`\\b([A-Z][a-zA-Z]+)[\\s,.-]+${CORR}[\\s,.-]+([A-Z][a-zA-Z]+)\\b`, 'g'), (all, a, b) => {
    if (dictLookup(a) || dictLookup(b)) {
      corrections.push({ heard: a, final: b });
      return b;
    }
    return all;
  });
  // 2) fillers
  for (const f of FILLERS) {
    const re = new RegExp(`(^|[\\s,.])(${f})(?=[\\s,.!?]|$)`, 'gi');
    work = work.replace(re, (all, pre, w) => {
      fillers.push(w);
      return pre;
    });
  }
  const clean = work.replace(/\s*,\s*,+/g, ', ').replace(/\s{2,}/g, ' ').replace(/^[\s,.]+/, '').trim();
  const lower = clean.toLowerCase();
  const actions = [];

  // what-if
  if (/what if|agar|suppose|imagine|simulate/.test(lower)) {
    const scenario = { label: 'Voice scenario', categoryPct: {}, rentChange: 0, incomeChangePct: 0, extraMonthlySaving: 0 };
    const catWords = { dining: 'Food & Dining', 'eating out': 'Food & Dining', swiggy: 'Food & Dining', zomato: 'Food & Dining', food: 'Food & Dining', shopping: 'Shopping', groceries: 'Groceries', travel: 'Travel', entertainment: 'Entertainment', subscriptions: 'Subscriptions', transport: 'Transport', uber: 'Transport' };
    for (const [w, cat] of Object.entries(catWords)) {
      const m = lower.match(new RegExp(`(cut|reduce|lower|increase|raise)\\s+(?:my\\s+)?${w}[a-z ]*?by\\s+(\\d+)\\s*(?:%|percent|per cent)`)) || lower.match(new RegExp(`${w}[a-z ]*?(?:by|down|up)\\s+(\\d+)\\s*(?:%|percent|per cent)`));
      if (m) {
        const n = Number(m[2] || m[1]);
        const dir = /increase|raise|up/.test(m[0]) ? 1 : -1;
        scenario.categoryPct[cat] = dir * n;
      }
    }
    const rent = lower.match(/rent[a-z ]*?(?:goes up|increases|rises|up|hike[sd]?)\s*(?:by|to)?\s*(₹?\s*[\d.,]+\s*(?:k|thousand)?)/);
    if (rent) scenario.rentChange = wordsToNumber(rent[1]);
    const raise = lower.match(/(\d+)\s*%\s*(?:raise|hike|increment|salary)/) || lower.match(/(?:raise|hike|increment)\s*(?:of)?\s*(\d+)\s*%/);
    if (raise) scenario.incomeChangePct = Number(raise[1]);
    const extra = lower.match(/save (?:an )?extra\s*(₹?\s*[\d.,]+\s*(?:k|thousand)?)/);
    if (extra) scenario.extraMonthlySaving = wordsToNumber(extra[1]);
    scenario.label = clean.replace(/^what if\s*/i, '').slice(0, 60);
    actions.push({ type: 'what_if', scenario });
    return { clean_text: clean, fillers, corrections, actions };
  }

  // questions → coach
  if (/\?$|^(should|can|could|how|why|which|is it|am i|do i|will i|what)\b/.test(lower) && !/spent|paid|bought/.test(lower)) {
    actions.push({ type: 'ask_coach', question: clean });
    return { clean_text: clean, fillers, corrections, actions };
  }

  // category rule: "X should be groceries" / "X is my rent"
  const ruleM = lower.match(/([a-z][a-z .]{1,30}?)\s+(?:should be|is always|is actually|is|goes (?:in|under)|categori[sz]e(?:d)? as|count as|counts as)\s+(?:my |under |in |as )?([a-z &]+)/);
  if (ruleM && !/spent|paid|\d/.test(lower)) {
    const cat = matchCategory(ruleM[2]);
    if (cat) {
      actions.push({ type: 'set_rule', merchant: merchantKey(ruleM[1].replace(/^(and|also|so)\s+/, '')), category: cat });
      return { clean_text: clean, fillers, corrections, actions };
    }
  }

  // subscriptions
  const subM = lower.match(/(?:not using|don'?t use|stopped using|cancel(?:led)?|cancelling)\s+(?:my\s+)?([a-z.]+)/) || lower.match(/([a-z.]+)\s+(?:i'?m not using|i don'?t use)/);
  if (subM) {
    actions.push({ type: 'subscription', merchant: subM[1], status: /cancel/.test(lower) ? 'cancel' : 'unused' });
  }

  // profile
  const nc = lower.replace(/,/g, ' ').replace(/\s+/g, ' ');
  const AMT = '(₹?\\s*\\d+(?:\\.\\d+)?\\s*(?:k|thousand|lakhs|lakh|lac)?)';
  const inc = nc.match(new RegExp(`(?:earn|salary is|income is|take home is|in hand is|make)\\s*(?:about|around|roughly)?\\s*${AMT}`));
  const ef = nc.match(new RegExp(`(?:emergency fund|savings?|saved)\\s*(?:is|of|are)?\\s*(?:about|around)?\\s*${AMT}`)) || nc.match(new RegExp(`${AMT}\\s*(?:as|in)\\s*(?:my\\s+)?(?:emergency|savings)`));
  const rentP = nc.match(new RegExp(`rent is\\s*(?:about|around)?\\s*${AMT}`));
  const isProfile = (inc || ef || rentP) && !/\b(spent|paid|bought)\b/.test(nc);
  if (isProfile) {
    const profile = {};
    if (inc) profile.monthlyIncome = wordsToNumber(inc[1]);
    if (ef) profile.emergencyFund = wordsToNumber(ef[1]);
    if (rentP) profile.fixedCosts = [{ name: 'Rent', amount: wordsToNumber(rentP[1]) }];
    actions.push({ type: 'update_profile', profile });
  }
  const goal = nc.match(new RegExp(`(?:save|saving|goal)\\s+(?:up\\s+)?(?:for|towards)\\s+(?:(?:a|an|my|the)\\s+)*([a-z ]{2,30}?)\\s+(?:of|worth|costing|for|around|about)?\\s*${AMT}(?:.*?by\\s+([a-z]+\\s*\\d{0,4}))?`));
  if (goal) {
    actions.push({ type: 'add_goal', goal: { name: titleCase(goal[1].replace(/^(a|an|my|the)\s+/, '')), target: wordsToNumber(goal[2]), targetDate: monthWordToDate(goal[3], today), saved: 0 } });
  }
  if ((isProfile || goal) && !/\b(spent|paid|bought)\b/.test(nc)) {
    return { clean_text: clean, fillers, corrections, actions };
  }

  // transactions: split into clauses by connectors; split on commas only when a part holds several amounts
  const numRe = new RegExp(NUM, 'gi');
  const clauses = clean.split(/\s*(?:;|\band then\b|\band also\b|\balso\b|\band\b|\bthen\b|\bplus\b)\s*/i)
    .flatMap((part) => ((part.match(numRe) || []).length > 1 ? part.split(/\s*,\s*/) : [part.replace(/,/g, ' ')]))
    .map((c) => c.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const date = relDate(lower, today);
  const txns = [];
  for (const c of clauses) {
    const nm = c.match(new RegExp(NUM, 'i'));
    if (!nm || !/\d/.test(nm[0])) continue;
    const amount = wordsToNumber(nm[0]);
    if (!amount) continue;
    const mm = c.match(/\b(?:on|at|for|to|from)\s+(?:the\s+|a\s+|my\s+)?([a-zA-Z][a-zA-Z.' ]{1,25}?)(?=\s+(?:yesterday|today|for|on|at|last|this|and)\b|[,.]|$)/i);
    let merchantName = mm ? mm[1].trim() : '';
    const dict = dictLookup(c);
    if (dict?.name) merchantName = dict.name;
    if (!merchantName) merchantName = /rent/i.test(c) ? 'Rent' : 'Cash expense';
    const credit = /\b(got|received|credited|salary came|refund|earned)\b/i.test(c);
    const cat = /rent/i.test(c) ? 'Rent & Housing' : dict?.category || (credit ? 'Income' : matchCategory(c) || 'Other');
    txns.push({ date: relDate(c, today) !== today ? relDate(c, today) : date, amount, direction: credit ? 'credit' : 'debit', merchant: titleCase(merchantName), category: cat, note: 'via voice' });
  }
  if (txns.length) actions.unshift({ type: 'log_transactions', transactions: txns });
  if (!actions.length) actions.push({ type: 'ask_coach', question: clean });
  return { clean_text: clean, fillers, corrections, actions };
}

function monthWordToDate(s, today) {
  if (!s) return addDays(today, 365);
  const m = s.trim().match(/([a-z]+)\s*(\d{4})?/);
  const mo = m && MON[m[1].slice(0, 3)];
  if (!mo) return addDays(today, 365);
  let y = m[2] ? Number(m[2]) : Number(today.slice(0, 4));
  if (!m[2] && mo <= Number(today.slice(5, 7))) y += 1;
  return `${y}-${String(mo).padStart(2, '0')}-01`;
}

export function matchCategory(s) {
  const t = String(s || '').toLowerCase();
  const syn = {
    'Food & Dining': /food|dining|eating out|restaurant|swiggy|zomato|takeout|order/,
    Groceries: /grocer|kirana|vegetable|sabzi/,
    'Rent & Housing': /rent|housing|landlord/,
    'Utilities & Bills': /utilit|bill|electric|internet|wifi|phone|recharge/,
    Transport: /transport|travel to work|cab|auto|uber|ola|fuel|petrol|commute/,
    Shopping: /shopping|clothes|amazon|flipkart/,
    Entertainment: /entertain|movie|fun|party/,
    Subscriptions: /subscription|ott|streaming/,
    'Health & Fitness': /health|gym|medicine|doctor|fitness|pharma/,
    Education: /education|course|book|class/,
    'EMI & Loans': /emi|loan/,
    'Investments & Savings': /invest|sip|saving|mutual/,
    Travel: /trip|vacation|flight|hotel|holiday/,
    'Personal Care': /salon|haircut|grooming|personal care/,
    Transfers: /transfer|friend|family|parents|mom|dad/,
  };
  for (const c of CATEGORIES) if (syn[c]?.test(t)) return c;
  return null;
}

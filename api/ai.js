// PaisaVaani AI router — Vercel serverless function (also mounted in Vite dev server).
// Provider chain: GROQ_API_KEY -> GEMINI_API_KEY -> OPENAI-compatible keyless (Pollinations).
// The client always has a local rule-based fallback, so the product never dead-ends.

// Browser-safe: on static hosting (no server) the client imports this module and only the keyless provider is used.
const ENV = typeof process !== "undefined" && process.env ? process.env : {};

export const config = { maxDuration: 60 };

const CATEGORIES = [
  'Food & Dining', 'Groceries', 'Rent & Housing', 'Utilities & Bills', 'Transport', 'Shopping',
  'Entertainment', 'Subscriptions', 'Health & Fitness', 'Education', 'EMI & Loans',
  'Investments & Savings', 'Travel', 'Personal Care', 'Transfers', 'Income', 'Other',
];

const GUARDRAIL = `HARD GUARDRAIL: You are an educational money coach, not a SEBI-registered investment adviser.
Never recommend, rank or name specific securities: no individual stocks, tickers, specific mutual fund schemes, specific ETFs, specific crypto coins, specific bonds, or specific insurance policies to buy/sell/hold.
If asked, say clearly that you can't pick specific securities, then educate on asset classes (e.g. index funds vs active funds, debt vs equity, emergency fund first, diversification, expense ratios, time horizon) and model scenarios with the user's own numbers. Suggest a SEBI-registered investment adviser for personalised product picks.`;

const SPEECH_RULES = `The input is RAW SPEECH (dictated via voice, e.g. Wispr Flow / browser mic). It contains filler words (um, uh, like, basically, you know, matlab, yaar, toh), digressions, Hinglish, and SELF-CORRECTIONS ("400, no wait, 450", "Zomato — sorry, Swiggy", "actually make that 18.5k").
Always honour the LAST stated value after a self-correction. Indian number words: k = thousand, lakh/lac = 100000, crore = 10000000. "18.5k" = 18500. "1.5 lakh" = 150000. Currency is INR.`;

function today() {
  return new Date().toISOString().slice(0, 10);
}

const TASKS = {
  voice: (input, ctx) => ({
    system: `You are PaisaVaani, a voice-first personal finance agent for India. Today is ${ctx?.today || today()}.
${SPEECH_RULES}
Turn the utterance into structured actions. Allowed categories: ${CATEGORIES.join(', ')}.
Return ONLY JSON with this exact shape:
{
 "clean_text": "concise rewritten version of what the user meant, fillers removed, corrections applied",
 "fillers": ["filler words/phrases exactly as they appear in the raw text"],
 "corrections": [{"heard": "value or phrase the user retracted", "final": "value they settled on"}],
 "actions": [
   {"type":"log_transactions","transactions":[{"date":"YYYY-MM-DD","amount":number,"direction":"debit|credit","merchant":"string","category":"one allowed category","note":"short"}]},
   {"type":"set_rule","merchant":"merchant keyword lowercased","category":"allowed category"},
   {"type":"update_profile","profile":{"monthlyIncome":number?,"emergencyFund":number?,"fixedCosts":[{"name":"string","amount":number}]?}},
   {"type":"add_goal","goal":{"name":"string","target":number,"targetDate":"YYYY-MM-DD","saved":number}},
   {"type":"what_if","scenario":{"label":"short label","categoryPct":{"<category>": percent change e.g. -30},"rentChange": absolute monthly INR change,"incomeChangePct": number,"extraMonthlySaving": number,"oneTimeExpense": number}},
   {"type":"subscription","merchant":"string","status":"unused|using|cancel"},
   {"type":"ask_coach","question":"the user's question, cleaned"}
 ]
}
Include only the action types that apply (can be several). Use relative dates correctly ("yesterday", "last Friday", "on the 5th"). If no date, use today. Omit unknown optional fields instead of guessing.
Known user context (may be empty): ${JSON.stringify(ctx?.summary || {})}`,
    user: input,
  }),

  categorize: (input) => ({
    system: `Categorise Indian bank/UPI transaction merchants. Allowed categories: ${CATEGORIES.join(', ')}.
Return ONLY JSON: {"results":[{"merchant":"<as given>","category":"<allowed category>","clean_name":"human friendly merchant name"}]}.
UPI handles like "paytmqr...", "q12345@ybl" or person names usually mean Transfers unless the name obviously indicates a business.`,
    user: JSON.stringify(input),
  }),

  statement: (input, ctx) => ({
    system: `You extract transactions from messy Indian bank statement text (copied from a PDF; columns may be garbled). Today is ${ctx?.today || today()}.
Return ONLY JSON: {"transactions":[{"date":"YYYY-MM-DD","amount":number,"direction":"debit|credit","merchant":"clean merchant / counterparty","category":"one of ${CATEGORIES.join(', ')}","raw":"original line"}]}
Skip opening/closing balance lines and totals. Amount is always positive.`,
    user: String(input).slice(0, 12000),
  }),

  coach: (input, ctx) => ({
    system: `You are PaisaVaani, a warm, sharp personal finance coach for a user in India. Speak plainly, use ₹ and Indian number formatting (lakh), be specific with the user's own numbers, max ~140 words, use short bullet points when useful.
${GUARDRAIL}
${SPEECH_RULES}
User's living money model: ${JSON.stringify(ctx?.summary || {})}
Return ONLY JSON: {"answer":"markdown answer","guardrail_triggered":boolean,"suggested_what_if":{"label":"...","categoryPct":{},"rentChange":0,"incomeChangePct":0,"extraMonthlySaving":0} or null}`,
    user: input,
  }),

  report: (input, ctx) => ({
    system: `You write a monthly money review for an Indian user. Be encouraging but honest, specific with numbers (₹, lakh formatting), and end with exactly 3 concrete next-month actions. ~180 words. No specific securities (${GUARDRAIL}).
Return ONLY JSON: {"headline":"one punchy line","narrative":"markdown, 2 short paragraphs","actions":["...","...","..."]}`,
    user: JSON.stringify(input),
  }),
};

function extractJSON(text) {
  if (!text) throw new Error('empty');
  const cleaned = String(text).replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fallthrough */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error('no json');
}

async function callOpenAICompat({ url, key, model, system, user, timeoutMs = 45000, jsonMode = true, extra = {} }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        ...extra,
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return extractJSON(data?.choices?.[0]?.message?.content);
  } finally {
    clearTimeout(t);
  }
}

function providers() {
  const list = [];
  if (ENV.GROQ_API_KEY) {
    list.push({ name: 'Groq · Llama 3.3 70B', url: 'https://api.groq.com/openai/v1/chat/completions', key: ENV.GROQ_API_KEY, model: ENV.GROQ_MODEL || 'llama-3.3-70b-versatile' });
  }
  if (ENV.GEMINI_API_KEY) {
    list.push({ name: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: ENV.GEMINI_API_KEY, model: ENV.GEMINI_MODEL || 'gemini-2.5-flash' });
  }
  // keyless fallback: low reasoning effort keeps latency ~10-15s
  list.push({ name: 'Pollinations · GPT-OSS 20B', url: 'https://text.pollinations.ai/openai', key: ENV.POLLINATIONS_TOKEN || '', model: 'openai', extra: { reasoning_effort: 'low' }, timeoutMs: 50000 });
  return list;
}

export async function runTask(task, input, context) {
  const build = TASKS[task];
  if (!build) throw new Error(`unknown task ${task}`);
  const { system, user } = build(input, context || {});
  const errors = [];
  for (const p of providers()) {
    try {
      const data = await callOpenAICompat({ ...p, system, user });
      return { ok: true, provider: p.name, data };
    } catch (e) {
      errors.push(`${p.name}: ${e.message}`);
    }
  }
  return { ok: false, errors };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, providers: providers().map((p) => p.name) }));
    return;
  }
  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(await readBody(req));
    const out = await runTask(body.task, body.input, body.context);
    res.statusCode = out.ok ? 200 : 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, errors: [e.message] }));
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => resolve(d || '{}'));
    req.on('error', reject);
  });
}

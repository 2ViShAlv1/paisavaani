// Client for /api/ai with timeout. Callers always have a local fallback.
export async function callAI(task, input, context = {}, timeoutMs = 55000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, input, context }),
    });
    const json = await res.json().catch(() => ({ ok: false }));
    return json;
  } catch (e) {
    return { ok: false, errors: [e.message] };
  } finally {
    clearTimeout(t);
  }
}

// ---- Guardrails: no specific securities ----
const ASK_PICKS = /\b(which|what|best|top|good|recommend|suggest|should i (buy|sell|invest in)|tell me (a|some))\b[^.?!]{0,60}\b(stock|stocks|share|shares|mutual fund|fund|etf|crypto|coin|bitcoin|ipo|scheme|smallcase|bond)s?\b|\b(buy|sell|hold)\b[^.?!]{0,30}\b(reliance|tcs|infosys|infy|hdfc bank|adani|tata motors|zomato shares|paytm shares|bitcoin|ethereum|dogecoin|nifty bees)\b/i;

const SECURITY_NAMES = /\b(reliance industries|tcs|infosys|infy|hdfc bank shares?|icici bank shares?|adani \w+|tata motors|wipro|itc|bajaj finance shares?|nifty ?bees|parag parikh|axis bluechip|mirae asset|sbi bluechip|quant small cap|nippon india|uti nifty|hdfc flexi ?cap|icici prudential \w+|bitcoin|ethereum|solana|dogecoin|shiba)\b/i;

export const asksForPicks = (q) => ASK_PICKS.test(q || '');

export function guardOutput(answer) {
  const m = String(answer || '').match(SECURITY_NAMES);
  if (m && /\b(buy|invest in|pick|go with|consider|recommend|allocate to|add)\b/i.test(answer)) {
    return { answer: GUARDRAIL_ANSWER, filtered: true };
  }
  return { answer, filtered: false };
}

export const GUARDRAIL_ANSWER = `**I can't pick specific stocks, funds or coins for you** — I'm an educational coach, not a SEBI-registered investment adviser.

What I *can* do with your numbers:
- **Order of operations:** emergency fund (6 months of essentials) → high-interest debt → goal buckets → long-term investing.
- **Match money to time horizon:** money needed in < 3 years usually sits in low-volatility options (savings, FDs, liquid/debt funds as a category); 5+ year money can take equity risk.
- **Know the levers:** low expense ratios, diversification (e.g. broad index funds as a *category*), and SIP discipline matter more than picking "the best" product.
- **Model it:** tell me "what if I invest ₹10k more a month" and I'll show the impact on your goals.

For personal product picks, talk to a SEBI-registered investment adviser (RIA).`;

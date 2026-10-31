export const CATEGORIES = [
  'Food & Dining', 'Groceries', 'Rent & Housing', 'Utilities & Bills', 'Transport', 'Shopping',
  'Entertainment', 'Subscriptions', 'Health & Fitness', 'Education', 'EMI & Loans',
  'Investments & Savings', 'Travel', 'Personal Care', 'Transfers', 'Income', 'Other',
];

export const CAT_COLORS = {
  'Food & Dining': '#f97316', Groceries: '#84cc16', 'Rent & Housing': '#6366f1', 'Utilities & Bills': '#0ea5e9',
  Transport: '#eab308', Shopping: '#ec4899', Entertainment: '#a855f7', Subscriptions: '#d946ef',
  'Health & Fitness': '#10b981', Education: '#14b8a6', 'EMI & Loans': '#ef4444', 'Investments & Savings': '#22c55e',
  Travel: '#06b6d4', 'Personal Care': '#f472b6', Transfers: '#94a3b8', Income: '#16a34a', Other: '#64748b',
};

export const CAT_EMOJI = {
  'Food & Dining': '🍜', Groceries: '🛒', 'Rent & Housing': '🏠', 'Utilities & Bills': '💡', Transport: '🛺',
  Shopping: '🛍️', Entertainment: '🎬', Subscriptions: '🔁', 'Health & Fitness': '💪', Education: '📚',
  'EMI & Loans': '🏦', 'Investments & Savings': '📈', Travel: '✈️', 'Personal Care': '💇', Transfers: '↔️',
  Income: '💰', Other: '•',
};

// Spending that is "money kept", not consumed.
export const SAVINGS_CATS = new Set(['Investments & Savings']);
export const ESSENTIAL_CATS = new Set(['Rent & Housing', 'Utilities & Bills', 'Groceries', 'EMI & Loans', 'Health & Fitness', 'Transport', 'Education']);
export const DISCRETIONARY_CATS = ['Food & Dining', 'Shopping', 'Entertainment', 'Subscriptions', 'Travel', 'Personal Care', 'Transport', 'Groceries'];

// Merchant dictionary: [regex, category, display name]
export const MERCHANT_DICT = [
  [/swiggy(?!.*instamart)/, 'Food & Dining', 'Swiggy'],
  [/zomato/, 'Food & Dining', 'Zomato'],
  [/dominos|domino/, 'Food & Dining', "Domino's"],
  [/starbucks|third wave|blue tokai|chaayos|cafe|coffee/, 'Food & Dining', null],
  [/mcdonald|kfc|burger king|subway|pizza|restaurant|biryani|eatsure|haldiram/, 'Food & Dining', null],
  [/instamart/, 'Groceries', 'Swiggy Instamart'],
  [/zepto/, 'Groceries', 'Zepto'],
  [/blinkit|grofers/, 'Groceries', 'Blinkit'],
  [/bigbasket|bbnow|big basket/, 'Groceries', 'BigBasket'],
  [/dmart|d mart|avenue supermarts|reliance fresh|more retail|nature.?s basket|jiomart/, 'Groceries', null],
  [/kirana|provision store|general store|supermarket|super market|vegetables|sabzi|dairy/, 'Groceries', null],
  [/rent|landlord|nobroker|house owner/, 'Rent & Housing', null],
  [/maintenance|society/, 'Rent & Housing', null],
  [/airtel|jio(?!cinema|hotstar|saavn)|vodafone|vi postpaid|bsnl|act fibernet|hathway|excitel/, 'Utilities & Bills', null],
  [/bescom|electricity|tata power|adani elec|msedcl|bses|water board|indane|hp gas|bharat gas|gas bill|piped gas|mahanagar gas/, 'Utilities & Bills', null],
  [/uber|ola|rapido|namma yatri|blusmart|metro|irctc|redbus|fastag|petrol|hpcl|bpcl|indian oil|iocl|shell/, 'Transport', null],
  [/amazon(?!.*prime)|flipkart|myntra|ajio|meesho|nykaa(?!.*man)|tata cliq|croma|reliance digital|decathlon|ikea|lenskart/, 'Shopping', null],
  [/netflix/, 'Subscriptions', 'Netflix'],
  [/spotify/, 'Subscriptions', 'Spotify'],
  [/hotstar|jiocinema|jio hotstar/, 'Subscriptions', 'JioHotstar'],
  [/prime video|amazon prime|primevideo/, 'Subscriptions', 'Amazon Prime'],
  [/youtube|google ?play|google one|icloud|apple\.com|apple services|chatgpt|openai|notion|canva|linkedin premium|zee5|sonyliv/, 'Subscriptions', null],
  [/bookmyshow|pvr|inox|district|steam|playstation/, 'Entertainment', null],
  [/cult\.?fit|cultfit|gym|fitness|apollo|pharmeasy|1mg|netmeds|practo|medplus|hospital|clinic|diagnostic|healthkart/, 'Health & Fitness', null],
  [/udemy|coursera|upgrad|unacademy|byju|school|college|tuition|scaler|great learning/, 'Education', null],
  [/emi|loan|bajaj fin|home credit|cred.*emi|nach/, 'EMI & Loans', null],
  [/sip|groww|zerodha|kuvera|coin by|mutual fund|mf |ppf|nps|recurring deposit|fixed deposit|smallcase|indmoney|upstox/, 'Investments & Savings', null],
  [/makemytrip|goibibo|cleartrip|indigo|air india|vistara|akasa|spicejet|oyo|airbnb|booking\.com|yatra|ixigo/, 'Travel', null],
  [/salon|urban company|urbanclap|lakme|naturals|barber|spa/, 'Personal Care', null],
  [/salary|payroll|sal cr|interest credit|refund|cashback/, 'Income', null],
];

export function titleCase(s) {
  return String(s || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).trim();
}

export function merchantKey(raw) {
  let s = String(raw || '').toLowerCase();
  s = s.replace(/@[a-z0-9.]+/g, ' ');
  s = s.replace(/\b(upi|pos|neft|imps|rtgs|nach|ach|ecs|ref|txn|vpa|to|by|at|for|from|on|info|mb|ib|dr|cr|ltd|pvt|private|limited|india|technologies|tech)\b/g, ' ');
  s = s.replace(/[^a-z\s.]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = s.split(' ').filter((w) => w.length > 1);
  return words.slice(0, 3).join(' ') || String(raw || '').toLowerCase().trim();
}

export function dictLookup(merchant) {
  const s = String(merchant || '').toLowerCase();
  for (const [re, cat, name] of MERCHANT_DICT) {
    const m = s.match(re);
    if (m) return { category: cat, name: name || titleCase(m[0]) };
  }
  return null;
}

// Rules learned from user corrections always win.
export function categorize(txn, rules) {
  const hay = `${txn.merchant || ''} ${txn.merchantKey || ''} ${txn.raw || ''}`.toLowerCase();
  const rule = [...(rules || [])].sort((a, b) => b.key.length - a.key.length).find((r) => r.key && hay.includes(r.key));
  if (rule) return { category: rule.category, catSource: 'rule', ruleId: rule.id };
  if (txn.direction === 'credit') {
    const d = dictLookup(hay);
    if (d && d.category === 'Income') return { category: 'Income', catSource: 'dict' };
    if (/salary|payroll/.test(hay)) return { category: 'Income', catSource: 'dict' };
  }
  const d = dictLookup(hay);
  if (d) return { category: d.category, catSource: 'dict' };
  return null;
}

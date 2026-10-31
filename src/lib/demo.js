import { merchantKey } from './categories.js';
import { todayISO, uid, addMonths } from './format.js';
import { prevMonthKey } from './finance.js';

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// Three full months + current month-to-date, generated relative to today so the demo never goes stale.
export function demoState(today = todayISO()) {
  const r = rng(42);
  const curKey = today.slice(0, 7);
  const curDay = Number(today.slice(8, 10));
  const months = [prevMonthKey(curKey, 3), prevMonthKey(curKey, 2), prevMonthKey(curKey, 1), curKey];
  const txns = [];
  const add = (key, day, amount, direction, merchant, raw, category) => {
    const isCur = key === curKey;
    if (isCur && day > curDay) return;
    const dim = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate();
    const date = `${key}-${String(Math.min(day, dim)).padStart(2, '0')}`;
    txns.push({ id: uid(), date, amount: Math.round(amount), direction, merchant, merchantKey: merchantKey(raw || merchant), raw: raw || merchant, source: 'demo', category, catSource: category ? 'dict' : undefined });
  };
  months.forEach((key, mi) => {
    const isCur = mi === 3;
    add(key, 1, 95000, 'credit', 'Acme Tech Salary', 'NEFT-ACME TECH PVT LTD SALARY', 'Income');
    // landlord paid by UPI to a person — shows up as Transfer until the user teaches the coach
    add(key, 3, 22000, 'debit', 'Ramesh Kumar', 'rameshkumar@okhdfc', 'Transfers');
    add(key, 5, 10000, 'debit', 'Groww SIP', 'ACH-GROWW SIP', 'Investments & Savings');
    add(key, 7, mi === 3 ? 649 : 499, 'debit', 'Netflix', 'NETFLIX AUTOPAY', 'Subscriptions');
    add(key, 9, 119, 'debit', 'Spotify', 'spotify@ybl', 'Subscriptions');
    add(key, 12, 299, 'debit', 'JioHotstar', 'JIOHOTSTAR', 'Subscriptions');
    add(key, 10, 1599, 'debit', 'Cult.fit', 'CULTFIT MEMBERSHIP', 'Health & Fitness');
    add(key, 14, 599, 'debit', 'Airtel', 'AIRTEL POSTPAID', 'Utilities & Bills');
    add(key, 18, 1200 + r() * 700, 'debit', 'BESCOM', 'BESCOM ELECTRICITY', 'Utilities & Bills');
    add(key, 20, 1850, 'debit', 'Society Maintenance', 'maintenance@sbi', 'Rent & Housing');
    // dining: heavier in current month to trigger drift nudge
    const dineCount = isCur ? 14 : 9;
    for (let i = 0; i < dineCount; i++) {
      const day = isCur ? 1 + Math.floor((i * Math.max(curDay - 1, 1)) / dineCount) : 1 + Math.floor(r() * 28);
      const sw = r() > 0.45;
      add(key, day, 250 + r() * (isCur ? 650 : 450), 'debit', sw ? 'Swiggy' : 'Zomato', sw ? 'swiggy@icici' : 'zomato@hdfcbank', 'Food & Dining');
    }
    if (r() > 0.3) add(key, 9 + Math.floor(r() * 15), 1400 + r() * 2200, 'debit', 'Third Wave Coffee', 'TWC THIRD WAVE COFFEE', 'Food & Dining');
    // groceries weekly (Zepto/Blinkit) — Zepto has no dictionary hit for 'Kiranakart' to show AI/correction
    for (let w = 0; w < 4; w++) add(key, 2 + w * 7, 700 + r() * 900, 'debit', w % 2 ? 'Blinkit' : 'Zepto', w % 2 ? 'blinkit@axisbank' : 'zeptonow@ybl', 'Groceries');
    add(key, 16, 1300 + r() * 800, 'debit', 'DMart', 'POS AVENUE SUPERMARTS DMART', 'Groceries');
    // transport
    for (let i = 0; i < 7; i++) {
      const u = r() > 0.5;
      add(key, 1 + Math.floor(r() * 28), 120 + r() * 380, 'debit', u ? 'Uber' : 'Rapido', u ? 'uber@axisbank' : 'rapido@ybl', 'Transport');
    }
    // shopping
    add(key, 8 + Math.floor(r() * 18), 900 + r() * 2600, 'debit', 'Amazon', 'AMAZON PAY INDIA', 'Shopping');
    if (r() > 0.4) add(key, 12 + Math.floor(r() * 14), 1200 + r() * 2500, 'debit', 'Myntra', 'MYNTRA DESIGNS', 'Shopping');
    if (mi === 1) add(key, 22, 3499, 'debit', 'BookMyShow', 'BOOKMYSHOW', 'Entertainment');
    if (mi === 2) add(key, 24, 6800, 'debit', 'IndiGo', 'INDIGO AIRLINES', 'Travel');
    add(key, 15 + Math.floor(r() * 10), 300 + r() * 600, 'debit', 'Apollo Pharmacy', 'APOLLO PHARMACY', 'Health & Fitness');
    add(key, 25, 2000, 'debit', 'Mom', 'sunitasharma@oksbi', 'Transfers');
    // an unrecognised local merchant (uncategorised -> "Other") to demo AI + correction loop
    add(key, 11 + Math.floor(r() * 10), 450 + r() * 300, 'debit', 'Sri Sai Kirana', 'q839201@ybl SRI SAI KIRANA', 'Other');
  });
  txns.sort((a, b) => b.date.localeCompare(a.date));
  return {
    version: 1,
    demo: true,
    txns,
    rules: [],
    profile: {
      name: 'Riya',
      monthlyIncome: 95000,
      emergencyFund: 120000,
      fixedCosts: [{ name: 'Rent', amount: 22000 }, { name: 'SIP', amount: 10000 }, { name: 'Society maintenance', amount: 1850 }],
      budgets: {},
    },
    goals: [
      { id: uid(), name: 'New MacBook', target: 140000, saved: 70000, targetDate: addMonths(today, 6) },
      { id: uid(), name: 'Japan trip', target: 250000, saved: 40000, targetDate: addMonths(today, 12) },
      { id: uid(), name: 'Emergency fund top-up', target: 190000, saved: 0, targetDate: addMonths(today, 14) },
    ],
    subs: {},
    learnLog: [],
    chat: [],
  };
}

export const SAMPLE_SMS = () => {
  const t = todayISO();
  const [y, m, d] = t.split('-');
  const dd = (n) => `${String(Math.max(1, Number(d) - n)).padStart(2, '0')}-${m}-${y.slice(2)}`;
  return `Rs.487.00 debited from A/c XX4821 on ${dd(0)} to VPA swiggy@icici (UPI Ref No 430198273645). Not you? Call 18002586161 - HDFC Bank

Dear Customer, INR 1,299.00 spent on ICICI Bank Card XX9012 on ${dd(1)} at AMAZON PAY INDIA. Avl Lmt: INR 84,210.00. If not you, call 18002662.

Sent Rs.640.00 From HDFC Bank A/C *4821 To Sri Sai Kirana On ${dd(1)} Ref 512398712345 Not You? Call 18002586161

Your A/c XX4821 is debited for INR 649.00 on ${dd(2)} towards NETFLIX autopay mandate. Avl Bal INR 1,02,334.10 -Axis Bank

Rs 214.00 debited from a/c **4821 on ${dd(2)} to VPA uber@axisbank. UPI Ref: 512376254. -SBI

Your OTP for login is 482913. Do not share it with anyone.

Rs.2,500.00 credited to A/c XX4821 on ${dd(3)} by UPI from rahul.verma@okaxis. Ref 4302983746 -Kotak Bank`;
};

export const SAMPLE_CSV = () => {
  const t = todayISO();
  const ym = t.slice(0, 7);
  return `Txn Date,Narration,Withdrawal Amt,Deposit Amt,Closing Balance
${ym}-02,UPI/430112/ZEPTO/zeptonow@ybl/Groceries,842.00,,98211.00
${ym}-03,UPI/430155/RAMESH KUMAR/rameshkumar@okhdfc/rent,22000.00,,76211.00
${ym}-04,POS 4521 DECATHLON SPORTS,2899.00,,73312.00
${ym}-06,UPI/430287/URBAN COMPANY/urbanco@icici/salon,799.00,,72513.00
${ym}-06,NEFT CR-ACME TECH PVT LTD-SALARY,,95000.00,167513.00
${ym}-08,ACH D- BAJAJ FINANCE EMI,4250.00,,163263.00
${ym}-09,UPI/430399/CHAI POINT/chaipoint@ybl/,180.00,,163083.00`;
};

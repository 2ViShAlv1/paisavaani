import { useState } from 'react';
import { MessageSquare, FileSpreadsheet, FileText, Upload, Sparkles, Check } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { parseSMSBlock, parseCSV, pdfToText, parseStatementText } from '../lib/parse.js';
import { categorize, CATEGORIES, merchantKey } from '../lib/categories.js';
import { callAI } from '../lib/ai.js';
import { SAMPLE_SMS, SAMPLE_CSV } from '../lib/demo.js';
import { inr, dateLabel, todayISO, uid } from '../lib/format.js';
import { Card, Badge, Empty, Wave } from '../components/ui.jsx';

export default function Import({ go }) {
  const { state, dispatch, notify } = useStore();
  const [tab, setTab] = useState('sms');
  const [text, setText] = useState('');
  const [rows, setRows] = useState(null);
  const [skipped, setSkipped] = useState([]);
  const [busy, setBusy] = useState('');
  const [provider, setProvider] = useState('');

  async function enrich(txns) {
    // learned rules → merchant DB → AI for the rest
    const withCat = txns.map((t) => {
      const c = categorize(t, state.rules);
      return c ? { ...t, ...c } : { ...t, category: '', catSource: '' };
    });
    const unknown = [...new Set(withCat.filter((t) => !t.category).map((t) => t.merchant))];
    if (unknown.length) {
      setBusy(`AI is categorising ${unknown.length} unfamiliar merchant${unknown.length === 1 ? '' : 's'}…`);
      const res = await callAI('categorize', unknown.map((m) => ({ merchant: m, sample: withCat.find((t) => t.merchant === m)?.raw })), {}, 40000);
      if (res.ok) {
        setProvider(res.provider);
        const map = Object.fromEntries((res.data?.results || []).map((r) => [r.merchant, r.category]));
        withCat.forEach((t) => { if (!t.category && CATEGORIES.includes(map[t.merchant])) { t.category = map[t.merchant]; t.catSource = 'ai'; } });
      }
    }
    withCat.forEach((t) => { if (!t.category) { t.category = t.direction === 'credit' ? 'Transfers' : 'Other'; t.catSource = 'default'; } });
    return withCat.map((t) => ({ ...t, include: true }));
  }

  async function parse() {
    setRows(null); setSkipped([]); setProvider('');
    setBusy('Parsing…');
    try {
      if (tab === 'sms') {
        const { txns, skipped } = parseSMSBlock(text);
        setSkipped(skipped);
        setRows(await enrich(txns));
      } else if (tab === 'csv') {
        const { txns } = parseCSV(text);
        setRows(await enrich(txns));
      }
    } finally { setBusy(''); }
  }

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setRows(null); setProvider('');
    if (/\.csv$/i.test(f.name)) {
      const t = await f.text();
      setTab('csv'); setText(t);
      setBusy('Parsing CSV…');
      setRows(await enrich(parseCSV(t).txns));
      setBusy('');
      return;
    }
    if (/\.pdf$/i.test(f.name)) {
      setTab('pdf');
      setBusy('Reading PDF…');
      try {
        const t = await pdfToText(f);
        setText(t);
        let txns = parseStatementText(t);
        if (txns.length < 2) {
          setBusy('Statement layout is messy — asking AI to extract rows…');
          const res = await callAI('statement', t, { today: todayISO() }, 55000);
          if (res.ok) {
            setProvider(res.provider);
            txns = (res.data?.transactions || []).filter((x) => x.amount > 0).map((x) => ({ id: uid(), date: x.date, amount: Number(x.amount), direction: x.direction === 'credit' ? 'credit' : 'debit', merchant: x.merchant, merchantKey: merchantKey(x.merchant), raw: x.raw || x.merchant, source: 'pdf', category: CATEGORIES.includes(x.category) ? x.category : '', catSource: 'ai' }));
          }
        }
        setRows(await enrich(txns));
      } catch (err) {
        notify(`Couldn't read that PDF (${err.message}). Password-protected? Try CSV export.`, 'warn');
      } finally { setBusy(''); }
    }
  }

  function confirm() {
    const txns = rows.filter((r) => r.include).map(({ include, ...t }) => t);
    dispatch({ type: 'ADD_TXNS', txns, source: tab.toUpperCase() });
    notify(`📥 Imported ${txns.length} transactions. Duplicates skipped automatically.`);
    setRows(null); setText('');
    go('transactions');
  }

  const tabs = [
    ['sms', 'Bank / UPI SMS', MessageSquare],
    ['csv', 'CSV statement', FileSpreadsheet],
    ['pdf', 'PDF statement', FileText],
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import money data</h1>
        <p className="text-sm text-slate-500">Messy is fine: paste raw bank SMS, drop a CSV or a PDF statement. OTPs and junk are ignored.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {tabs.map(([k, label, Icon]) => (
          <button key={k} onClick={() => { setTab(k); setRows(null); setText(''); }} className={`btn ${tab === k ? 'btn-dark' : 'btn-ghost'}`}><Icon size={15} />{label}</button>
        ))}
      </div>

      <Card>
        {tab !== 'pdf' ? (
          <div className="space-y-3">
            <textarea rows={9} className="input font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={tab === 'sms' ? 'Paste one or many bank / UPI SMS here…' : 'Paste CSV text, or upload a .csv file'} />
            <div className="flex flex-wrap gap-2 justify-between">
              <div className="flex gap-2">
                <button className="btn btn-ghost" onClick={() => setText(tab === 'sms' ? SAMPLE_SMS() : SAMPLE_CSV())}>Load sample {tab === 'sms' ? 'SMS (HDFC/ICICI/SBI/Axis/Kotak)' : 'HDFC-style CSV'}</button>
                {tab === 'csv' && <label className="btn btn-ghost cursor-pointer"><Upload size={15} /> Upload .csv<input type="file" accept=".csv" className="hidden" onChange={onFile} /></label>}
              </div>
              <button className="btn btn-primary" disabled={!text.trim() || !!busy} onClick={parse}>{busy ? <><Wave /> {busy}</> : <><Sparkles size={15} /> Parse & categorise</>}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl p-10 cursor-pointer hover:bg-slate-50">
              <FileText className="text-slate-400" />
              <span className="font-medium">Drop or choose a bank statement PDF</span>
              <span className="text-xs text-slate-500">Text is extracted in your browser. If the layout is messy, AI extracts the rows.</span>
              <input type="file" accept=".pdf" className="hidden" onChange={onFile} />
            </label>
            <a className="text-xs text-emerald-700 font-semibold" href="/sample-statement.pdf" download>Download a sample messy PDF statement to try →</a>
            {busy && <div className="text-sm text-slate-500 flex items-center gap-2"><Wave /> {busy}</div>}
          </div>
        )}
      </Card>

      {rows && (
        <Card title={`Preview · ${rows.length} transaction${rows.length === 1 ? '' : 's'} found`} subtitle="Check, fix categories, then confirm. Nothing is saved before you confirm." right={provider && <Badge tone="indigo">AI: {provider}</Badge>}>
          {skipped.length > 0 && <div className="text-xs text-slate-500 mb-2">Ignored {skipped.length} non-transaction message{skipped.length === 1 ? '' : 's'} (OTP / promo).</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th></th><th className="py-1">Date</th><th>Merchant</th><th>Category</th><th>How</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td><input type="checkbox" className="accent-emerald-600" checked={r.include} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} /></td>
                    <td className="py-1.5 whitespace-nowrap text-slate-500">{dateLabel(r.date)}</td>
                    <td><div className="font-medium">{r.merchant}</div><div className="text-[11px] text-slate-400 truncate max-w-[300px]">{r.raw}</div></td>
                    <td>
                      <select className="input !py-1 !w-44" value={r.category} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, category: e.target.value, catSource: 'manual' } : x)))}>
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td><Badge tone={{ rule: 'green', ai: 'indigo', dict: 'slate', manual: 'amber', default: 'red' }[r.catSource]}>{{ rule: 'learned rule', ai: 'AI', dict: 'merchant DB', manual: 'you', default: 'unsure' }[r.catSource]}</Badge></td>
                    <td className={`text-right font-semibold whitespace-nowrap ${r.direction === 'credit' ? 'text-emerald-600' : ''}`}>{r.direction === 'credit' ? '+' : '−'}{inr(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <Empty>No transactions recognised. Try the sample to see the expected format.</Empty>}
          </div>
          {!!rows.length && <div className="flex justify-end pt-3"><button className="btn btn-primary" onClick={confirm}><Check size={15} /> Import {rows.filter((r) => r.include).length}</button></div>}
        </Card>
      )}
    </div>
  );
}

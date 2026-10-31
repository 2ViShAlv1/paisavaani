import { useEffect, useRef, useState } from 'react';
import { CAT_COLORS, CAT_EMOJI } from '../lib/categories.js';

export function Card({ title, subtitle, right, children, className = '', pad = true }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
          <div>
            {title && <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <div className={pad ? 'px-5 pb-5 pt-2' : ''}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone = 'slate', icon }) {
  const tones = { slate: 'text-slate-900', green: 'text-emerald-600', red: 'text-red-600', amber: 'text-amber-600' };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 label">{icon}{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tracking-tight ${tones[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export function CatBadge({ cat }) {
  const c = CAT_COLORS[cat] || '#64748b';
  return (
    <span className="chip bg-slate-100 text-slate-700 whitespace-nowrap">
      <span className="h-2 w-2 rounded-full" style={{ background: c }} />
      <span>{CAT_EMOJI[cat]}</span>{cat}
    </span>
  );
}

export function Badge({ children, tone = 'slate' }) {
  const t = {
    slate: 'bg-slate-100 text-slate-600', green: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700', indigo: 'bg-indigo-50 text-indigo-700', violet: 'bg-violet-50 text-violet-700',
  }[tone];
  return <span className={`chip ${t}`}>{children}</span>;
}

export function Empty({ children }) {
  return <div className="text-sm text-slate-500 py-6 text-center">{children}</div>;
}

export function Progress({ value, color = '#10b981', bg = '#eef2f6', height = 8 }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ background: bg, height }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function Markdown({ text }) {
  // tiny, safe markdown: **bold**, *italic*, bullet lists, paragraphs
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>');
  const lines = String(text || '').split('\n');
  let html = '';
  let inList = false;
  for (const l of lines) {
    const li = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (li) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(li[1])}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (l.trim()) html += `<p>${inline(l)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return <div className="md text-sm leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: html }} />;
}

// Browser speech recognition (Chrome/Edge). Wispr Flow works in any text box too.
export function useSpeech({ onFinal, lang = 'en-IN' } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef(null);
  const finalRef = useRef('');
  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => () => recRef.current?.abort?.(), []);

  const start = () => {
    if (!supported) return false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    finalRef.current = '';
    rec.onresult = (e) => {
      let fin = '', int = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript + ' ';
        else int += r[0].transcript;
      }
      finalRef.current = fin;
      setInterim((fin + int).trim());
    };
    rec.onend = () => {
      setListening(false);
      const text = finalRef.current.trim() || '';
      if (text) onFinal?.(text);
      setInterim('');
    };
    rec.onerror = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
    return true;
  };
  const stop = () => recRef.current?.stop();
  return { supported, listening, interim, start, stop };
}

export function Wave() {
  return <span className="wave inline-flex items-center"><span /><span /><span /><span /><span /></span>;
}

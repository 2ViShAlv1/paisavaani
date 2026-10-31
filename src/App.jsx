import { useEffect, useState } from 'react';
import { LayoutDashboard, Receipt, Upload, Repeat, Target, MessageCircle, FileBarChart, UserRound, AudioLines, Mic, Menu, X } from 'lucide-react';
import { StoreProvider, useStore } from './lib/store.jsx';
import VoiceDock from './components/VoiceDock.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import Import from './pages/Import.jsx';
import Subscriptions from './pages/Subscriptions.jsx';
import Plan from './pages/Plan.jsx';
import Coach from './pages/Coach.jsx';
import Review from './pages/Review.jsx';
import Profile from './pages/Profile.jsx';
import VoiceLab from './pages/VoiceLab.jsx';

const NAV = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['transactions', 'Transactions', Receipt],
  ['import', 'Import SMS / statements', Upload],
  ['subscriptions', 'Recurring & subs', Repeat],
  ['plan', 'Goals & what-if', Target],
  ['coach', 'Coach', MessageCircle],
  ['review', 'Monthly review', FileBarChart],
  ['profile', 'Profile & budgets', UserRound],
  ['voicelab', 'Voice lab', AudioLines],
];

function Shell() {
  const { toast, state } = useStore();
  const initial = (location.hash.slice(1) || 'dashboard');
  const [page, setPage] = useState(NAV.some((n) => n[0] === initial) ? initial : 'dashboard');
  const [payload, setPayload] = useState(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [preset, setPreset] = useState('');
  const [menu, setMenu] = useState(false);

  const go = (p, data = null) => { setPage(p); setPayload(data ? { ...data } : null); setMenu(false); history.replaceState(null, '', `#${p}`); window.scrollTo(0, 0); };
  const openVoice = (text = '') => { setPreset(text); setVoiceOpen(true); };

  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openVoice(''); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const props = { go, openVoice, payload };
  const Page = { dashboard: Dashboard, transactions: Transactions, import: Import, subscriptions: Subscriptions, plan: Plan, coach: Coach, review: Review, profile: Profile, voicelab: VoiceLab }[page];

  return (
    <div className="min-h-full flex">
      <aside className={`fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 bg-ink text-slate-300 flex flex-col transition-transform ${menu ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 pt-6 pb-5 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-emerald-500 grid place-items-center text-white"><AudioLines size={18} /></div>
          <div>
            <div className="text-white font-bold tracking-tight text-lg leading-none">PaisaVaani</div>
            <div className="text-[11px] text-slate-400 mt-1">voice-first money coach</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setMenu(false)}><X size={18} /></button>
        </div>
        <nav className="px-3 space-y-0.5 flex-1 overflow-y-auto">
          {NAV.map(([k, label, Icon]) => (
            <button key={k} onClick={() => go(k)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${page === k ? 'bg-white/10 text-white font-semibold' : 'hover:bg-white/5'}`}>
              <Icon size={17} className={page === k ? 'text-amber-400' : ''} />{label}
            </button>
          ))}
        </nav>
        <div className="p-4">
          <button onClick={() => openVoice('')} className="w-full rounded-2xl bg-amber-500 hover:bg-amber-400 text-ink font-semibold py-3 flex items-center justify-center gap-2"><Mic size={17} /> Speak <span className="text-[10px] opacity-70 font-normal">Ctrl K</span></button>
          {state.demo && <div className="text-[11px] text-slate-500 mt-3 text-center">Demo persona loaded · reset in Profile</div>}
        </div>
      </aside>
      {menu && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMenu(false)} />}

      <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 lg:py-8">
        <div className="lg:hidden flex items-center justify-between mb-4 no-print">
          <button onClick={() => setMenu(true)} className="p-2 -ml-2"><Menu /></button>
          <span className="font-bold">PaisaVaani</span>
          <span className="w-8" />
        </div>
        <div className="max-w-6xl mx-auto"><Page {...props} /></div>
      </main>

      <button onClick={() => openVoice('')} className="voice-fab fixed bottom-6 right-6 z-40 h-16 w-16 rounded-full bg-amber-500 hover:bg-amber-400 text-white shadow-xl grid place-items-center recording lg:hidden"><Mic size={24} /></button>
      <VoiceDock open={voiceOpen} setOpen={setVoiceOpen} go={go} preset={preset} />

      {toast && (
        <div key={toast.id} className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-2xl px-4 py-3 text-sm shadow-xl max-w-[92vw] ${toast.kind === 'warn' ? 'bg-amber-600 text-white' : 'bg-ink text-white'}`}>{toast.text}</div>
      )}
    </div>
  );
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}

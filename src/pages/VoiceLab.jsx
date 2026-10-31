import { Mic, Wand2, ListChecks, ShieldCheck, Brain, ArrowRight } from 'lucide-react';
import { VOICE_EXAMPLES } from '../components/VoiceDock.jsx';
import { localUnderstand } from '../lib/parse.js';
import { Card, Badge } from '../components/ui.jsx';

const STEPS = [
  [Mic, 'Capture', 'Wispr Flow dictation into any box, or the built-in en-IN browser mic. Hinglish welcome.'],
  [Wand2, 'Clean', 'Strip fillers (umm, like, yaar, matlab), resolve self-corrections — the last stated value wins.'],
  [ListChecks, 'Structure', 'LLM converts intent into typed actions: transactions, rules, profile, goals, what-ifs, questions.'],
  [ShieldCheck, 'Confirm', 'You see exactly what was heard vs understood and edit before anything is saved.'],
  [Brain, 'Learn', 'Corrections become rules; the money model updates and the coach re-plans.'],
];

export default function VoiceLab({ openVoice }) {
  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Voice lab</h1>
        <p className="text-sm text-slate-500">How PaisaVaani turns messy speech into a structured money model.</p>
      </div>
      <div className="grid sm:grid-cols-5 gap-2">
        {STEPS.map(([Icon, t, d], i) => (
          <div key={t} className="card p-4 relative">
            <div className="flex items-center gap-2"><span className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 grid place-items-center"><Icon size={14} /></span><span className="font-semibold text-sm">{i + 1}. {t}</span></div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{d}</p>
          </div>
        ))}
      </div>

      <Card title="Try the messy examples" subtitle="Instant preview below uses the offline rule engine; “Run with AI” uses the LLM pipeline + confirmation step.">
        <div className="space-y-3">
          {VOICE_EXAMPLES.map((ex) => {
            const r = localUnderstand(ex.text);
            return (
              <div key={ex.label} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="amber">{ex.label}</Badge>
                  <button className="btn btn-dark !py-1.5 text-xs" onClick={() => openVoice(ex.text)}><Mic size={13} className="text-amber-400" /> Run with AI <ArrowRight size={13} /></button>
                </div>
                <div className="grid md:grid-cols-2 gap-3 mt-3 text-sm">
                  <div><div className="label mb-1">Raw speech</div><p className="text-slate-600 italic">“{ex.text}”</p></div>
                  <div><div className="label mb-1">Cleaned</div><p className="text-slate-900 font-medium">{r.clean_text}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {r.corrections.map((c, i) => <span key={i} className="chip bg-slate-100"><span className="heard">{c.heard}</span> → <span className="final">{c.final}</span></span>)}
                      {r.actions.map((a, i) => <Badge key={i} tone="indigo">{a.type.replace('_', ' ')}</Badge>)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Wispr Flow–ready everywhere" subtitle="Every text box is a voice box">
        <p className="text-sm text-slate-600 leading-relaxed">
          Wispr Flow dictates system-wide, so you can hold the Flow hotkey and talk into the Speak panel, the coach, imports or profile fields.
          Flow gives clean text; PaisaVaani turns that text into <b>money actions</b>, resolving the “400 — no wait, 450” moments that dictation keeps as-is because they're what you literally said.
          No Wispr Flow? The built-in en-IN browser mic works too.
        </p>
      </Card>
    </div>
  );
}

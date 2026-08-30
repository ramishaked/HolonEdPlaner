import React, { useEffect, useState } from 'react';
import { usePrinciples } from '../lib/PrinciplesContext';
import { ActionPlan, DiagnosticAnswers, PlanActivity, PrinciplePlan, TaskSource } from '../types';
import { RadarChart } from './RadarChart';
import { sourceMeta } from '../planBank';
import { useAudiences, audienceLabel } from '../lib/audiences';
import { recommendedFocus } from '../lib/scoring';

// Displayed chip = task source; fall back for older saved plans without `source`.
const activitySource = (a: PlanActivity): TaskSource =>
  a.source ?? (a.type === 'אחר' ? 'בית ספרי' : 'עירוני');

interface ExportViewProps {
  scores: { [key: number]: number };
  answers: DiagnosticAnswers;
  actionPlan: ActionPlan;
  onUpdateActionPlan: (fields: Partial<ActionPlan>) => void;
  /** Per-principle plans, owned by App (DB-backed) — read-only here. */
  plans: Record<number, PrinciplePlan>;
  /** Builder config, owned by App (DB-backed). null until loaded. */
  config: ExportConfig | null;
  onUpdateConfig: React.Dispatch<React.SetStateAction<ExportConfig | null>>;
  /** Signed URL of the school logo from the business card; empty when none was uploaded. */
  schoolLogoUrl: string;
}

export interface ExportConfig {
  sections: Record<string, boolean>;
  principalMessage: string;
  visionText: string;
}

// --- document section model -------------------------------------------------
type SectionKey =
  | 'cover'
  | 'principalMessage'
  | 'vision'
  | 'leadingPrinciples'
  | 'maturityMap'
  | 'detailedPlan'
  | 'gantt'
  | 'organizationalSacrifice'
  | 'signatures';

const SECTIONS: { key: SectionKey; label: string; icon: string }[] = [
  { key: 'cover', label: 'שער המסמך', icon: 'fa-solid fa-id-card' },
  { key: 'principalMessage', label: 'דבר המנהל/ת', icon: 'fa-solid fa-pen-fancy' },
  { key: 'vision', label: 'חזון בית ספרי', icon: 'fa-solid fa-eye' },
  { key: 'leadingPrinciples', label: 'עקרונות מובילים', icon: 'fa-solid fa-compass' },
  { key: 'maturityMap', label: 'מפת בשלות (רדאר + טבלה)', icon: 'fa-solid fa-chart-pie' },
  { key: 'detailedPlan', label: 'תוכנית פעולה מפורטת', icon: 'fa-solid fa-list-check' },
  { key: 'gantt', label: 'גאנט שנתי', icon: 'fa-solid fa-bars-staggered' },
  { key: 'organizationalSacrifice', label: 'הוויתור הארגוני', icon: 'fa-solid fa-scale-balanced' },
  { key: 'signatures', label: 'חתימות', icon: 'fa-solid fa-signature' },
];

const DEFAULT_SECTIONS: Record<SectionKey, boolean> = {
  cover: true,
  principalMessage: true,
  vision: true,
  leadingPrinciples: true,
  maturityMap: true,
  detailedPlan: true,
  gantt: false,
  organizationalSacrifice: false,
  signatures: true,
};

const CONFIG_KEY = 'school_export_config_v1';

const PRIORITY_LABEL: Record<string, string> = { high: 'גבוהה', medium: 'בינונית', low: 'רגילה' };
// Audience labels are DB data (the `audiences` picklist), resolved via useAudiences().

// --- demo Gantt data (fixed sample, per product decision) -------------------
const GANTT_MONTHS = ['ספט', 'אוק', 'נוב', 'דצמ', 'ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול'];
const GANTT_TASKS: { label: string; start: number; end: number; color: string }[] = [
  { label: 'סדנת היערכות והכשרת צוות', start: 0, end: 1, color: '#10b981' },
  { label: 'השקת יעד פריצת דרך ראשון', start: 1, end: 4, color: '#f43f5e' },
  { label: 'ועדות פדגוגיות ומעקב בשלות', start: 2, end: 8, color: '#6366f1' },
  { label: 'האקתון עירוני / בית רותר', start: 4, end: 5, color: '#f59e0b' },
  { label: 'השקת יעד פריצת דרך שני', start: 5, end: 8, color: '#0ea5e9' },
  { label: 'תערוכת תוצרים ורפלקציה מסכמת', start: 9, end: 10, color: '#8b5cf6' },
];

export const ExportView: React.FC<ExportViewProps> = ({
  scores,
  answers,
  actionPlan,
  onUpdateActionPlan,
  plans,
  config: dbConfig,
  onUpdateConfig,
  schoolLogoUrl,
}) => {
  const { principles, shortTitles, displayNumbers } = usePrinciples();
  // `all`, not the active subset: a retired audience must keep its label on activities
  // that already reference it, or it silently disappears from the exported document.
  const { all: allAudiences } = useAudiences();

  // Builder config lives in App (DB-backed). Merge over defaults so newly added
  // section keys are backfilled for plans saved before they existed.
  const config = {
    sections: { ...DEFAULT_SECTIONS, ...((dbConfig?.sections ?? {}) as Partial<Record<SectionKey, boolean>>) },
    principalMessage: dbConfig?.principalMessage ?? '',
    visionText: dbConfig?.visionText ?? '',
  };

  const setConfig = (updater: (prev: typeof config) => typeof config) =>
    onUpdateConfig(() => updater(config));

  const [docsNotice, setDocsNotice] = useState(false);

  const on = (k: SectionKey) => config.sections[k];
  const toggle = (k: SectionKey) =>
    setConfig((c) => ({ ...c, sections: { ...c.sections, [k]: !c.sections[k] } }));

  const today = new Date().toLocaleDateString('he-IL');
  const principlesWithPlan = principles.filter(
    (p) => (plans[p.id]?.activities?.length ?? 0) > 0 || (plans[p.id]?.victoryVision ?? '').trim()
  );

  // --- exports --------------------------------------------------------------
  const exportPdf = () => window.print();

  const exportWord = () => {
    const doc = document.getElementById('export-document');
    if (!doc) return;
    const html = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8">
      <style>
        body{font-family:Arial,'Segoe UI',sans-serif;direction:rtl;color:#0f172a;line-height:1.6;}
        h1{font-size:22pt;} h2{font-size:15pt;border-right:4px solid #2563eb;padding-right:8px;}
        table{border-collapse:collapse;width:100%;} td,th{border:1px solid #cbd5e1;padding:6px;font-size:10pt;}
        .muted{color:#64748b;}
      </style></head><body>${doc.innerHTML}</body></html>`;
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `תוכנית-עבודה-${actionPlan.schoolName || 'בית-ספר'}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- shared section heading ----------------------------------------------
  const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h2 className="text-lg font-bold border-r-4 border-primary-600 pr-2 text-slate-900">{children}</h2>
  );

  // ---- leading principles (editable here, rendered in section 4 below) --------
  const setStrength = (id?: number) => onUpdateActionPlan({ strengths: id ? [id] : [] });

  const setBreakthrough = (slot: 0 | 1) => (id?: number) => {
    const next = [...actionPlan.breakthroughs];
    if (id) next[slot] = id;
    else next.splice(slot, 1);
    onUpdateActionPlan({ breakthroughs: next.filter(Boolean) });
  };

  const focusFields = [
    {
      label: 'עוגן העוצמה הבית-ספרי',
      value: actionPlan.strengths[0],
      onPick: setStrength,
      reason: actionPlan.strengthReason ?? '',
      reasonKey: 'strengthReason' as const,
    },
    {
      label: 'יעד פריצת דרך ראשון',
      value: actionPlan.breakthroughs[0],
      onPick: setBreakthrough(0),
      reason: actionPlan.breakthroughReason1 ?? '',
      reasonKey: 'breakthroughReason1' as const,
    },
    {
      label: 'יעד פריצת דרך שני',
      value: actionPlan.breakthroughs[1],
      onPick: setBreakthrough(1),
      reason: actionPlan.breakthroughReason2 ?? '',
      reasonKey: 'breakthroughReason2' as const,
      // The list stays dense, so choosing here while the first slot is empty would make
      // the pick land in the first slot. Require them in order instead of surprising.
      disabled: !actionPlan.breakthroughs[0],
    },
  ];

  const picked = focusFields.map((f) => f.value).filter(Boolean) as number[];
  const focusClash = new Set(picked).size !== picked.length;

  const recommendation = recommendedFocus(answers);
  const recommendationDiffers =
    Object.keys(answers).length > 0 &&
    (actionPlan.strengths[0] !== recommendation.strength ||
      actionPlan.breakthroughs.join() !== recommendation.breakthroughs.join());

  const applyRecommendation = () =>
    onUpdateActionPlan({
      strengths: recommendation.strength ? [recommendation.strength] : [],
      breakthroughs: recommendation.breakthroughs,
    });

  const leadingRow = (label: string, id: number | undefined, reason: string | undefined, accent: string) => (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60" style={{ borderRightColor: accent, borderRightWidth: 4 }}>
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</span>
      <p className="text-sm font-bold text-slate-900 mt-0.5">
        {id ? `עיקרון ${displayNumbers[id] ?? id}: ${shortTitles[id] ?? ''}` : 'טרם נבחר'}
      </p>
      {reason ? (
        <p className="text-xs text-slate-600 leading-relaxed mt-2 whitespace-pre-line text-justify">{reason}</p>
      ) : (
        <p className="text-xs text-slate-400 italic mt-1">לא הוזן פירוט.</p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-6 items-start" dir="rtl">
      {/* ===================== RIGHT RAIL — document builder ===================== */}
      <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-36 space-y-4 print:hidden">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
            <i className="fa-solid fa-sliders text-primary-600"></i>
            בונה המסמך
          </h3>

          {/* school details */}
          <div className="space-y-2.5">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-500">שם בית הספר</label>
              <input
                type="text"
                value={actionPlan.schoolName}
                onChange={(e) => onUpdateActionPlan({ schoolName: e.target.value })}
                placeholder="שם בית הספר…"
                className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-500">שנת לימודים</label>
              <input
                type="text"
                value={actionPlan.schoolYear}
                onChange={(e) => onUpdateActionPlan({ schoolYear: e.target.value })}
                placeholder='למשל: תשפ"ז'
                className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Leading principles — edited here, where their effect on the document is
            visible. The system derives a suggestion from the maturity map; this is
            where the principal can disagree with it. */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">עקרונות מובילים</h4>
            {recommendationDiffers && (
              <button
                type="button"
                onClick={applyRecommendation}
                title="החזרת הבחירה לגזירה האוטומטית מהציונים"
                className="text-[10px] font-bold text-primary-700 hover:text-primary-900 hover:underline cursor-pointer shrink-0"
              >
                החזרה להמלצה
              </button>
            )}
          </div>

          {/* Show what the recommendation actually is — otherwise "restore it" is a
              blind click, and a suggestion frozen from a partial mapping stays hidden. */}
          {recommendation.strength ? (
            <div className="text-[10px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg p-2 space-y-0.5">
              <p className="font-bold text-slate-600">המלצת המערכת לפי המיפוי:</p>
              <p>
                <span className="text-emerald-700">עוגן</span> — {shortTitles[recommendation.strength]}
              </p>
              {recommendation.breakthroughs.length > 0 && (
                <p>
                  <span className="text-indigo-700">פריצה</span> —{' '}
                  {recommendation.breakthroughs.map((id) => shortTitles[id]).join(' · ')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-slate-400 leading-relaxed">
              אין עדיין מיפוי, ולכן אין המלצה. השלימו את מתחם האבחון או בחרו ידנית.
            </p>
          )}

          {focusFields.map((f) => (
            <div key={f.label} className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-500">{f.label}</label>
              <select
                value={f.value ?? ''}
                disabled={f.disabled}
                title={f.disabled ? 'בחרו קודם את יעד פריצת הדרך הראשון' : undefined}
                onChange={(e) => f.onPick(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <option value="">— טרם נבחר —</option>
                {principles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({scores[p.id]?.toFixed(1) ?? '1.0'})
                  </option>
                ))}
              </select>
              <textarea
                rows={2}
                value={f.reason}
                onChange={(e) => onUpdateActionPlan({ [f.reasonKey]: e.target.value })}
                placeholder="נימוק שיופיע במסמך…"
                className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          ))}

          {/* Advisory only — a school may deliberately double up. */}
          {focusClash && (
            <p className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
              <i className="fa-solid fa-triangle-exclamation mt-0.5"></i>
              <span>אותו עיקרון נבחר יותר מפעם אחת. אפשר להשאיר כך, אבל בדרך כלל עדיף לפזר.</span>
            </p>
          )}
        </div>

        {/* section toggles */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">מקטעי המסמך</h4>
          <div className="space-y-1">
            {SECTIONS.map((s) => (
              <div key={s.key}>
                <button
                  type="button"
                  onClick={() => toggle(s.key)}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-right transition-colors cursor-pointer ${
                    on(s.key) ? 'bg-primary-50 text-primary-800' : 'hover:bg-slate-50 text-slate-500'
                  }`}
                >
                  <i className={`${s.icon} text-xs w-4 text-center ${on(s.key) ? 'text-primary-600' : 'text-slate-300'}`}></i>
                  <span className="flex-1 text-xs font-bold">{s.label}</span>
                  <span
                    className={`relative w-8 h-4.5 rounded-full transition-colors shrink-0 ${
                      on(s.key) ? 'bg-primary-600' : 'bg-slate-200'
                    }`}
                    style={{ height: '1.1rem' }}
                  >
                    <span
                      className="absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all"
                      style={{ right: on(s.key) ? '0.125rem' : '1.125rem' }}
                    ></span>
                  </span>
                </button>

                {/* inline editors */}
                {s.key === 'principalMessage' && on('principalMessage') && (
                  <textarea
                    value={config.principalMessage}
                    onChange={(e) => setConfig((c) => ({ ...c, principalMessage: e.target.value }))}
                    rows={3}
                    placeholder="כתבו כאן את דבר המנהל/ת לפתיחת המסמך…"
                    className="w-full mt-1.5 mb-1 p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 leading-relaxed"
                  />
                )}
                {s.key === 'vision' && on('vision') && (
                  <textarea
                    value={config.visionText}
                    onChange={(e) => setConfig((c) => ({ ...c, visionText: e.target.value }))}
                    rows={3}
                    placeholder="נסחו את החזון הבית-ספרי…"
                    className="w-full mt-1.5 mb-1 p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 leading-relaxed"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* export */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ייצוא הדוח</h4>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={exportPdf}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
            >
              <i className="fa-solid fa-file-pdf"></i> ייצוא ל-PDF / הדפסה
            </button>
            <button
              onClick={exportWord}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-colors border border-slate-200 cursor-pointer"
            >
              <i className="fa-solid fa-file-word text-blue-600"></i> ייצוא ל-Word
            </button>
            <button
              onClick={() => setDocsNotice(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-colors border border-slate-200 cursor-pointer"
            >
              <i className="fa-solid fa-file-lines text-emerald-600"></i> ייצוא ל-Google Docs
            </button>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed mt-3">
            זוהי הדגמת פונקציונליות. PDF ו-Word פעילים; Google Docs יתווסף בהמשך.
          </p>
        </div>
      </aside>

      {/* ===================== MAIN — live A4 preview ===================== */}
      <main className="flex-1 min-w-0 w-full">
        <div
          id="export-document"
          className="bg-white border border-slate-200 shadow-md rounded-lg max-w-[820px] mx-auto p-8 md:p-12 space-y-8 print:shadow-none print:border-0 print:max-w-full print:p-0 print:rounded-none"
        >
          {/* 1. Cover */}
          {on('cover') && (
            <div className="text-center space-y-3 pb-6 border-b-2 border-slate-900">
              {/* RTL row: first child sits on the right (school logo), last on the left (Planner). */}
              <div className="flex items-start justify-between gap-4 mb-2">
                {schoolLogoUrl ? (
                  <img src={schoolLogoUrl} alt={`לוגו ${actionPlan.schoolName || 'בית הספר'}`} className="h-14 w-auto max-w-[180px] object-contain" />
                ) : (
                  <span />
                )}
                <img src="/planner-logo.png" alt="הפלנר" className="h-14 w-auto object-contain" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900">תוכנית עבודה שנתית בית-ספרית</h1>
              <p className="text-sm font-bold text-primary-700">ברוח עקרונות תמונת העתיד והמציאות המשתנה</p>
              <div className="flex flex-wrap justify-center gap-x-8 gap-y-1 text-xs font-mono text-slate-600 pt-2">
                <span><strong>בית ספר:</strong> {actionPlan.schoolName || '___________'}</span>
                <span><strong>שנת לימודים:</strong> {actionPlan.schoolYear || '_______'}</span>
                <span><strong>תאריך:</strong> {today}</span>
              </div>
            </div>
          )}

          {/* 2. Principal message */}
          {on('principalMessage') && (
            <section className="space-y-2">
              <SectionHeading>דבר המנהל/ת</SectionHeading>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line text-justify">
                {config.principalMessage || 'טרם נכתב דבר המנהל/ת. ניתן לערוך אותו בלוח הבקרה מימין.'}
              </p>
            </section>
          )}

          {/* 3. Vision */}
          {on('vision') && (
            <section className="space-y-2">
              <SectionHeading>חזון בית ספרי</SectionHeading>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line text-justify">
                {config.visionText || 'טרם נוסח חזון בית ספרי. ניתן לערוך אותו בלוח הבקרה מימין.'}
              </p>
            </section>
          )}

          {/* 4. Leading principles */}
          {on('leadingPrinciples') && (
            <section className="space-y-3">
              <SectionHeading>עקרונות מובילים לשנה הקרובה</SectionHeading>
              <div className="space-y-3">
                {leadingRow('עוגן העוצמה הבית-ספרי', actionPlan.strengths[0], actionPlan.strengthReason, '#10b981')}
                {leadingRow('יעד פריצת דרך ראשון', actionPlan.breakthroughs[0], actionPlan.breakthroughReason1, '#2563eb')}
                {leadingRow('יעד פריצת דרך שני', actionPlan.breakthroughs[1], actionPlan.breakthroughReason2, '#6366f1')}
              </div>
            </section>
          )}

          {/* 5. Maturity map */}
          {on('maturityMap') && (
            <section className="space-y-3">
              <SectionHeading>מפת הבשלות הבית-ספרית</SectionHeading>
              <div className="max-w-[360px] mx-auto">
                <RadarChart scores={scores} />
              </div>
              <table className="w-full border-collapse border border-slate-200 text-right text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-200 p-2 font-bold">#</th>
                    <th className="border border-slate-200 p-2 font-bold">העיקרון הפדגוגי</th>
                    <th className="border border-slate-200 p-2 font-bold text-center">ציון בשלות</th>
                    <th className="border border-slate-200 p-2 font-bold">הערות וראיות מהשטח</th>
                  </tr>
                </thead>
                <tbody>
                  {principles.map((p) => {
                    const ans = answers[p.id];
                    return (
                      <tr key={p.id}>
                        <td className="border border-slate-200 p-2 font-mono text-center">{displayNumbers[p.id] ?? p.id}</td>
                        <td className="border border-slate-200 p-2 font-bold">{shortTitles[p.id] ?? p.title}</td>
                        <td className="border border-slate-200 p-2 font-mono font-bold text-center bg-slate-50">
                          {ans ? (scores[p.id] || 1).toFixed(1) : '—'}
                        </td>
                        <td className="border border-slate-200 p-2 text-slate-600 italic">{ans?.evidence || 'לא תועדו נתונים'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {/* 6. Detailed plan */}
          {on('detailedPlan') && (
            <section className="space-y-4">
              <SectionHeading>תוכנית הפעולה המפורטת</SectionHeading>
              {principlesWithPlan.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  טרם נבנו פעילויות במתחם התכנון. הפעילויות שתוסיפו שם יופיעו כאן אוטומטית.
                </p>
              ) : (
                principlesWithPlan.map((p) => {
                  const plan = plans[p.id];
                  return (
                    <div key={p.id} className="border border-slate-200 rounded-xl overflow-hidden" style={{ borderRightColor: p.accentColor, borderRightWidth: 4 }}>
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                        <i className={p.icon} style={{ color: p.accentColor }}></i>
                        <span className="font-bold text-sm text-slate-900">עיקרון {displayNumbers[p.id] ?? p.id}: {shortTitles[p.id] ?? p.title}</span>
                      </div>
                      <div className="p-4 space-y-3">
                        {plan.activities.map((a) => {
                          const th = sourceMeta(activitySource(a));
                          return (
                            <div key={a.id} className="border border-slate-100 rounded-lg p-3 bg-white">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="font-bold text-sm text-slate-800">{a.title}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${th.badge}`}>{activitySource(a)}</span>
                              </div>
                              {a.desc && <p className="text-xs text-slate-600 leading-relaxed mb-2">{a.desc}</p>}
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-slate-500">
                                <span><strong className="text-slate-700">אחראי:</strong> {a.owner || '—'}</span>
                                <span><strong className="text-slate-700">קהל יעד:</strong> {audienceLabel(a.audiences, a.audienceNote, allAudiences)}</span>
                                <span><strong className="text-slate-700">עדיפות:</strong> {PRIORITY_LABEL[a.priority]}</span>
                              </div>
                              {a.metrics && (
                                <p className="text-[11px] text-slate-500 mt-1.5 pt-1.5 border-t border-slate-100">
                                  <strong className="text-slate-700">מדדי הצלחה:</strong> {a.metrics}
                                </p>
                              )}
                            </div>
                          );
                        })}
                        {plan.victoryVision && (
                          <div className="bg-amber-50/60 border border-amber-100 rounded-lg p-3">
                            <span className="text-xs font-bold text-amber-700 flex items-center gap-1.5 mb-1">
                              <i className="fa-solid fa-trophy"></i> תמונת ניצחון
                            </span>
                            <p className="text-xs text-slate-700 leading-relaxed text-justify">{plan.victoryVision}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          )}

          {/* 7. Gantt (demo) */}
          {on('gantt') && (
            <section className="space-y-3 break-inside-avoid">
              <SectionHeading>גאנט שנתי — מפת דרכים</SectionHeading>
              <p className="text-[11px] text-slate-400 italic">תרשים הדגמה עם נתונים לדוגמה. בהמשך ייגזר אוטומטית מהפעילויות בתוכנית.</p>
              <div className="border border-slate-200 rounded-xl p-3 overflow-x-auto">
                {/* month header */}
                <div className="grid items-center gap-px min-w-[640px]" style={{ gridTemplateColumns: `170px repeat(${GANTT_MONTHS.length}, 1fr)` }}>
                  <div></div>
                  {GANTT_MONTHS.map((m) => (
                    <div key={m} className="text-[10px] font-bold text-slate-500 text-center py-1">{m}</div>
                  ))}
                  {/* rows */}
                  {GANTT_TASKS.map((t) => (
                    <React.Fragment key={t.label}>
                      <div className="text-[11px] font-bold text-slate-700 py-1.5 pl-2 truncate" title={t.label}>{t.label}</div>
                      {GANTT_MONTHS.map((_, i) => {
                        const active = i >= t.start && i <= t.end;
                        const first = i === t.start;
                        const last = i === t.end;
                        return (
                          <div key={i} className="px-px py-1.5">
                            <div
                              className="h-3.5"
                              style={{
                                backgroundColor: active ? t.color : 'transparent',
                                borderTopRightRadius: first ? 9999 : 0,
                                borderBottomRightRadius: first ? 9999 : 0,
                                borderTopLeftRadius: last ? 9999 : 0,
                                borderBottomLeftRadius: last ? 9999 : 0,
                              }}
                            ></div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 8. Workshop protocol */}
          {/* 9. Organizational sacrifice */}
          {on('organizationalSacrifice') && (
            <section className="space-y-2 break-inside-avoid">
              <SectionHeading>הוויתור הארגוני המנהיגותי</SectionHeading>
              <p className="text-xs text-slate-500 italic">"מה אנו מפסיקים לעשות כדי לפנות קשב לחבר המורים לעסוק ביעדי פריצת הדרך?"</p>
              <div className="text-sm text-slate-700 leading-relaxed text-justify bg-rose-50/50 border border-rose-100 rounded-xl p-4">
                {actionPlan.organizationalSacrifice || 'טרם הוגדר ויתור ארגוני.'}
              </div>
            </section>
          )}

          {/* 10. Signatures */}
          {on('signatures') && (
            <div className="pt-16 flex flex-wrap justify-around gap-y-10 text-xs font-bold border-t border-slate-200 mt-10 break-inside-avoid">
              {['חתימת מנהל/ת בית הספר', 'חתימת מפקח/ת משרד החינוך', 'מוביל/ת פדגוגיה עירונית'].map((s) => (
                <div key={s} className="text-center space-y-10">
                  <div className="w-36 border-b border-slate-400 h-px"></div>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Google Docs stub */}
      {docsNotice && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 print:hidden"
          dir="rtl"
          onClick={() => setDocsNotice(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 p-6 text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 text-xl mx-auto">
              <i className="fa-solid fa-file-lines"></i>
            </div>
            <h3 className="text-base font-bold text-slate-900">ייצוא ל-Google Docs — בקרוב</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              בשלב זה ניתן לייצא ל-Word ולפתוח את הקובץ ישירות ב-Google Docs. ייצוא מקוון מלא ל-Google Docs יתווסף בהמשך הפיתוח.
            </p>
            <button
              onClick={() => setDocsNotice(false)}
              className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              הבנתי
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

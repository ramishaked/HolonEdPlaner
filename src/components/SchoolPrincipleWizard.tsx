import React, { useState } from 'react';
import { usePrinciples } from '../lib/PrinciplesContext';
import { COLOR_CHOICES, ICON_CHOICES, principleTheme } from '../lib/principleTheme';
import {
  defaultLevelNames,
  draftFromPrinciple,
  emptySchoolPrincipleDraft,
  saveSchoolPrinciple,
  SCHOOL_PRINCIPLE_SLOTS,
  type PrincipleDraft,
  type SchoolOwner,
} from '../lib/principlesAdmin';
import type { Principle, PrincipleMaturity } from '../types';
import { Labeled, inputClass } from './admin/fields';

interface Props {
  owner: SchoolOwner;
  /** Set to edit an existing principle instead of creating one. */
  editing?: { principle: Principle; rubric?: PrincipleMaturity };
  /** How many of the school's slots are already taken, for the header badge. */
  used: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}

/**
 * The school's own principle, in three steps.
 *
 * Deliberately leaner than the municipal `PrincipleEditor`: a principal is not writing
 * city policy, she is naming something her school already does. It asks only for what a
 * principle needs to be *usable* — identity, a summary, a rationale, and the four
 * maturity levels the diagnostic scores against. Everything the municipal editor also
 * offers (gaps, KPIs, deliverables, sources) is left out, and `PrincipleDetailView` hides
 * those sections when they are empty rather than rendering bare headings.
 *
 * This copies the step-rail / footer pattern from `ActivityWizard` rather than sharing a
 * generic shell with it. What looks common there is markup with different content — the
 * rail's reachability rule, the footer's labels and the success panel are all specific to
 * their wizard. The genuinely shared pieces are the primitives in `admin/fields`, which
 * both use. Revisit when a third wizard appears.
 */
export const SchoolPrincipleWizard: React.FC<Props> = ({ owner, editing, used, onClose, onSaved }) => {
  const { rubrics } = usePrinciples();

  const STEPS = ['זהות ותצוגה', 'התוכן', 'ארבע רמות הבשלות'];

  const [draft, setDraft] = useState<PrincipleDraft>(() =>
    editing
      ? draftFromPrinciple(editing.principle, editing.rubric)
      : emptySchoolPrincipleDraft(defaultLevelNames(rubrics)),
  );
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof PrincipleDraft>(key: K, value: PrincipleDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setLevel = (level: number, field: 'name' | 'description', value: string) =>
    setDraft((d) => ({
      ...d,
      levels: d.levels.map((l) => (l.level === level ? { ...l, [field]: value } : l)),
    }));

  const titleOk = draft.title.trim().length > 1;
  const labelOk = draft.shortLabel.trim().length > 0;
  const summaryOk = draft.shortSummary.trim().length > 1;
  const levelsOk = draft.levels.every((l) => l.name.trim().length > 0);

  const stepValid = [titleOk && labelOk, summaryOk, levelsOk][step];

  // Separate from stepValid: while editing, every step is reachable at once, so jumping
  // straight to the rubric must not let a half-filled principle through.
  const canSave = titleOk && labelOk && summaryOk && levelsOk;

  const colors = principleTheme(draft.colorName);

  const save = async () => {
    setSaving(true);
    setError('');
    const result = await saveSchoolPrinciple(draft, owner);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'השמירה נכשלה.');
      return;
    }
    onSaved(editing ? 'העיקרון עודכן.' : 'העיקרון נוסף למסע הבית-ספרי.');
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[95] flex items-start justify-center p-4 overflow-y-auto print:hidden"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i
                  className={`fa-solid ${editing ? 'fa-pen-to-square' : 'fa-star'} text-amber-500`}
                  aria-hidden="true"
                />
                {editing ? `עריכת "${editing.principle.title}"` : 'עיקרון ייחודי חדש'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {editing
                  ? 'השינוי מוצג מיד בכל מסכי המסע. המיפוי והפעילויות שכבר נשמרו אינם משתנים.'
                  : `העיקרון שייך לבית הספר בלבד ומתנהג ככל עיקרון אחר במסע. נותרו ${
                      SCHOOL_PRINCIPLE_SLOTS - used
                    } מתוך ${SCHOOL_PRINCIPLE_SLOTS}.`}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="סגירה"
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-lg" />
            </button>
          </div>
        </div>

        {/* step rail */}
        <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && <span className="h-px w-4 bg-slate-200 shrink-0" />}
              <button
                type="button"
                // Editing starts from valid data, so every step is reachable at once;
                // creating still walks forward one validated step at a time.
                onClick={() => (editing || i < step) && setStep(i)}
                disabled={!editing && i > step}
                className={`flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap rounded-full px-2.5 py-1 transition-colors ${
                  i === step
                    ? 'bg-primary-600 text-white'
                    : editing || i < step
                      ? 'text-primary-700 bg-primary-50 cursor-pointer hover:bg-primary-100'
                      : 'text-slate-400'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full grid place-items-center text-[9px] ${
                    !editing && i < step
                      ? 'bg-primary-600 text-white'
                      : i === step
                        ? 'bg-white/25'
                        : editing
                          ? 'bg-primary-100'
                          : 'bg-slate-200'
                  }`}
                >
                  {!editing && i < step ? <i className="fa-solid fa-check" aria-hidden="true" /> : i + 1}
                </span>
                {label}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto">
          {step === 0 && (
            <>
              <Labeled label="שם העיקרון">
                <input
                  className={inputClass}
                  value={draft.title}
                  placeholder="למשל: מצוינות במדעי הים"
                  onChange={(e) => set('title', e.target.value)}
                />
              </Labeled>

              <Labeled label="תווית מקוצרת" hint="מופיעה על מפת העכביש — 2–3 מילים">
                <input
                  className={inputClass}
                  value={draft.shortLabel}
                  placeholder="למשל: מדעי הים"
                  onChange={(e) => set('shortLabel', e.target.value)}
                />
              </Labeled>

              <Labeled label="צבע">
                <div className="flex flex-wrap gap-2">
                  {COLOR_CHOICES.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, colorName: c.name, accentColor: c.hex }))}
                      aria-label={c.label}
                      aria-pressed={draft.colorName === c.name}
                      className={`w-8 h-8 rounded-lg border-2 transition-transform cursor-pointer ${
                        draft.colorName === c.name
                          ? 'border-slate-800 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </Labeled>

              <Labeled label="אייקון">
                <div className="flex flex-wrap gap-1.5">
                  {ICON_CHOICES.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => set('icon', icon)}
                      aria-label={icon}
                      aria-pressed={draft.icon === icon}
                      className={`w-9 h-9 rounded-lg grid place-items-center border transition-colors cursor-pointer ${
                        draft.icon === icon
                          ? 'bg-primary-50 border-primary-400 text-primary-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <i className={icon} />
                    </button>
                  ))}
                </div>
              </Labeled>
            </>
          )}

          {step === 1 && (
            <>
              <Labeled label="תקציר" hint="נקרא בתפריט העקרונות בכל מסך — משפט אחד">
                <textarea
                  rows={2}
                  className={inputClass}
                  value={draft.shortSummary}
                  placeholder="במשפט אחד: מה העיקרון הזה אומר בבית הספר שלכם?"
                  onChange={(e) => set('shortSummary', e.target.value)}
                />
              </Labeled>

              <Labeled label="הרציונל" hint="רשות — למה העיקרון הזה חשוב לבית הספר">
                <textarea
                  rows={6}
                  className={inputClass}
                  value={draft.rationale}
                  placeholder="מה הביא אתכם לבחור בו, איזה צורך הוא עונה עליו, ולאן אתם רוצים להגיע."
                  onChange={(e) => set('rationale', e.target.value)}
                />
              </Labeled>

              <p className="text-xs text-slate-400 leading-relaxed">
                שדות נוספים שמופיעים בעקרונות העירוניים (פערים, מדדי הצלחה, תוצרים, מקורות) אינם
                נדרשים כאן — מסך ההיכרות לא יציג מקטעים ריקים.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              {/* The one thing she cannot otherwise see before committing. */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="h-1.5" style={{ backgroundColor: draft.accentColor }} />
                <div className="p-4 flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${colors.badge}`}>
                    <i className={draft.icon} />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{draft.title || 'ללא שם'}</p>
                    <p className="text-xs text-slate-500">
                      על מפת העכביש: <strong className="text-slate-700">{draft.shortLabel || '—'}</strong>
                    </p>
                    <p className="text-xs text-slate-500">
                      {editing
                        ? 'העיקרון כבר משתתף במסע הבית-ספרי.'
                        : 'לאחר השמירה העיקרון יצטרף לתפריט, לאבחון, למפת העכביש ולמסמך תוכנית העבודה — ומספר העקרונות למיפוי יגדל באחד.'}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                ארבע הרמות הן הסולם שלפיו תמפו את עצמכם בעיקרון הזה, והן קבועות במספרן מפני שנוסחת
                הציון נשענת עליהן. השמות מולאו מראש לפי אלה שבשימוש בעקרונות העירוניים — אפשר לשנות
                אותם. התיאורים הם רשות, והם שמופיעים כהסבר בזמן המיפוי.
              </p>

              {draft.levels.map((l) => (
                <div key={l.level} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-mono font-bold text-xs grid place-items-center shrink-0">
                      {l.level}
                    </span>
                    <input
                      className={inputClass}
                      value={l.name}
                      placeholder={`שם רמה ${l.level}`}
                      onChange={(e) => setLevel(l.level, 'name', e.target.value)}
                    />
                  </div>
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={l.description}
                    placeholder="איך נראה בית ספר שנמצא ברמה הזו?"
                    onChange={(e) => setLevel(l.level, 'description', e.target.value)}
                  />
                </div>
              ))}
            </>
          )}

          {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {step === 0 ? 'ביטול' : 'חזרה'}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={!stepValid}
              onClick={() => setStep(step + 1)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
            >
              המשך <i className="fa-solid fa-arrow-left mr-1.5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || !canSave}
              onClick={save}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer"
            >
              {saving ? 'שומר…' : editing ? 'שמירת השינויים' : 'יצירת העיקרון'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

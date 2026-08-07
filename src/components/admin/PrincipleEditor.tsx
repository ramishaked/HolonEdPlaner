import React, { useMemo, useState } from 'react';
import type { AdminViewer } from '../../lib/adminAuth';
import { rankedByPhrase, savePrinciple, type PrincipleDraft } from '../../lib/principlesAdmin';
import { COLOR_CHOICES, ICON_CHOICES } from '../../lib/principleTheme';
import { Collapsible } from '../Collapsible';
import { ArrayField, ConfirmDialog, Labeled, inputClass } from './fields';

interface Props {
  viewer: AdminViewer;
  initial: PrincipleDraft;
  /** How many schools already ranked themselves against this rubric. */
  assessedSchools: number;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

const Field: React.FC<{
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}> = ({ label, hint, value, onChange, rows, placeholder }) => (
  <Labeled label={label} hint={hint}>
    {rows ? (
      <textarea rows={rows} className={inputClass} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    ) : (
      <input className={inputClass} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    )}
  </Labeled>
);

/**
 * Full-page editor for one municipal principle.
 *
 * Explicit save, not the school side's debounced autosave: this content is what all
 * the schools read, a half-typed rationale must not ship, and a rubric rewrite needs a
 * confirmation step that autosave has nowhere to put.
 */
export const PrincipleEditor: React.FC<Props> = ({
  viewer, initial, assessedSchools, onCancel, onSaved,
}) => {
  const [draft, setDraft] = useState<PrincipleDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmRubric, setConfirmRubric] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const set = <K extends keyof PrincipleDraft>(key: K, value: PrincipleDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial]);
  const rubricDirty = useMemo(
    () => JSON.stringify(draft.levels) !== JSON.stringify(initial.levels),
    [draft.levels, initial.levels],
  );

  const isNew = !draft.uuid;

  const persist = async () => {
    setSaving(true);
    setError('');
    const r = await savePrinciple(draft, viewer);
    setSaving(false);
    setConfirmRubric(false);
    if (!r.ok) { setError(r.error ?? 'השמירה נכשלה.'); return; }
    onSaved(isNew ? `העיקרון "${draft.title.trim()}" נוסף.` : `העיקרון "${draft.title.trim()}" עודכן.`);
  };

  // Rewriting a level's wording redefines every score already stored against it.
  const save = () =>
    rubricDirty && assessedSchools > 0 && !isNew ? setConfirmRubric(true) : persist();

  const leave = () => (dirty ? setConfirmLeave(true) : onCancel());

  const setLevel = (level: number, patch: { name?: string; description?: string }) =>
    set('levels', draft.levels.map((l) => (l.level === level ? { ...l, ...patch } : l)));

  const setSource = (i: number, patch: Partial<PrincipleDraft['sources'][number]>) =>
    set('sources', draft.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const moveSource = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= draft.sources.length) return;
    const next = [...draft.sources];
    [next[i], next[j]] = [next[j], next[i]];
    set('sources', next);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${draft.accentColor}1a`, color: draft.accentColor }}
            >
              <i className={`${draft.icon} text-base`} />
            </span>
            <div>
              <h2 className="font-bold text-slate-900 leading-tight">
                {isNew ? 'עיקרון עירוני חדש' : `עריכת "${initial.title}"`}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                כל מה שנשמר כאן מוצג לכל בתי הספר במתחם ההיכרות ובאבחון.
              </p>
            </div>
          </div>
          <button
            onClick={leave}
            className="text-xs font-bold text-slate-500 hover:bg-slate-100 px-3 py-2 rounded-xl cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-arrow-right ml-1.5" aria-hidden="true" />
            חזרה לרשימה
          </button>
        </div>

        <Collapsible title="זהות ותצוגה" icon="fa-solid fa-palette" defaultOpen>
          <div className="space-y-4 pt-2">
            <Field label="שם העיקרון" value={draft.title} onChange={(v) => set('title', v)}
              placeholder="למשל: המיומנויות בליבת העשייה" />
            <Field label="תווית מקוצרת" hint="מופיעה במפת העכביש — 2–3 מילים"
              value={draft.shortLabel} onChange={(v) => set('shortLabel', v)} />

            <Labeled label="צבע" hint="נקבע מתוך רשימה סגורה — צבע חופשי לא ירונדר">
              <div className="flex flex-wrap gap-2">
                {COLOR_CHOICES.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, colorName: c.name, accentColor: c.hex }))}
                    aria-pressed={draft.colorName === c.name}
                    className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                      draft.colorName === c.name
                        ? 'border-slate-800 text-slate-800'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.hex }} />
                    {c.label}
                  </button>
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
                    aria-pressed={draft.icon === icon}
                    aria-label={icon}
                    className={`w-9 h-9 rounded-xl grid place-items-center border transition-colors cursor-pointer ${
                      draft.icon === icon
                        ? 'border-slate-800 text-slate-800 bg-slate-50'
                        : 'border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <i className={icon} />
                  </button>
                ))}
              </div>
            </Labeled>
          </div>
        </Collapsible>

        <Collapsible title="היכרות — התוכן שהמנהלות קוראות" icon="fa-solid fa-book-open" defaultOpen>
          <div className="space-y-4 pt-2">
            <Field label="תקציר" hint="משפט אחד שמופיע על כרטיס העיקרון"
              value={draft.shortSummary} onChange={(v) => set('shortSummary', v)} rows={2} />
            <Field label="הרציונל" value={draft.rationale} onChange={(v) => set('rationale', v)} rows={4} />
            <ArrayField label="אילו פערים העיקרון פותר?" values={draft.gapsSolved}
              onChange={(v) => set('gapsSolved', v)} addLabel="הוספת פער" />
            <Field label="הערך המוסף בארגון" value={draft.addedValue}
              onChange={(v) => set('addedValue', v)} rows={3} />
            <ArrayField label="אסטרטגיית היישום" hint="שלבים לפי הסדר"
              values={draft.implementationStrategy}
              onChange={(v) => set('implementationStrategy', v)} addLabel="הוספת שלב" />
            <Field label="הוויתורים הנדרשים (מה מפסיקים לעשות?)" value={draft.sacrificesRequired}
              onChange={(v) => set('sacrificesRequired', v)} rows={3} />
            <Field label="שותפויות באקו-סיסטם הקהילתי" value={draft.ecosystemPartnerships}
              onChange={(v) => set('ecosystemPartnerships', v)} rows={3} />
            <ArrayField label="מדדי הצלחה" values={draft.kpis}
              onChange={(v) => set('kpis', v)} addLabel="הוספת מדד" />
            <Field label="תוצר המורה (בסוף השנה)" value={draft.teacherDeliverable}
              onChange={(v) => set('teacherDeliverable', v)} rows={2} />
            <Field label="תוצר התלמיד (בסוף השנה)" value={draft.studentDeliverable}
              onChange={(v) => set('studentDeliverable', v)} rows={2} />
            <Field label="הצעד הראשון" value={draft.firstStep}
              onChange={(v) => set('firstStep', v)} rows={2} />
          </div>
        </Collapsible>

        <Collapsible title="קריטריונים — ארבע רמות הבשלות" icon="fa-solid fa-ruler">
          <div className="space-y-3 pt-2">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              אלה הקריטריונים שבית הספר מדרג את עצמו מולם באבחון. ארבע רמות קבועות —
              מספרן משפיע על חישוב הציון ולכן אינו ניתן לשינוי.
            </p>
            {assessedSchools > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                  {rankedByPhrase(assessedSchools)}
                </p>
                <p className="text-[11px] text-amber-700/80 mt-1.5 leading-relaxed">
                  שינוי הניסוח אינו משנה את הציונים שנשמרו — הם יפורשו מעכשיו לפי הנוסח החדש.
                  אם המשמעות משתנה מהותית, שקלו עיקרון חדש במקום עריכה.
                </p>
              </div>
            )}
            {draft.levels.map((l) => (
              <div key={l.level} className="border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 grid place-items-center text-xs font-bold shrink-0">
                    {l.level}
                  </span>
                  <input
                    className={inputClass}
                    value={l.name}
                    placeholder={`שם רמה ${l.level} — למשל: מתהווה`}
                    onChange={(e) => setLevel(l.level, { name: e.target.value })}
                  />
                </div>
                <textarea
                  rows={2}
                  className={inputClass}
                  value={l.description}
                  placeholder="מה מאפיין בית ספר ברמה הזו?"
                  onChange={(e) => setLevel(l.level, { description: e.target.value })}
                />
              </div>
            ))}
          </div>
        </Collapsible>

        <Collapsible title={`מקורות והרחבות (${draft.sources.length})`} icon="fa-solid fa-link">
          <div className="space-y-3 pt-2">
            {draft.sources.map((s, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <input
                    className={inputClass}
                    value={s.title}
                    placeholder="כותרת המקור"
                    onChange={(e) => setSource(i, { title: e.target.value })}
                  />
                  <button type="button" onClick={() => moveSource(i, -1)} disabled={i === 0}
                    aria-label="הזזה למעלה"
                    className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default p-1.5 cursor-pointer shrink-0">
                    <i className="fa-solid fa-chevron-up text-[10px]" />
                  </button>
                  <button type="button" onClick={() => moveSource(i, 1)} disabled={i === draft.sources.length - 1}
                    aria-label="הזזה למטה"
                    className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default p-1.5 cursor-pointer shrink-0">
                    <i className="fa-solid fa-chevron-down text-[10px]" />
                  </button>
                  <button type="button" onClick={() => set('sources', draft.sources.filter((_, j) => j !== i))}
                    aria-label="הסרת המקור"
                    className="text-slate-300 hover:text-rose-600 p-1.5 cursor-pointer shrink-0">
                    <i className="fa-solid fa-xmark text-xs" />
                  </button>
                </div>
                <textarea rows={2} className={inputClass} value={s.description} placeholder="תיאור קצר"
                  onChange={(e) => setSource(i, { description: e.target.value })} />
                <div className="flex flex-wrap gap-2">
                  <input className={`${inputClass} flex-1 min-w-[200px]`} value={s.url} placeholder="קישור (אופציונלי)"
                    dir="ltr" onChange={(e) => setSource(i, { url: e.target.value })} />
                  <input className={`${inputClass} flex-1 min-w-[160px]`} value={s.keywords}
                    placeholder="מילות מפתח (אופציונלי)"
                    onChange={(e) => setSource(i, { keywords: e.target.value })} />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => set('sources', [...draft.sources, { title: '', description: '', url: '', keywords: '' }])}
              className="text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg cursor-pointer"
            >
              <i className="fa-solid fa-plus ml-1.5" aria-hidden="true" />
              הוספת מקור
            </button>
          </div>
        </Collapsible>

        {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}
      </div>

      {/* Sticky save bar — the editor is long, and the state of the draft must stay visible. */}
      <div className="sticky bottom-4 bg-white rounded-2xl border border-slate-200 shadow-lg px-5 py-3 flex items-center justify-between gap-3">
        <p className={`text-xs font-bold ${dirty ? 'text-amber-700' : 'text-slate-400'}`}>
          {dirty ? 'יש שינויים שלא נשמרו' : 'אין שינויים לשמירה'}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDraft(initial)}
            disabled={!dirty || saving}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-default cursor-pointer"
          >
            ביטול השינויים
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving || draft.title.trim().length < 2}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
          >
            {saving ? 'שומר…' : isNew ? 'יצירת העיקרון' : 'שמירה'}
          </button>
        </div>
      </div>

      {confirmRubric && (
        <ConfirmDialog
          title="שינוי הרובריקה אחרי שכבר דירגו"
          confirmLabel="שמירה בכל זאת"
          tone="neutral"
          busy={saving}
          onConfirm={persist}
          onCancel={() => setConfirmRubric(false)}
        >
          <p className="font-bold text-slate-800">{rankedByPhrase(assessedSchools)}.</p>
          <p>
            הציונים שנשמרו לא ישתנו — הם יפורשו מעכשיו לפי הנוסח החדש. אם המשמעות של רמה
            כלשהי משתנה מהותית, עדיף עיקרון חדש על פני עריכה.
          </p>
        </ConfirmDialog>
      )}

      {confirmLeave && (
        <ConfirmDialog
          title="יציאה בלי לשמור"
          confirmLabel="יציאה בלי לשמור"
          busy={false}
          onConfirm={onCancel}
          onCancel={() => setConfirmLeave(false)}
        >
          <p>יש שינויים שלא נשמרו. יציאה עכשיו תבטל אותם.</p>
        </ConfirmDialog>
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { usePrinciples } from '../lib/PrinciplesContext';
import { useAudiences } from '../lib/audiences';
import type { BankItem } from '../lib/activityBank';
import {
  createActivity,
  matchImportRow,
  upsertActivities,
  draftFromBankItem,
  emptyDraft,
  findSimilar,
  similarity,
  updateActivity,
  type ActivityDraft,
  type BulkResult,
  type DuplicateHit,
} from '../lib/activityBankAdmin';
import { guessMapping, parseSheet, type ParsedSheet } from '../lib/spreadsheet';
import { Chip, Labeled, inputClass } from './admin/fields';
import type { AdminViewer } from '../lib/adminAuth';
import { SOURCE_META } from '../planBank';
import type { TaskSource } from '../types';

interface Props {
  /** Proof the caller passed the admin gate — the wizard cannot be opened without it. */
  viewer: AdminViewer;
  /** Everything already in the bank — used only to warn about look-alikes. */
  existing: BankItem[];
  /** Set to edit an existing municipal activity instead of creating a new one. */
  editing?: BankItem;
  onClose: () => void;
  /** Called after a successful save so the caller can refresh the bank. */
  onSaved: () => void;
}

type Mode = 'single' | 'bulk';

const STEPS = ['פרטי הפעילות', 'שיוך לעקרונות ולקהל', 'מדדים ויישום', 'סיכום ושמירה'];

// ---- small shared bits ------------------------------------------------------

/** Advisory only — the goal is to inform, never to block the save. */
const DuplicateWarning: React.FC<{ hits: DuplicateHit[] }> = ({ hits }) => {
  if (!hits.length) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
      <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
        {hits[0].exact ? 'קיימת כבר פעילות בשם זהה' : 'קיימות פעילויות דומות בבנק'}
      </p>
      <ul className="mt-1.5 space-y-1">
        {hits.map((h) => (
          <li key={h.item.key} className="text-[11px] text-amber-900/90 flex items-start gap-1.5">
            <span className="text-amber-500 mt-0.5">•</span>
            <span>
              {h.item.title}
              <span className="text-amber-700/70"> — התאמה {Math.round(h.score * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-amber-700/80 mt-2">
        זו הערה בלבד — אפשר להמשיך ולשמור אם הפעילות אכן שונה.
      </p>
    </div>
  );
};

// ---- the wizard -------------------------------------------------------------

export const ActivityWizard: React.FC<Props> = ({ viewer, existing, editing, onClose, onSaved }) => {
  const { principles: allPrinciples, orderToId } = usePrinciples();
  // The bank is municipal, so only municipal principles may be linked. RLS hands a city
  // admin every school's own principles too; linking one would put a municipal activity
  // under a principle only that school can see — and a school deleting its principle
  // cascades the link away, leaving a bank item attached to nothing.
  const principles = useMemo(
    () => allPrinciples.filter((p) => p.scope === 'municipal'),
    [allPrinciples],
  );
  const { audiences } = useAudiences();

  const [mode, setMode] = useState<Mode>('single');
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ActivityDraft>(() =>
    editing ? draftFromBankItem(editing) : emptyDraft(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string>('');

  const set = <K extends keyof ActivityDraft>(key: K, value: ActivityDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggle = (key: 'principles', value: number) =>
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value],
    }));

  const toggleAudience = (slug: string) =>
    setDraft((d) => ({
      ...d,
      audiences: d.audiences.includes(slug)
        ? d.audiences.filter((s) => s !== slug)
        : [...d.audiences, slug],
    }));

  // An edited activity must not be flagged as a duplicate of itself.
  const others = useMemo(
    () => (editing ? existing.filter((i) => i.key !== editing.key) : existing),
    [existing, editing],
  );
  const hits = useMemo(() => findSimilar(draft.title, others), [draft.title, others]);

  const stepValid = [
    draft.title.trim().length > 1 && draft.short.trim().length > 1,
    draft.principles.length > 0,
    true,
    true,
  ][step];

  const save = async () => {
    setSaving(true);
    setError('');
    const r = editing
      ? await updateActivity({ ...draft, id: editing.key }, orderToId)
      : await createActivity(draft, viewer, orderToId);
    setSaving(false);
    if (!r.ok) { setError(r.error ?? 'השמירה נכשלה.'); return; }
    setDone(editing ? 'הפעילות עודכנה.' : 'הפעילות נוספה לבנק.');
    onSaved();
  };

  const restart = () => { setDraft(emptyDraft()); setStep(0); setDone(''); setError(''); };

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
                  className={`fa-solid ${editing ? 'fa-pen-to-square' : 'fa-wand-magic-sparkles'} text-primary-600`}
                  aria-hidden="true"
                />
                {editing ? 'עריכת פעילות' : 'הוספת פעילות לבנק'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {editing
                  ? 'השינוי יופיע מיד לכל בתי הספר. תוכניות שכבר לקחו את הפעילות אינן משתנות.'
                  : 'הפעילות תתווסף לבנק העירוני ותוצג לכל בתי הספר.'}
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

          {/* Bulk import creates rows; it has no meaning while editing one. */}
          <div className={`flex gap-1.5 mt-4 ${editing ? 'hidden' : ''}`}>
            <button
              type="button"
              onClick={() => { setMode('single'); setDone(''); }}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                mode === 'single' ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <i className="fa-solid fa-plus ml-1.5" aria-hidden="true" /> פעילות אחת
            </button>
            <button
              type="button"
              onClick={() => { setMode('bulk'); setDone(''); }}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                mode === 'bulk' ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <i className="fa-solid fa-file-arrow-up ml-1.5" aria-hidden="true" /> ייבוא מגיליון
            </button>
          </div>
        </div>

        {mode === 'bulk' ? (
          <BulkImport viewer={viewer} existing={existing} onSaved={onSaved} onClose={onClose} />
        ) : done ? (
          <div className="p-8 text-center">
            <i className="fa-solid fa-circle-check text-4xl text-emerald-500" aria-hidden="true" />
            <p className="font-bold text-slate-800 mt-3">{done}</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              {!editing && (
                <button
                  onClick={restart}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 cursor-pointer"
                >
                  הוספת פעילות נוספת
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-600 hover:opacity-90 cursor-pointer"
              >
                סיום
              </button>
            </div>
          </div>
        ) : (
          <>
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
                  <Labeled label="שם הפעולה">
                    <input
                      autoFocus
                      className={inputClass}
                      value={draft.title}
                      onChange={(e) => set('title', e.target.value)}
                      placeholder="למשל: סדנת חשיבה עיצובית לצוות"
                    />
                  </Labeled>
                  <DuplicateWarning hits={hits} />
                  <Labeled label="מטרת העל" hint="משפט אחד שמופיע על הכרטיס">
                    <input
                      className={inputClass}
                      value={draft.short}
                      onChange={(e) => set('short', e.target.value)}
                      placeholder="מה הפעילות באה להשיג?"
                    />
                  </Labeled>
                  <Labeled label="הסבר קצר על הפעולה" hint="(אופציונלי)">
                    <textarea
                      rows={4}
                      className={inputClass}
                      value={draft.description}
                      onChange={(e) => set('description', e.target.value)}
                      placeholder="איך זה נראה בפועל בבית הספר?"
                    />
                  </Labeled>
                </>
              )}

              {step === 1 && (
                <>
                  <Labeled label="עקרונות" hint="פעילות אחת יכולה לשרת כמה עקרונות">
                    <div className="flex flex-wrap gap-2">
                      {principles.map((p) => (
                        <Chip
                          key={p.id}
                          on={draft.principles.includes(p.id)}
                          onClick={() => toggle('principles', p.id)}
                        >
                          {p.title}
                        </Chip>
                      ))}
                    </div>
                  </Labeled>
                  {!draft.principles.length && (
                    <p className="text-[11px] text-slate-400">בחרו לפחות עיקרון אחד כדי להמשיך.</p>
                  )}

                  <Labeled label="קהל יעד" hint="אפשר לבחור כמה">
                    <div className="flex flex-wrap gap-2">
                      {audiences.map((a) => (
                        <Chip
                          key={a.slug}
                          on={draft.audiences.includes(a.slug)}
                          onClick={() => toggleAudience(a.slug)}
                        >
                          {a.label}
                        </Chip>
                      ))}
                    </div>
                  </Labeled>
                  <input
                    className={inputClass}
                    value={draft.audienceNote}
                    onChange={(e) => set('audienceNote', e.target.value)}
                    placeholder={
                      audiences.some((a) => a.isOther && draft.audiences.includes(a.slug))
                        ? 'פרטו את קהל היעד…'
                        : 'פירוט (אופציונלי) — למשל שכבת ח׳'
                    }
                  />
                </>
              )}

              {step === 2 && (
                <>
                  <Labeled label="מדדי הצלחה ויעדים" hint="ייכנסו אוטומטית לתוכנית בעת הוספת הפעילות">
                    <textarea
                      rows={3}
                      className={inputClass}
                      value={draft.metrics}
                      onChange={(e) => set('metrics', e.target.value)}
                      placeholder="למשל: קיום 3 מפגשים עד סוף מחצית א׳; 80% מהצוות משתתפים."
                    />
                  </Labeled>
                  <Labeled label="למי פונים ברשות" hint="(אופציונלי)">
                    <input
                      className={inputClass}
                      value={draft.contact}
                      onChange={(e) => set('contact', e.target.value)}
                      placeholder="למשל: אגף חדשנות"
                    />
                  </Labeled>
                  <Labeled label="מקור הפעילות">
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(SOURCE_META) as TaskSource[]).map((s) => (
                        <Chip key={s} on={draft.source === s} onClick={() => set('source', s)}>
                          {s}
                        </Chip>
                      ))}
                    </div>
                  </Labeled>
                </>
              )}

              {step === 3 && (
                <>
                  <DuplicateWarning hits={hits} />
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="h-1.5" style={{ backgroundColor: SOURCE_META[draft.source].accent }} />
                    <div className="p-4 space-y-2.5">
                      <p className="font-bold text-slate-800">{draft.title || '—'}</p>
                      <p className="text-xs text-slate-600">{draft.short}</p>
                      <dl className="text-[11px] text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                        <div>
                          <dt className="inline font-bold text-slate-700">עקרונות: </dt>
                          <dd className="inline">
                            {principles
                              .filter((p) => draft.principles.includes(p.id))
                              .map((p) => p.title)
                              .join(' · ') || '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline font-bold text-slate-700">קהל יעד: </dt>
                          <dd className="inline">
                            {[
                              ...audiences.filter((a) => draft.audiences.includes(a.slug)).map((a) => a.label),
                              draft.audienceNote.trim(),
                            ].filter(Boolean).join(' · ') || '—'}
                          </dd>
                        </div>
                        {draft.metrics.trim() && (
                          <div>
                            <dt className="inline font-bold text-slate-700">מדדים: </dt>
                            <dd className="inline">{draft.metrics}</dd>
                          </div>
                        )}
                        {draft.contact.trim() && (
                          <div>
                            <dt className="inline font-bold text-slate-700">פונים אל: </dt>
                            <dd className="inline">{draft.contact}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>
                  {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}
                </>
              )}
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
                  disabled={saving}
                  onClick={save}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
                >
                  {saving ? 'שומר…' : editing ? 'שמירת השינויים' : 'שמירת הפעילות'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ---- bulk import ------------------------------------------------------------

const IMPORT_FIELDS: { key: keyof ActivityDraft | 'principles'; label: string; required?: boolean }[] = [
  { key: 'slug', label: 'מזהה (לעדכון פעילות קיימת)' },
  { key: 'title', label: 'שם הפעולה', required: true },
  { key: 'short', label: 'מטרת העל' },
  { key: 'description', label: 'הסבר קצר על הפעולה' },
  { key: 'metrics', label: 'מדדי הצלחה ויעדים' },
  { key: 'audienceNote', label: 'קהל יעד' },
  { key: 'contact', label: 'למי פונים ברשות' },
  { key: 'principles', label: 'עיקרון' },
];

const BulkImport: React.FC<{
  viewer: AdminViewer;
  existing: BankItem[];
  onSaved: () => void;
  onClose: () => void;
}> = ({ viewer, existing, onSaved, onClose }) => {
  const { principles: allPrinciples, orderToId } = usePrinciples();
  // The bank is municipal, so only municipal principles may be linked. RLS hands a city
  // admin every school's own principles too; linking one would put a municipal activity
  // under a principle only that school can see — and a school deleting its principle
  // cascades the link away, leaving a bank item attached to nothing.
  const principles = useMemo(
    () => allPrinciples.filter((p) => p.scope === 'municipal'),
    [allPrinciples],
  );

  // Grouped from the copy already passed in, not a second fetch — new rows only need
  // it to be ranked after the existing ones in their principle group.
  const bank = useMemo(() => {
    const out: Record<number, BankItem[]> = {};
    for (const item of existing) {
      if (item.isActive) for (const p of item.principles) (out[p] ??= []).push(item);
    }
    return out;
  }, [existing]);

  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  /** Each distinct value in the sheet's principle column → the principles it means. */
  const [principleMap, setPrincipleMap] = useState<Record<string, number[]>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [parseError, setParseError] = useState('');

  const ingest = (text: string) => {
    try {
      const parsed = parseSheet(text);
      if (!parsed.rows.length) { setParseError('לא נמצאו שורות בגיליון.'); return; }
      setSheet(parsed);
      setMapping(guessMapping(parsed.headers));
      setParseError('');
    } catch {
      setParseError('לא הצלחנו לקרוא את הקובץ. ודאו שהוא CSV או טקסט מופרד בטאבים.');
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      setParseError('קובץ אקסל אינו נתמך ישירות. שמרו אותו כ-CSV (קובץ ← שמירה בשם ← CSV) והעלו שוב.');
      return;
    }
    ingest(await file.text());
  };

  const get = (row: Record<string, string>, field: string) =>
    mapping[field] ? (row[mapping[field]] ?? '').trim() : '';

  /** The distinct principle labels the sheet actually uses, in first-seen order. */
  const sheetPrincipleValues = useMemo(() => {
    if (!sheet || !mapping.principles) return [];
    const seen: string[] = [];
    for (const row of sheet.rows) {
      const v = get(row, 'principles');
      const key = v || '—';
      if (!seen.includes(key)) seen.push(key);
    }
    return seen;
  }, [sheet, mapping.principles]);

  /**
   * Pre-fill the mapping where the sheet's wording is close enough to a principle title.
   * A sheet may legitimately use its own shorthand ("בינה מלאכותית" for "הטמעת AI
   * כתשתית"), which no string match can resolve — those stay empty for the admin to set.
   */
  useEffect(() => {
    if (!sheetPrincipleValues.length) return;
    setPrincipleMap((prev) => {
      const next = { ...prev };
      for (const value of sheetPrincipleValues) {
        if (next[value]) continue;
        const text = value.toLowerCase();
        const matched = principles
          .filter((p) => {
            const t = p.title.toLowerCase();
            return text.includes(t) || t.includes(text) || similarity(value, p.title) >= 0.6;
          })
          .map((p) => p.id);
        next[value] = matched;
      }
      return next;
    });
  }, [sheetPrincipleValues, principles]);

  const drafts = useMemo(() => {
    if (!sheet) return [];

    return sheet.rows.map((row) => {
      const key = get(row, 'principles') || '—';
      const draft: ActivityDraft = {
        ...emptyDraft(),
        slug: get(row, 'slug'),
        title: get(row, 'title'),
        short: get(row, 'short'),
        description: get(row, 'description'),
        metrics: get(row, 'metrics'),
        audienceNote: get(row, 'audienceNote'),
        contact: get(row, 'contact'),
        principles: principleMap[key] ?? [],
      };
      return draft;
    });
  }, [sheet, mapping, principleMap]);

  /** Which draft fields the admin actually mapped — an update writes only those. */
  const mappedFields = useMemo(
    () => new Set(Object.keys(mapping).filter((f) => mapping[f])),
    [mapping],
  );

  const rowState = useMemo(
    () =>
      drafts.map((d) => {
        const { match, ambiguous } = matchImportRow(d, existing);
        return {
          draft: d,
          match,
          ambiguous: !!ambiguous,
          // A row updating itself is not a duplicate.
          hits: match ? [] : findSimilar(d.title, existing),
          ready:
            !ambiguous &&
            d.title.trim().length > 1 &&
            // An update may legitimately carry no principle column at all.
            (!!match || d.principles.length > 0),
        };
      }),
    [drafts, existing],
  );

  const readyRows = rowState.filter((r) => r.ready);
  const createCount = readyRows.filter((r) => !r.match).length;
  const updateCount = readyRows.filter((r) => r.match).length;
  const readyCount = readyRows.length;
  const dupCount = rowState.filter((r) => r.hits.length).length;

  const runImport = async () => {
    setImporting(true);
    // Look-alikes are imported too — the warning is advisory, per the product decision.
    const r = await upsertActivities(
      readyRows.map((s) => ({ draft: s.draft, match: s.match })),
      viewer,
      orderToId,
      bank,
      { fields: mappedFields, linkPrinciples: !!mapping.principles },
    );
    setImporting(false);
    setResult(r);
    onSaved();
  };

  if (result) {
    return (
      <div className="p-8 text-center">
        <i className="fa-solid fa-circle-check text-4xl text-emerald-500" aria-hidden="true" />
        <p className="font-bold text-slate-800 mt-3">
          {result.created} פעילויות נוספו לבנק
          {result.updated > 0 && ` · ${result.updated} עודכנו`}.
        </p>
        {result.updated > 0 && (
          <p className="text-[11px] text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
            עדכון משנה רק את התוכן — הסדר בבנק ומה שהוסתר נשמרים. מחיקת שורה מהגיליון
            אינה מוחקת אותה מהבנק.
          </p>
        )}
        {!!result.failed.length && (
          <div className="text-right bg-rose-50 border border-rose-100 rounded-xl p-3 mt-4">
            <p className="text-xs font-bold text-rose-700">{result.failed.length} שורות לא נשמרו:</p>
            <ul className="mt-1 space-y-0.5">
              {result.failed.slice(0, 8).map((f) => (
                <li key={f.row} className="text-[11px] text-rose-900/80">
                  שורה {f.row}: {f.title || '(ללא שם)'} — {f.error}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={onClose}
          className="mt-5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary-600 hover:opacity-90 cursor-pointer"
        >
          סיום
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
      {!sheet ? (
        <>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
            <i className="fa-solid fa-file-csv text-2xl text-slate-300" aria-hidden="true" />
            <p className="text-sm font-bold text-slate-700 mt-2">העלו קובץ CSV</p>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              מתוך Google Sheets: קובץ ← הורדה ← CSV.
              <br />
              מתוך אקסל: קובץ ← שמירה בשם ← CSV.
            </p>
            <label className="inline-block mt-3">
              <input
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <span className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-600 hover:opacity-90 cursor-pointer inline-block">
                בחירת קובץ
              </span>
            </label>
          </div>

          <Labeled label="או הדביקו את הטבלה" hint="סמנו את התאים בגיליון והדביקו כאן">
            <textarea
              rows={5}
              className={inputClass}
              placeholder="הדביקו כאן — כולל שורת הכותרות"
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (text.trim()) { e.preventDefault(); ingest(text); }
              }}
            />
          </Labeled>

          {parseError && <p className="text-xs text-rose-600 font-bold">{parseError}</p>}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              נקראו <strong className="text-slate-800">{sheet.rows.length}</strong> שורות ו-
              <strong className="text-slate-800">{sheet.headers.length}</strong> עמודות.
            </p>
            <button
              onClick={() => { setSheet(null); setResult(null); }}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              החלפת קובץ
            </button>
          </div>

          <Labeled label="התאמת עמודות" hint="בדקו שהזיהוי האוטומטי נכון">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {IMPORT_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 w-32 shrink-0">
                    {f.label}
                    {f.required && <span className="text-rose-500"> *</span>}
                  </span>
                  <select
                    value={mapping[f.key] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                    className="border border-slate-200 text-xs rounded-lg p-1.5 bg-white flex-1 min-w-0"
                  >
                    <option value="">— לא לייבא —</option>
                    {sheet.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Labeled>

          {!!sheetPrincipleValues.length && (
            <Labeled
              label="שיוך לעקרונות"
              hint="לכל ערך שמופיע בעמודת העיקרון — לאילו עקרונות במערכת הוא מתאים"
            >
              <div className="space-y-2.5">
                {sheetPrincipleValues.map((value) => {
                  const count = drafts.filter(
                    (d, i) => (get(sheet.rows[i], 'principles') || '—') === value,
                  ).length;
                  const picked = principleMap[value] ?? [];
                  return (
                    <div
                      key={value}
                      className={`rounded-xl border p-2.5 ${
                        picked.length ? 'border-slate-200' : 'border-amber-200 bg-amber-50/50'
                      }`}
                    >
                      <p className="text-[11px] font-bold text-slate-700 mb-1.5">
                        {value === '—' ? '(שורות ללא ערך)' : value}
                        <span className="font-normal text-slate-400"> · {count} שורות</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {principles.map((p) => (
                          <Chip
                            key={p.id}
                            on={picked.includes(p.id)}
                            onClick={() =>
                              setPrincipleMap((m) => ({
                                ...m,
                                [value]: picked.includes(p.id)
                                  ? picked.filter((x) => x !== p.id)
                                  : [...picked, p.id],
                              }))
                            }
                          >
                            {p.title}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Labeled>
          )}

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600">תצוגה מקדימה</span>
              <span className="text-[11px] text-slate-500">
                {createCount} חדשות
                {updateCount > 0 && <span className="text-sky-700"> · {updateCount} עדכונים</span>}
                {dupCount > 0 && <span className="text-amber-700"> · {dupCount} דומות לקיימות</span>}
                {rowState.length > readyCount && (
                  <span className="text-rose-600"> · {rowState.length - readyCount} לא ייובאו</span>
                )}
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
              {rowState.map((s, i) => (
                <div key={i} className="px-3 py-2 flex items-start gap-2">
                  <i
                    className={`fa-solid mt-0.5 text-[10px] ${
                      !s.ready
                        ? 'fa-circle-xmark text-rose-400'
                        : s.match
                          ? 'fa-rotate text-sky-500'
                          : s.hits.length
                            ? 'fa-triangle-exclamation text-amber-500'
                            : 'fa-circle-check text-emerald-500'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">
                      {s.draft.title || <span className="text-slate-400">(ללא שם — לא תיובא)</span>}
                    </p>
                    {s.ready && s.match && (
                      <p className="text-[10px] text-sky-700">
                        מעדכנת פעילות קיימת
                        {s.match.title !== s.draft.title && ` — "${s.match.title}"`}
                      </p>
                    )}
                    {s.ambiguous && (
                      <p className="text-[10px] text-rose-600">
                        שם דו-משמעי — קיימות כבר שתי פעילויות בשם הזה. לא תיובא.
                      </p>
                    )}
                    {!s.ready && !s.ambiguous && s.draft.title && (
                      <p className="text-[10px] text-rose-600">לא שויך עיקרון — בחרו עיקרון ברירת מחדל.</p>
                    )}
                    {!!s.hits.length && (
                      <p className="text-[10px] text-amber-700">
                        דומה ל: {s.hits[0].item.title} ({Math.round(s.hits[0].score * 100)}%) — תיובא בכל זאת
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              ביטול
            </button>
            <button
              disabled={!readyCount || importing}
              onClick={runImport}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {importing
                ? 'מייבא…'
                : updateCount
                  ? `ייבוא — ${createCount} חדשות ו-${updateCount} עדכונים`
                  : `ייבוא ${createCount} פעילויות`}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

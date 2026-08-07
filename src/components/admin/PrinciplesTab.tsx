import React, { useEffect, useState } from 'react';
import { usePrinciples } from '../../lib/PrinciplesContext';
import { supabase } from '../../lib/supabase';
import { type useActivityBank } from '../../lib/activityBank';
import type { AdminViewer } from '../../lib/adminAuth';
import { principleTheme } from '../../lib/principleTheme';
import type { Principle, PrincipleMaturity } from '../../types';
import {
  countAssessedSchools,
  draftFromPrinciple,
  emptyPrincipleDraft,
  mappedByPhrase,
  movePrinciple,
  schoolsPhrase,
  setPrincipleActive,
  useAdminPrinciples,
  type PrincipleDraft,
  type PrincipleOrderRow,
} from '../../lib/principlesAdmin';
import { Section } from './AdminChrome';
import { ConfirmDialog } from './fields';
import { PrincipleEditor } from './PrincipleEditor';

interface Props {
  viewer: AdminViewer;
  onNotice: (text: string) => void;
  bank: ReturnType<typeof useActivityBank>;
}

/**
 * A school's own principle, read-only.
 *
 * The city admin may read it (`app.can_read_scoped` has a city_admin branch for school
 * scope) but may not write it — there is no city_admin branch on the school side of
 * `can_write_scoped`. So this shows content without a single edit control, and says so:
 * the value is knowing what schools are growing on their own, not governing it.
 */
const SchoolPrincipleViewer: React.FC<{
  principle: Principle;
  rubric?: PrincipleMaturity;
  schoolName: string;
  onClose: () => void;
}> = ({ principle, rubric, schoolName, onClose }) => {
  const colors = principleTheme(principle.colorName);

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[95] flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-xl w-full my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${colors.badge}`}>
              <i className={principle.icon} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-800">{principle.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {schoolName ? `${schoolName} · ` : ''}עיקרון ייחודי בית-ספרי
                {principle.shortLabel ? ` · על מפת העכביש: ${principle.shortLabel}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="סגירה"
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            עיקרון של בית ספר — לצפייה בלבד. רק בית הספר עצמו יכול לערוך או למחוק אותו.
          </p>

          {!!principle.shortSummary.trim() && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-600">תקציר</p>
              <p className="text-sm text-slate-700 leading-relaxed">{principle.shortSummary}</p>
            </div>
          )}

          {!!principle.rationale.trim() && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-600">הרציונל</p>
              <p className="text-sm text-slate-700 leading-relaxed text-justify">{principle.rationale}</p>
            </div>
          )}

          {!!rubric?.levels.length && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600">ארבע רמות הבשלות</p>
              {rubric.levels.map((l) => (
                <div key={l.level} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 font-mono font-bold text-xs grid place-items-center shrink-0">
                    {l.level}
                  </span>
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-bold text-slate-900">{l.name || `רמה ${l.level}`}</p>
                    {!!l.description.trim() && (
                      <p className="text-xs text-slate-600 leading-relaxed">{l.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * The municipal principle set: order, activation, and the door into the full editor.
 *
 * This deliberately does not reuse `PrincipleMenu`. That component is the school
 * journey's navigation — it needs assessment state (scores, answers) the admin never
 * has, renders only active principles, and has nowhere to put reorder arrows or an
 * active/retired badge. The canonical order and titles still come from the DB through
 * `usePrinciples()` / `useAdminPrinciples()`, which is what the shared-menu rule
 * actually protects.
 */
export const PrinciplesTab: React.FC<Props> = ({ viewer, onNotice, bank: bankState }) => {
  const { bank } = bankState;
  const { reload: reloadJourney } = usePrinciples();
  const { principles, rubrics, loading, reload } = useAdminPrinciples();

  const [editing, setEditing] = useState<PrincipleDraft | null>(null);
  const [assessed, setAssessed] = useState<Record<string, number>>({});
  const [confirmHide, setConfirmHide] = useState<Principle | null>(null);
  const [viewing, setViewing] = useState<Principle | null>(null);
  const [schoolNames, setSchoolNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    countAssessedSchools().then(setAssessed);
  }, [principles]);

  // Attribute each school-owned principle to its school. Read straight from the table —
  // `schools_select` already grants a city admin its own municipality, and routing through
  // `schoolsAdmin` would make this panel depend on the service-role endpoint, which may be
  // absent in dev.
  useEffect(() => {
    supabase
      .from('schools')
      .select('id, name')
      .then(({ data }) =>
        setSchoolNames(Object.fromEntries((data ?? []).map((s) => [s.id, s.name]))),
      );
  }, []);

  // Only municipal rows are ours to reorder — a school's own principle is readable
  // here for oversight but RLS refuses the write.
  const municipal = principles.filter((p) => p.scope === 'municipal');
  const orderRows: PrincipleOrderRow[] = municipal.map((p) => ({
    uuid: p.uuid,
    orderIndex: p.id,
    isActive: p.isActive,
  }));
  const active = municipal.filter((p) => p.isActive);
  const retired = municipal.filter((p) => !p.isActive);
  const schoolOwned = principles.filter((p) => p.scope !== 'municipal');

  const refresh = (message: string) => {
    onNotice(message);
    reload();       // the admin list, which includes retired rows
    reloadJourney(); // the header counters, the bank filter, the dashboard
  };

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) { onNotice(`הפעולה נכשלה: ${r.error}`); return false; }
    refresh(success);
    return true;
  };

  if (editing) {
    return (
      <PrincipleEditor
        viewer={viewer}
        initial={editing}
        assessedSchools={editing.uuid ? (assessed[editing.uuid] ?? 0) : 0}
        onCancel={() => setEditing(null)}
        onSaved={(message) => { setEditing(null); refresh(message); }}
      />
    );
  }

  const nextOrderIndex = Math.max(0, ...active.map((p) => p.id)) + 1;

  return (
    <>
      <Section
        icon="fa-solid fa-list-check"
        title="העקרונות העירוניים"
        subtitle="הסדר, השמות והתוכן שכל בתי הספר רואים — כולל הקריטריונים של האבחון."
        right={
          <button
            onClick={() => setEditing(emptyPrincipleDraft(nextOrderIndex))}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-primary-600 hover:opacity-90 transition-opacity shadow-sm cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-plus" />
            עיקרון חדש
          </button>
        }
      >
        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
          {loading && <p className="text-xs text-slate-400 text-center py-6">טוען…</p>}
          {active.map((p, i) => (
            <div key={p.uuid} className="p-3 flex items-center gap-2">
              <div className="flex flex-col shrink-0">
                <button
                  onClick={() => run(() => movePrinciple(p.uuid, -1, orderRows), 'סדר העקרונות עודכן.')}
                  disabled={i === 0 || busy}
                  aria-label={`הזזת ${p.title} למעלה`}
                  className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default p-0.5 cursor-pointer"
                >
                  <i className="fa-solid fa-chevron-up text-[10px]" />
                </button>
                <button
                  onClick={() => run(() => movePrinciple(p.uuid, 1, orderRows), 'סדר העקרונות עודכן.')}
                  disabled={i === active.length - 1 || busy}
                  aria-label={`הזזת ${p.title} למטה`}
                  className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default p-0.5 cursor-pointer"
                >
                  <i className="fa-solid fa-chevron-down text-[10px]" />
                </button>
              </div>

              <span
                className="w-8 h-8 rounded-lg grid place-items-center shrink-0"
                style={{ backgroundColor: `${p.accentColor}1a`, color: p.accentColor }}
              >
                <i className={`${p.icon} text-xs`} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{p.title}</p>
                <p className="text-[11px] text-slate-400">
                  תווית מקוצרת: {p.shortLabel || '—'} · {(bank[p.id] ?? []).length} פעילויות
                  {!!assessed[p.uuid] && ` · ${mappedByPhrase(assessed[p.uuid])}`}
                </p>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => setEditing(draftFromPrinciple(p, rubrics.find((r) => r.id === p.id)))}
                  title="עריכת העיקרון"
                  aria-label={`עריכת ${p.title}`}
                  className="text-slate-300 hover:text-primary-600 hover:bg-primary-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-pen-to-square text-xs" />
                </button>
                <button
                  onClick={() => setConfirmHide(p)}
                  disabled={active.length <= 1}
                  title={active.length <= 1 ? 'חייב להישאר עיקרון פעיל אחד לפחות' : 'הסתרה מבתי הספר'}
                  aria-label={`הסתרת ${p.title}`}
                  className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-default p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-eye-slash text-xs" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {!!retired.length && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-bold text-slate-400">
              מוסתרים מבתי הספר — הנתונים שנאספו עליהם נשמרו במלואם
            </p>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
              {retired.map((p) => (
                <div key={p.uuid} className="p-3 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-500">{p.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {assessed[p.uuid] ? `${mappedByPhrase(assessed[p.uuid])} בעבר` : 'איש לא מיפה אותו'}
                    </p>
                  </div>
                  <button
                    onClick={() => run(
                      () => setPrincipleActive(p.uuid, true, orderRows),
                      `"${p.title}" הוחזר לכל בתי הספר.`,
                    )}
                    disabled={busy}
                    className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg cursor-pointer shrink-0"
                  >
                    <i className="fa-solid fa-rotate-left ml-1.5 text-[10px]" aria-hidden="true" />
                    החזרה
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!!schoolOwned.length && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-bold text-slate-400">
              עקרונות בית-ספריים — לצפייה בלבד (עד שניים לכל בית ספר)
            </p>
            <div className="flex flex-wrap gap-2">
              {schoolOwned.map((p) => (
                <button
                  key={p.uuid}
                  type="button"
                  onClick={() => setViewing(p)}
                  title="עיקרון של בית ספר — רק הוא יכול לשנות אותו. לחצו לצפייה בתוכן."
                  className="text-xs font-bold px-3 py-1.5 rounded-full border bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 cursor-pointer"
                >
                  {schoolNames[p.schoolId ?? ''] ? `${schoolNames[p.schoolId!]} · ` : ''}
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>

      {viewing && (
        <SchoolPrincipleViewer
          principle={viewing}
          rubric={rubrics.find((r) => r.id === viewing.id)}
          schoolName={schoolNames[viewing.schoolId ?? ''] ?? ''}
          onClose={() => setViewing(null)}
        />
      )}

      {confirmHide && (
        <ConfirmDialog
          title="הסתרת עיקרון מבתי הספר"
          confirmLabel="הסתרה"
          tone="neutral"
          busy={busy}
          onConfirm={async () => {
            const ok = await run(
              () => setPrincipleActive(confirmHide.uuid, false, orderRows),
              `"${confirmHide.title}" הוסתר מבתי הספר.`,
            );
            if (ok) setConfirmHide(null);
          }}
          onCancel={() => setConfirmHide(null)}
        >
          <p>
            העיקרון <strong className="text-slate-800">{confirmHide.title}</strong> לא יופיע יותר
            במסע של אף בית ספר, ולא ייכלל בממוצעים העירוניים.
          </p>
          <p>
            {assessed[confirmHide.uuid]
              ? `${schoolsPhrase(assessed[confirmHide.uuid])} כבר ${assessed[confirmHide.uuid] === 1 ? 'מיפה את עצמו' : 'מיפו את עצמם'} מולו — הנתונים שלהם נשמרים במלואם ולא נמחקים.`
              : 'אף בית ספר לא מיפה את עצמו מולו עדיין.'}{' '}
            אין כאן מחיקה — אפשר להחזיר אותו בכל רגע.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
};

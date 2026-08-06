import React, { useEffect, useState } from 'react';
import { usePrinciples } from '../../lib/PrinciplesContext';
import { type useActivityBank } from '../../lib/activityBank';
import type { AdminViewer } from '../../lib/adminAuth';
import type { Principle } from '../../types';
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    countAssessedSchools().then(setAssessed);
  }, [principles]);

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
              עקרונות בית-ספריים — לצפייה בלבד
            </p>
            <div className="flex flex-wrap gap-2">
              {schoolOwned.map((p) => (
                <span
                  key={p.uuid}
                  title="עיקרון של בית ספר — רק הוא יכול לשנות אותו"
                  className="text-xs font-bold px-3 py-1.5 rounded-full border bg-amber-50 text-amber-700 border-amber-100"
                >
                  {p.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>

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

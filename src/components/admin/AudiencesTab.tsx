import React, { useEffect, useState } from 'react';
import { type useAudiences, type Audience } from '../../lib/audiences';
import {
  countAudienceUsage,
  createAudience,
  renameAudience,
  reorderAudiences,
  setAudienceActive,
  setAudienceOther,
  type AudienceUsage,
} from '../../lib/audiencesAdmin';
import type { AdminViewer } from '../../lib/adminAuth';
import { Section } from './AdminChrome';
import { ConfirmDialog, inputClass } from './fields';

interface Props {
  viewer: AdminViewer;
  onNotice: (text: string) => void;
  /** Held by AdminArea so the header counter refreshes with the list. */
  audiences: ReturnType<typeof useAudiences>;
}

/** Compact form for the list row. */
const usageText = (u?: AudienceUsage) => {
  if (!u || (!u.bank && !u.plans)) return 'לא בשימוש';
  const parts: string[] = [];
  if (u.bank) parts.push(`${u.bank} בבנק`);
  if (u.plans) parts.push(`${u.plans} בתוכניות`);
  return parts.join(' · ');
};

const activities = (n: number) => (n === 1 ? 'פעילות אחת' : `${n} פעילויות`);

/** Full sentence for the confirm dialog, where the admin is about to act on it. */
const usageSentence = (u?: AudienceUsage) => {
  if (!u || (!u.bank && !u.plans)) return 'אינו מופיע כרגע באף פעילות';
  const parts: string[] = [];
  if (u.bank) parts.push(`${activities(u.bank)} בבנק העירוני`);
  if (u.plans) parts.push(`${activities(u.plans)} בתוכניות בתי הספר`);
  return `מופיע כרגע ב${parts.join(' וב')}`;
};

/**
 * Manage the "קהל יעד" picklist: add, rename, reorder, mark the catch-all, retire.
 *
 * Retiring never deletes. The slugs live in `text[]` columns with no foreign key, so a
 * deleted audience would simply vanish from every plan that already carries it —
 * deactivation removes it from the pickers while the label keeps rendering.
 */
export const AudiencesTab: React.FC<Props> = ({ viewer, onNotice, audiences }) => {
  const { all, loading, reload } = audiences;
  const [usage, setUsage] = useState<Record<string, AudienceUsage>>({});
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [confirm, setConfirm] = useState<Audience | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    countAudienceUsage().then(setUsage);
  }, [all]);

  const active = all.filter((a) => a.isActive);
  const retired = all.filter((a) => !a.isActive);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) { onNotice(`הפעולה נכשלה: ${r.error}`); return false; }
    onNotice(success);
    reload();
    return true;
  };

  const add = async () => {
    const taken = new Set(all.map((a) => a.slug));
    const nextPosition = Math.max(0, ...all.map((a) => a.position)) + 1;
    const ok = await run(
      () => createAudience(newLabel, false, viewer, nextPosition, taken),
      `"${newLabel.trim()}" נוסף לרשימת קהלי היעד.`,
    );
    if (ok) setNewLabel('');
  };

  const saveRename = async (a: Audience) => {
    if (editingLabel.trim() === a.label) { setEditingId(null); return; }
    const ok = await run(
      () => renameAudience(a.id, editingLabel),
      'השם עודכן — הוא מופיע מעכשיו בכל הפעילויות הקיימות.',
    );
    if (ok) setEditingId(null);
  };

  const move = (a: Audience, delta: number) => {
    const i = active.findIndex((x) => x.id === a.id);
    const j = i + delta;
    if (j < 0 || j >= active.length) return;
    const next = [...active];
    [next[i], next[j]] = [next[j], next[i]];
    run(
      () => reorderAudiences(next.map((x, k) => ({ id: x.id, position: k + 1 }))),
      'סדר קהלי היעד עודכן.',
    );
  };

  const toggleOther = (a: Audience) =>
    run(
      () => setAudienceOther(a.id, !a.isOther, all.filter((x) => x.isOther).map((x) => x.id)),
      a.isOther ? `"${a.label}" אינו עוד קהל "אחר".` : `"${a.label}" מסומן כקהל "אחר" עם טקסט חופשי.`,
    );

  return (
    <>
      <Section
        icon="fa-solid fa-users"
        title="קהלי היעד"
        subtitle="הרשימה שממנה בוחרים קהל יעד — בבנק העירוני ובתוכניות בתי הספר. שינוי שם מתעדכן מיד בכל הפעילויות הקיימות."
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && newLabel.trim().length > 1 && add()}
            placeholder="שם קהל יעד חדש — למשל: הורים"
            className={`${inputClass} flex-1 min-w-[220px]`}
          />
          <button
            onClick={add}
            disabled={busy || newLabel.trim().length < 2}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-primary-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-plus" />
            הוספה
          </button>
        </div>

        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
          {loading && <p className="text-xs text-slate-400 text-center py-6">טוען…</p>}
          {active.map((a, i) => (
            <div key={a.id} className="p-3 flex items-center gap-2">
              <div className="flex flex-col shrink-0">
                <button
                  onClick={() => move(a, -1)}
                  disabled={i === 0 || busy}
                  aria-label={`הזזת ${a.label} למעלה`}
                  className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default p-0.5 cursor-pointer"
                >
                  <i className="fa-solid fa-chevron-up text-[10px]" />
                </button>
                <button
                  onClick={() => move(a, 1)}
                  disabled={i === active.length - 1 || busy}
                  aria-label={`הזזת ${a.label} למטה`}
                  className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default p-0.5 cursor-pointer"
                >
                  <i className="fa-solid fa-chevron-down text-[10px]" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                {editingId === a.id ? (
                  <input
                    autoFocus
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onBlur={() => saveRename(a)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRename(a);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className={inputClass}
                  />
                ) : (
                  <>
                    <p className="text-sm font-bold text-slate-800">
                      {a.label}
                      {a.isOther && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full mr-2">
                          אחר · עם טקסט חופשי
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400">{usageText(usage[a.slug])}</p>
                  </>
                )}
              </div>

              {editingId !== a.id && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => toggleOther(a)}
                    title={a.isOther ? 'ביטול הסימון כ"אחר"' : 'סימון כקהל "אחר" (פותח טקסט חופשי)'}
                    aria-label={`סימון ${a.label} כקהל אחר`}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      a.isOther ? 'text-indigo-600 bg-indigo-50' : 'text-slate-300 hover:text-indigo-600 hover:bg-indigo-50'
                    }`}
                  >
                    <i className="fa-solid fa-pen-nib text-xs" />
                  </button>
                  <button
                    onClick={() => { setEditingId(a.id); setEditingLabel(a.label); }}
                    title="שינוי השם"
                    aria-label={`שינוי השם של ${a.label}`}
                    className="text-slate-300 hover:text-primary-600 hover:bg-primary-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-pen-to-square text-xs" />
                  </button>
                  <button
                    onClick={() => setConfirm(a)}
                    title="הסרה מרשימת הבחירה"
                    aria-label={`הסרת ${a.label} מרשימת הבחירה`}
                    className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-eye-slash text-xs" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {!loading && !active.length && (
            <p className="text-xs text-slate-400 text-center py-6">אין קהלי יעד פעילים.</p>
          )}
        </div>

        {!!retired.length && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-bold text-slate-400">
              לא ברשימת הבחירה — עדיין מוצגים בפעילויות שכבר משויכות אליהם
            </p>
            <div className="flex flex-wrap gap-2">
              {retired.map((a) => (
                <button
                  key={a.id}
                  onClick={() => run(() => setAudienceActive(a.id, true), `"${a.label}" הוחזר לרשימת הבחירה.`)}
                  disabled={busy}
                  title="החזרה לרשימת הבחירה"
                  className="text-xs font-bold px-3 py-1.5 rounded-full border bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-700 cursor-pointer"
                >
                  <i className="fa-solid fa-rotate-left ml-1.5 text-[10px]" aria-hidden="true" />
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>

      {confirm && (
        <ConfirmDialog
          title="הסרת קהל יעד מרשימת הבחירה"
          confirmLabel="הסרה מהרשימה"
          tone="neutral"
          busy={busy}
          onConfirm={async () => {
            const ok = await run(
              () => setAudienceActive(confirm.id, false),
              `"${confirm.label}" הוסר מרשימת הבחירה.`,
            );
            if (ok) setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        >
          <p>
            <strong className="text-slate-800">{confirm.label}</strong> {usageSentence(usage[confirm.slug])}.
          </p>
          <p>
            הוא יוסר מרשימת הבחירה בבנק ובמתחם התכנון, אך <strong>ימשיך להופיע בפעילויות
            שכבר משויכות אליו</strong> ובמסמכים המיוצאים. אין כאן מחיקה — אפשר להחזיר אותו בכל רגע.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
};

import React, { useMemo, useState } from 'react';
import { usePrinciples } from '../../lib/PrinciplesContext';
import { audienceLabel, type useAudiences } from '../../lib/audiences';
import { type useActivityBank, type BankItem } from '../../lib/activityBank';
import { deleteActivity } from '../../lib/activityBankAdmin';
import type { AdminViewer } from '../../lib/adminAuth';
import { sourceMeta } from '../../planBank';
import { ActivityWizard } from '../ActivityWizard';
import { Section } from './AdminChrome';
import { ConfirmDialog } from './fields';

interface Props {
  viewer: AdminViewer;
  onNotice: (text: string) => void;
  /** Held by AdminArea so the header counters and every tab share one copy. */
  bank: ReturnType<typeof useActivityBank>;
  audiences: ReturnType<typeof useAudiences>;
}

/**
 * The municipal activity bank: search, filter, create, edit, remove.
 *
 * A school's own activities are listed for oversight but never editable here — RLS
 * would reject the write, so the UI doesn't offer a doomed action.
 */
export const BankTab: React.FC<Props> = ({ viewer, onNotice, bank: bankState, audiences }) => {
  const { principles } = usePrinciples();
  const { all: allAudiences } = audiences;
  const { bank, all: bankItems, loading, reload } = bankState;

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<BankItem | null>(null);
  const [query, setQuery] = useState('');
  const [principleFilter, setPrincipleFilter] = useState<number | 'all'>('all');
  const [confirmDelete, setConfirmDelete] = useState<BankItem | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = principleFilter === 'all' ? bankItems : (bank[principleFilter] ?? []);
    if (!q) return base;
    return base.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.short.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q),
    );
  }, [bankItems, bank, principleFilter, query]);

  const remove = async (item: BankItem) => {
    setBusy(true);
    const r = await deleteActivity(item.key);
    setBusy(false);
    setConfirmDelete(null);
    if (!r.ok) { onNotice(`המחיקה נכשלה: ${r.error}`); return; }
    onNotice(`"${item.title}" הוסרה מהבנק העירוני.`);
    reload();
  };

  return (
    <>
      <Section
        icon="fa-solid fa-layer-group"
        title="בנק הפעילויות העירוני"
        subtitle="הפעילויות שכל בתי הספר רואים במתחם התכנון."
        right={
          <button
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-primary-600 hover:opacity-90 transition-opacity shadow-sm cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-wand-magic-sparkles" />
            אשף הוספת פעילות
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <i className="fa-solid fa-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש פעילות…"
              className="w-full pr-8 p-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <select
            value={principleFilter}
            onChange={(e) => setPrincipleFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="p-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">כל העקרונות</option>
            {principles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({(bank[p.id] ?? []).length})
              </option>
            ))}
          </select>
        </div>

        <p className="text-[11px] text-slate-400">
          {loading ? 'טוען…' : `מוצגות ${filtered.length} מתוך ${bankItems.length} פעילויות`}
        </p>

        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
          {!loading && !filtered.length && (
            <p className="text-xs text-slate-400 text-center py-8">לא נמצאו פעילויות מתאימות.</p>
          )}
          {filtered.map((item) => {
            const th = sourceMeta(item.source);
            return (
              <div key={item.key} className="p-3.5 flex items-start gap-3">
                <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: th.accent }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm text-slate-800">{item.title}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${th.badge}`}>
                      {item.source}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.short}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {principles
                      .filter((p) => item.principles.includes(p.id))
                      .map((p) => (
                        <span
                          key={p.id}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                        >
                          {p.title}
                        </span>
                      ))}
                    {!!item.audiences.length && (
                      <span className="text-[10px] text-slate-400">
                        · {audienceLabel(item.audiences, item.audienceNote, allAudiences)}
                      </span>
                    )}
                  </div>
                </div>
                {item.scope === 'municipal' ? (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => setEditing(item)}
                      title="עריכת הפעילות"
                      aria-label={`עריכת ${item.title}`}
                      className="text-slate-300 hover:text-primary-600 hover:bg-primary-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <i className="fa-solid fa-pen-to-square text-xs" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(item)}
                      title="הסרה מהבנק"
                      aria-label={`הסרת ${item.title}`}
                      className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can text-xs" />
                    </button>
                  </div>
                ) : (
                  /* School-owned rows are visible to the city admin for oversight, but
                     only their own school may change them — don't offer a doomed action. */
                  <span
                    title="פעילות של בית ספר — לצפייה בלבד"
                    className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full shrink-0"
                  >
                    בית-ספרית
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {(wizardOpen || editing) && (
        <ActivityWizard
          viewer={viewer}
          existing={bankItems}
          editing={editing ?? undefined}
          onClose={() => { setWizardOpen(false); setEditing(null); }}
          onSaved={reload}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="הסרת פעילות מהבנק"
          confirmLabel="הסרה"
          busy={busy}
          onConfirm={() => remove(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        >
          <p>
            הפעילות <strong className="text-slate-800">{confirmDelete.title}</strong> תוסר מהבנק
            ולא תופיע יותר לבתי הספר. תוכניות שכבר הוסיפו אותה לא ייפגעו.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
};

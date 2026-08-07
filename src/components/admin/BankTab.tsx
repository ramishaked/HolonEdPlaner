import React, { useMemo, useState } from 'react';
import { usePrinciples } from '../../lib/PrinciplesContext';
import { audienceLabel, type useAudiences } from '../../lib/audiences';
import { type useActivityBank, type BankItem } from '../../lib/activityBank';
import { moveBankItem, setActivityActive } from '../../lib/activityBankAdmin';
import type { AdminViewer } from '../../lib/adminAuth';
import { sourceMeta } from '../../planBank';
import { downloadCsv, stampedName, NO_IMPORT_MARKER } from '../../lib/spreadsheet';
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
  const [confirmHide, setConfirmHide] = useState<BankItem | null>(null);
  const [busy, setBusy] = useState(false);

  // `bank` holds active items only; the hidden ones live in `all` and are listed apart.
  const active = useMemo(() => bankItems.filter((i) => i.isActive), [bankItems]);
  const hidden = useMemo(() => bankItems.filter((i) => !i.isActive), [bankItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = principleFilter === 'all' ? active : (bank[principleFilter] ?? []);
    if (!q) return base;
    return base.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.short.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q),
    );
  }, [active, bank, principleFilter, query]);

  /**
   * Ordering is only offered when the visible list IS the principle group being
   * ordered. Under a search, "swap with my neighbour" would write a rank that lands
   * the row somewhere the admin cannot see — better to withhold the control than to
   * move something invisibly.
   */
  const canReorder = principleFilter !== 'all' && !query.trim();

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) { onNotice(`הפעולה נכשלה: ${r.error}`); return false; }
    onNotice(success);
    reload();
    return true;
  };

  /**
   * Exports exactly what is on screen, so "give me principle 4" costs no extra UI.
   * The columns are the importer's columns — edit in Excel, import back, and matching
   * rows update in place instead of duplicating.
   */
  const exportCsv = () => {
    const municipal = filtered.filter((i) => i.scope === 'municipal');
    downloadCsv(
      stampedName('בנק-פעילויות'),
      [
        'מזהה', 'שם הפעולה', 'מטרת העל', 'הסבר קצר על הפעולה',
        'מדדי הצלחה ויעדים', 'למי פונים ברשות', 'מקור', 'עיקרון',
        `קהלי היעד ${NO_IMPORT_MARKER}`, `מצב ${NO_IMPORT_MARKER}`,
      ],
      municipal.map((i) => [
        i.slug, i.title, i.short, i.description, i.metrics, i.contact, i.source,
        principles.filter((p) => i.principles.includes(p.id)).map((p) => p.title).join(' · '),
        audienceLabel(i.audiences, i.audienceNote, allAudiences),
        i.isActive ? 'פעילה' : 'מוסתרת',
      ]),
    );
    onNotice(`${municipal.length} פעילויות יוצאו לגיליון.`);
  };

  const move = (item: BankItem, target: -1 | 1 | 'top') =>
    // `filtered` is the principle group in display order — exactly what the reorder
    // needs, which is why the controls only appear when that is true.
    run(() => moveBankItem(item.key, target, filtered), 'סדר הפעילויות עודכן.');

  return (
    <>
      <Section
        icon="fa-solid fa-layer-group"
        title="בנק הפעילויות העירוני"
        subtitle="הפעילויות שכל בתי הספר רואים במתחם התכנון."
        right={
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={exportCsv}
              title="ייצוא לגיליון (CSV)"
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-file-arrow-down" />
              ייצוא
            </button>
            <button
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-primary-600 hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
            >
              <i className="fa-solid fa-wand-magic-sparkles" />
              אשף הוספת פעילות
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש פעילות…"
              className="w-full pr-8 p-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Chips, not a dropdown: the whole principle set is 5–7 items, so every
              option fits on screen — and picking one is also what unlocks reordering,
              which a collapsed menu hides. Each chip carries its own count. */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="סינון לפי עיקרון">
            <button
              type="button"
              onClick={() => setPrincipleFilter('all')}
              aria-pressed={principleFilter === 'all'}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                principleFilter === 'all'
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              כל העקרונות
              <span className="font-normal opacity-70"> ({active.length})</span>
            </button>
            {principles.map((p) => {
              const on = principleFilter === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPrincipleFilter(on ? 'all' : p.id)}
                  aria-pressed={on}
                  style={
                    on
                      ? { backgroundColor: p.accentColor, borderColor: p.accentColor }
                      : { borderColor: `${p.accentColor}55`, color: p.accentColor }
                  }
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                    on ? 'text-white' : 'bg-white hover:brightness-95'
                  }`}
                >
                  {p.title}
                  <span className="font-normal opacity-70"> ({(bank[p.id] ?? []).length})</span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          {loading ? 'טוען…' : `מוצגות ${filtered.length} מתוך ${active.length} פעילויות`}
          {!loading && !canReorder && ' · לשינוי הסדר — בחרו עיקרון וסננו בלי חיפוש'}
          {!loading && canReorder && ' · הסדר כאן הוא הסדר שבתי הספר רואים'}
        </p>

        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
          {!loading && !filtered.length && (
            <p className="text-xs text-slate-400 text-center py-8">לא נמצאו פעילויות מתאימות.</p>
          )}
          {filtered.map((item, i) => {
            const th = sourceMeta(item.source);
            const orderable = canReorder && item.scope === 'municipal';
            return (
              <div key={item.key} className="p-3.5 flex items-start gap-3">
                {orderable && (
                  <div className="flex flex-col shrink-0 pt-0.5">
                    <button
                      onClick={() => move(item, -1)}
                      disabled={i === 0 || busy}
                      aria-label={`הזזת ${item.title} למעלה`}
                      className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default p-0.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-chevron-up text-[10px]" />
                    </button>
                    <button
                      onClick={() => move(item, 'top')}
                      disabled={i === 0 || busy}
                      title="לראש הרשימה"
                      aria-label={`העברת ${item.title} לראש הרשימה`}
                      className="text-slate-300 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-default p-0.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-angles-up text-[10px]" />
                    </button>
                    <button
                      onClick={() => move(item, 1)}
                      disabled={i === filtered.length - 1 || busy}
                      aria-label={`הזזת ${item.title} למטה`}
                      className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default p-0.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-chevron-down text-[10px]" />
                    </button>
                  </div>
                )}
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
                      onClick={() => setConfirmHide(item)}
                      title="הסתרה מבתי הספר"
                      aria-label={`הסתרת ${item.title}`}
                      className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <i className="fa-solid fa-eye-slash text-xs" />
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

        {!!hidden.length && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-bold text-slate-400">
              לא מוצגות לבתי הספר — תוכניות שכבר לקחו אותן לא נפגעו
            </p>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {hidden.map((item) => (
                <div key={item.key} className="p-3 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-500">{item.title}</p>
                    <p className="text-[11px] text-slate-400">{item.short}</p>
                  </div>
                  <button
                    onClick={() =>
                      run(() => setActivityActive(item.key, true), `"${item.title}" הוחזרה לבתי הספר.`)
                    }
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

      {confirmHide && (
        <ConfirmDialog
          title="הסתרת פעילות מבתי הספר"
          confirmLabel="הסתרה"
          tone="neutral"
          busy={busy}
          onConfirm={async () => {
            const ok = await run(
              () => setActivityActive(confirmHide.key, false),
              `"${confirmHide.title}" הוסתרה מבתי הספר.`,
            );
            if (ok) setConfirmHide(null);
          }}
          onCancel={() => setConfirmHide(null)}
        >
          <p>
            הפעילות <strong className="text-slate-800">{confirmHide.title}</strong> תרד מבנק
            הפעילויות ולא תוצע יותר לבתי הספר.
          </p>
          <p>
            תוכניות שכבר הוסיפו אותה לא ייפגעו, והתיעוד העירוני של מי שאימץ אותה נשמר.
            אין כאן מחיקה — אפשר להחזיר אותה בכל רגע.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
};

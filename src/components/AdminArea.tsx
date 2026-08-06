import React, { useMemo, useState } from 'react';
import { usePrinciples } from '../lib/PrinciplesContext';
import { useAudiences } from '../lib/audiences';
import { useActivityBank, type BankItem } from '../lib/activityBank';
import { deleteActivity } from '../lib/activityBankAdmin';
import type { AdminViewer } from '../lib/adminAuth';
import { sourceMeta } from '../planBank';
import { audienceLabel } from '../lib/audiences';
import { ActivityWizard } from './ActivityWizard';
import { MunicipalDashboard } from './MunicipalDashboard';

interface Props {
  viewer: AdminViewer;
  /** Logs the admin out of the application. */
  onExit: () => void;
}

/**
 * The municipal admin area — a screen of its own, not a panel inside a school's
 * settings. Everything here is city-wide: editing the activity bank changes what all
 * 43 schools see. The deliberately different chrome (dark header, indigo accents) is
 * the signal that this is no longer "my school's settings".
 */

const Section: React.FC<{
  icon: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, right, children }) => (
  <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-indigo-600 bg-indigo-50">
          <i className={`${icon} text-base`} />
        </span>
        <div>
          <h2 className="font-bold text-slate-900 leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
    {children}
  </section>
);

const Stat: React.FC<{ value: number | string; label: string }> = ({ value, label }) => (
  <div className="bg-white/10 rounded-xl px-4 py-2.5 text-center min-w-[86px]">
    <p className="text-xl font-bold text-white leading-none">{value}</p>
    <p className="text-[10px] text-white/60 mt-1">{label}</p>
  </div>
);

export const AdminArea: React.FC<Props> = ({ viewer, onExit }) => {
  const { principles } = usePrinciples();
  const { audiences } = useAudiences();
  const { bank, all: bankItems, loading, reload } = useActivityBank();

  // The dashboard is the landing view: an admin arrives asking "what's going on",
  // not "let me edit the bank".
  const [tab, setTab] = useState<'dashboard' | 'bank'>('dashboard');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [principleFilter, setPrincipleFilter] = useState<number | 'all'>('all');
  const [confirmDelete, setConfirmDelete] = useState<BankItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

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
    if (!r.ok) { setNotice(`המחיקה נכשלה: ${r.error}`); return; }
    setNotice(`"${item.title}" הוסרה מהבנק העירוני.`);
    reload();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 print:hidden" dir="rtl">
      {/* Deliberately unlike the school chrome — you are not in "my settings" here. */}
      <div className="bg-slate-900 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-lg shrink-0">
            <i className="fa-solid fa-user-shield" />
          </span>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-white leading-tight">מסך מנהל המערכת</h1>
            <p className="text-xs text-white/60 mt-0.5">
              ניהול עירוני — חולון · שינויים כאן משפיעים על כל בתי הספר
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Stat value={bankItems.length} label="פעילויות" />
          <Stat value={principles.length} label="עקרונות" />
          <Stat value={audiences.length} label="קהלי יעד" />
          <button
            onClick={onExit}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer mr-2"
          >
            <i className="fa-solid fa-right-from-bracket" />
            יציאה
          </button>
        </div>
      </div>

      <div className="flex gap-1.5">
        {([
          ['dashboard', 'fa-solid fa-chart-line', 'דשבורד עירוני'],
          ['bank', 'fa-solid fa-layer-group', 'ניהול הבנק'],
        ] as const).map(([key, icon, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              tab === key
                ? 'bg-white text-indigo-700 border border-indigo-100 shadow-sm'
                : 'text-slate-500 hover:bg-white/60'
            }`}
          >
            <i className={icon} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <MunicipalDashboard />}

      {notice && tab === 'bank' && (
        <div className="flex items-center justify-between gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
          <p className="text-xs font-bold text-indigo-800">{notice}</p>
          <button
            onClick={() => setNotice('')}
            aria-label="סגירת ההודעה"
            className="text-indigo-400 hover:text-indigo-700 cursor-pointer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {tab === 'bank' && (<>
      {/* ============ activity bank ============ */}
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
                        · {audienceLabel(item.audiences, item.audienceNote, audiences)}
                      </span>
                    )}
                  </div>
                </div>
                {item.scope === 'municipal' ? (
                  <button
                    onClick={() => setConfirmDelete(item)}
                    title="הסרה מהבנק"
                    aria-label={`הסרת ${item.title}`}
                    className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <i className="fa-solid fa-trash-can text-xs" />
                  </button>
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

      {/* ============ principles ============ */}
      <Section
        icon="fa-solid fa-list-check"
        title="העקרונות העירוניים"
        subtitle="הסדר והשמות שכל בתי הספר רואים. עריכה מהמסך תתווסף בהמשך — כרגע שינוי נעשה במיגרציה."
      >
        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
          {principles.map((p) => (
            <div key={p.id} className="p-3 flex items-center gap-3">
              <span
                className="w-7 h-7 rounded-lg grid place-items-center text-xs font-bold shrink-0"
                style={{ backgroundColor: `${p.accentColor}1a`, color: p.accentColor }}
              >
                {p.id}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{p.title}</p>
                <p className="text-[11px] text-slate-400">תווית מקוצרת: {p.shortLabel || '—'}</p>
              </div>
              <span className="text-[11px] text-slate-500 shrink-0">
                {(bank[p.id] ?? []).length} פעילויות
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ============ audiences ============ */}
      <Section
        icon="fa-solid fa-users"
        title="קהלי היעד"
        subtitle="הרשימה שממנה בוחרים קהל יעד — בבנק ובתוכניות בתי הספר."
      >
        <div className="flex flex-wrap gap-2">
          {audiences.map((a) => (
            <span
              key={a.slug}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                a.isOther
                  ? 'bg-slate-50 text-slate-500 border-slate-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-100'
              }`}
            >
              {a.label}
              {a.isOther && <span className="font-normal"> · עם טקסט חופשי</span>}
            </span>
          ))}
        </div>
      </Section>

      <p className="text-[11px] text-slate-400 text-center pb-2">
        טרם נבנה במסך זה: עריכת עקרונות, ניהול סיסמאות פר בית ספר, וגרסאות תוכנית.
      </p>
      </>)}

      {wizardOpen && (
        <ActivityWizard
          viewer={viewer}
          existing={bankItems}
          onClose={() => setWizardOpen(false)}
          onSaved={reload}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 p-6 space-y-4 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900">הסרת פעילות מהבנק</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              הפעילות <strong className="text-slate-800">{confirmDelete.title}</strong> תוסר מהבנק
              ולא תופיע יותר לבתי הספר. תוכניות שכבר הוסיפו אותה לא ייפגעו.
            </p>
            <div className="flex gap-2.5 justify-end">
              <button
                disabled={busy}
                onClick={() => remove(confirmDelete)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'מוחק…' : 'הסרה'}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

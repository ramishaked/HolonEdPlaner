import React, { useMemo } from 'react';
import { usePrinciples } from '../lib/PrinciplesContext';
import { useActivityBank } from '../lib/activityBank';
import { useMunicipalStats, STAGE_LABEL, type SchoolStage } from '../lib/municipalStats';
import { RadarChart } from './RadarChart';

/**
 * The municipal picture: who is working, where the city stands, what it is aiming at,
 * and which of the bank's activities schools actually took.
 *
 * Every average is reported with the number of schools behind it. A principle nobody
 * mapped shows "—", never a score — the journey's 1.0 default for an unmapped principle
 * is a display convenience and would read as real weakness if averaged.
 */

const STAGE_STYLE: Record<SchoolStage, { dot: string; text: string; bg: string }> = {
  not_started: { dot: 'bg-slate-300', text: 'text-slate-600', bg: 'bg-slate-50' },
  mapping: { dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' },
  mapped: { dot: 'bg-sky-400', text: 'text-sky-700', bg: 'bg-sky-50' },
  planning: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
};

const STAGE_ORDER: SchoolStage[] = ['planning', 'mapped', 'mapping', 'not_started'];

const Panel: React.FC<{ icon: string; title: string; subtitle?: string; children: React.ReactNode }> = ({
  icon, title, subtitle, children,
}) => (
  <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
    <div className="flex items-start gap-3">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-indigo-600 bg-indigo-50">
        <i className={`${icon} text-base`} />
      </span>
      <div>
        <h2 className="font-bold text-slate-900 leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
);

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) : '—';

export const MunicipalDashboard: React.FC<{ bank: ReturnType<typeof useActivityBank> }> = ({
  bank,
}) => {
  const { principles, orderToId } = usePrinciples();
  // Held by AdminArea, hidden items included — see uptakeNamed for why that matters.
  const { all: bankItems } = bank;

  const idToOrder = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [order, uuid] of Object.entries(orderToId)) map[uuid] = Number(order);
    return map;
  }, [orderToId]);

  const principleIds = useMemo(() => principles.map((p) => p.id), [principles]);
  const { stats, loading } = useMunicipalStats(idToOrder, principleIds);

  const titleOf = (id: number) => principles.find((p) => p.id === id)?.title ?? `עיקרון ${id}`;

  // The city radar uses the same component the schools see, fed with city averages.
  const cityScores = useMemo(() => {
    const out: Record<number, number> = {};
    for (const s of stats?.byPrinciple ?? []) if (s.average !== null) out[s.principleId] = s.average;
    return out;
  }, [stats]);

  const uptakeNamed = useMemo(() => {
    // Hidden items are named here on purpose: an activity the city retired was still
    // adopted by N schools, and dropping it would quietly rewrite that history.
    const byKey = new Map(bankItems.map((i) => [i.key, i]));
    const taken = (stats?.uptake ?? [])
      .map((u) => ({ ...u, item: byKey.get(u.bankKey) }))
      .filter((u) => u.item);
    const takenKeys = new Set(taken.map((t) => t.bankKey));
    // "Nobody picked it" is a call to action, so only offerable activities belong here.
    const untouched = bankItems.filter((i) => i.isActive && !takenKeys.has(i.key));
    return { taken, untouched };
  }, [stats, bankItems]);

  if (loading || !stats) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-slate-300" aria-label="טוען" />
      </div>
    );
  }

  const totalSchools = stats.schools.length;
  const started = totalSchools - stats.stageCounts.not_started;

  return (
    <div className="space-y-6">
      {/* ============ who is working ============ */}
      <Panel
        icon="fa-solid fa-school-flag"
        title="מי עובד במערכת"
        subtitle={`${started} מתוך ${totalSchools} בתי ספר התחילו לעבוד.`}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {STAGE_ORDER.map((stage) => {
            const st = STAGE_STYLE[stage];
            return (
              <div key={stage} className={`rounded-xl p-3 ${st.bg}`}>
                <p className={`text-2xl font-bold ${st.text} leading-none`}>{stats.stageCounts[stage]}</p>
                <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                  {STAGE_LABEL[stage]}
                </p>
              </div>
            );
          })}
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-[11px] text-slate-500">
                  <th className="font-bold p-2.5">בית הספר</th>
                  <th className="font-bold p-2.5">סטטוס</th>
                  <th className="font-bold p-2.5">מופו</th>
                  <th className="font-bold p-2.5">פעילויות</th>
                  <th className="font-bold p-2.5">ציון ממוצע</th>
                  <th className="font-bold p-2.5">עודכן</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...stats.schools]
                  .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.name.localeCompare(b.name, 'he'))
                  .map((s) => {
                    const st = STAGE_STYLE[s.stage];
                    return (
                      <tr key={s.id} className="text-xs">
                        <td className="p-2.5 font-bold text-slate-700">{s.name}</td>
                        <td className="p-2.5">
                          <span className={`inline-flex items-center gap-1.5 ${st.text}`}>
                            <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                            {STAGE_LABEL[s.stage]}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-500 font-mono">{s.mapped}/{principleIds.length}</td>
                        <td className="p-2.5 text-slate-500 font-mono">{s.activities || '—'}</td>
                        <td className="p-2.5 text-slate-700 font-mono font-bold">
                          {s.averageScore === null ? '—' : s.averageScore.toFixed(1)}
                        </td>
                        <td className="p-2.5 text-slate-400">{fmtDate(s.updatedAt)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>

      {/* ============ city maturity ============ */}
      <Panel
        icon="fa-solid fa-chart-area"
        title="תמונת הבשלות העירונית"
        subtitle="ממוצע לכל עיקרון — מחושב רק על בתי ספר שמיפו אותו בפועל."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {Object.keys(cityScores).length ? (
            <RadarChart scores={cityScores} />
          ) : (
            <p className="text-xs text-slate-400 py-12 text-center">אין עדיין מיפויים להצגה.</p>
          )}

          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
            {stats.byPrinciple.map((s) => (
              <div key={s.principleId} className="p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs font-bold text-slate-700">{titleOf(s.principleId)}</p>
                  <p className="text-sm font-bold text-slate-900 font-mono shrink-0">
                    {s.average === null ? '—' : s.average.toFixed(1)}
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {s.schools ? (
                    <>
                      {s.schools} בתי ספר · טווח {s.min!.toFixed(1)}–{s.max!.toFixed(1)}
                    </>
                  ) : (
                    'אף בית ספר לא מיפה עיקרון זה'
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* ============ focus ============ */}
      <Panel
        icon="fa-solid fa-crosshairs"
        title="במה בתי הספר בוחרים להתמקד"
        subtitle="עוגן עוצמה מול יעד פריצת דרך — לאן העיר מכוונת."
      >
        <div className="space-y-2.5">
          {stats.byPrinciple.map((s) => {
            const max = Math.max(1, ...stats.byPrinciple.map((x) => Math.max(x.strengthPicks, x.breakthroughPicks)));
            return (
              <div key={s.principleId} className="space-y-1">
                <p className="text-xs font-bold text-slate-700">{titleOf(s.principleId)}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-700 w-20 shrink-0">עוגן עוצמה</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(s.strengthPicks / max) * 100}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 w-6 text-left">{s.strengthPicks}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-indigo-700 w-20 shrink-0">פריצת דרך</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${(s.breakthroughPicks / max) * 100}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 w-6 text-left">{s.breakthroughPicks}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* ============ bank uptake ============ */}
      <Panel
        icon="fa-solid fa-arrow-trend-up"
        title="אילו פעילויות נלקחו מהבנק"
        subtitle={`${stats.totalActivities} פעילויות בתוכניות, מתוכן ${stats.customActivities} יוזמות ייחודיות של בתי ספר.`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-bold text-slate-500 mb-2">הנבחרות ביותר</p>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {!uptakeNamed.taken.length && (
                <p className="text-xs text-slate-400 text-center py-6">אף פעילות מהבנק לא נלקחה עדיין.</p>
              )}
              {uptakeNamed.taken.map((u) => (
                <div key={u.bankKey} className="p-2.5 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-700 truncate">
                    {u.item!.title}
                    {!u.item!.isActive && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full mr-1.5">
                        מוסתרת
                      </span>
                    )}
                  </p>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                    {u.schools} בתי ספר
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-500 mb-2">
              אף אחד לא בחר ({uptakeNamed.untouched.length})
            </p>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {!uptakeNamed.untouched.length && (
                <p className="text-xs text-slate-400 text-center py-6">כל פעילויות הבנק נלקחו לפחות פעם אחת.</p>
              )}
              {uptakeNamed.untouched.map((i) => (
                <div key={i.key} className="p-2.5">
                  <p className="text-xs text-slate-600 truncate">{i.title}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              פעילות שאיש לא בוחר לאורך זמן שווה בדיקה — ניסוח, רלוונטיות או נראות בבנק.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
};

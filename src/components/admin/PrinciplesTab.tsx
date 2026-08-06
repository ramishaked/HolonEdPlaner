import React from 'react';
import { usePrinciples } from '../../lib/PrinciplesContext';
import { type useActivityBank } from '../../lib/activityBank';
import { Section } from './AdminChrome';

/**
 * The municipal principle set. Read-only for now — editing, ordering and
 * deactivation land in the next step.
 *
 * This does not reuse `PrincipleMenu`: that component is the school journey's
 * navigation and needs assessment state (scores, answers) the admin never has, and it
 * shows only active principles. The canonical order and titles still come from
 * `usePrinciples()`, which is what the shared-menu rule is actually protecting.
 */
export const PrinciplesTab: React.FC<{ bank: ReturnType<typeof useActivityBank> }> = ({
  bank: bankState,
}) => {
  const { principles } = usePrinciples();
  const { bank } = bankState;

  return (
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
  );
};

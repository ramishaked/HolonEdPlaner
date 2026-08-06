import React from 'react';
import { useAudiences } from '../../lib/audiences';
import { Section } from './AdminChrome';

/** The "קהל יעד" picklist. Read-only for now — management lands in the next step. */
export const AudiencesTab: React.FC = () => {
  const { audiences } = useAudiences();

  return (
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
  );
};

import React from 'react';
import { Principle } from '../types';
import { Collapsible } from './Collapsible';

interface PrincipleDetailViewProps {
  principle: Principle;
  scores: { [key: number]: number };
  /** Whether this principle has been mapped yet. Drives the maturity badge. */
  assessed?: boolean;
}

// Pure content panel for one principle. Selection/navigation is handled by the
// principle list in OrientView — this component just renders the chosen principle.
export const PrincipleDetailView: React.FC<PrincipleDetailViewProps> = ({
  principle,
  scores,
  assessed = false,
}) => {
  const currentScore = scores[principle.id] || 1;

  // Color helper lookup for beautiful visual borders and icons
  const getThemeColors = (colorName: string) => {
    switch (colorName) {
      case 'purple':
        return {
          bg: 'bg-purple-50/50',
          border: 'border-ai/30',
          text: 'text-ai',
          accent: 'bg-ai',
          accentText: 'text-ai',
          glow: 'shadow-purple-100',
          badge: 'bg-purple-100/60 text-ai font-bold'
        };
      case 'blue':
        return {
          bg: 'bg-blue-50/50',
          border: 'border-holistic/30',
          text: 'text-holistic',
          accent: 'bg-holistic',
          accentText: 'text-holistic',
          glow: 'shadow-blue-100',
          badge: 'bg-blue-100/60 text-holistic font-bold'
        };
      case 'orange':
        return {
          bg: 'bg-orange-50/50',
          border: 'border-maker/30',
          text: 'text-maker',
          accent: 'bg-maker',
          accentText: 'text-maker',
          glow: 'shadow-orange-100',
          badge: 'bg-orange-100/60 text-maker font-bold'
        };
      case 'cyan':
        return {
          bg: 'bg-cyan-50/50',
          border: 'border-byod/30',
          text: 'text-byod',
          accent: 'bg-byod',
          accentText: 'text-byod',
          glow: 'shadow-cyan-100',
          badge: 'bg-cyan-100/60 text-byod font-bold'
        };
      case 'emerald':
        return {
          bg: 'bg-emerald-50/50',
          border: 'border-skills/30',
          text: 'text-skills',
          accent: 'bg-skills',
          accentText: 'text-skills',
          glow: 'shadow-emerald-100',
          badge: 'bg-emerald-100/60 text-skills font-bold'
        };
      case 'indigo':
        return {
          bg: 'bg-primary-50/50',
          border: 'border-spaces/30',
          text: 'text-spaces',
          accent: 'bg-spaces',
          accentText: 'text-spaces',
          glow: 'shadow-primary-100',
          badge: 'bg-primary-100/60 text-spaces font-bold'
        };
      case 'rose':
        return {
          bg: 'bg-rose-50/50',
          border: 'border-human/30',
          text: 'text-human',
          accent: 'bg-human',
          accentText: 'text-human',
          glow: 'shadow-rose-100',
          badge: 'bg-rose-100/60 text-human font-bold'
        };
      default:
        return {
          bg: 'bg-slate-50',
          border: 'border-slate-200',
          text: 'text-slate-700',
          accent: 'bg-slate-600',
          accentText: 'text-slate-700',
          glow: 'shadow-slate-100',
          badge: 'bg-slate-100 text-slate-700 font-bold'
        };
    }
  };

  const colors = getThemeColors(principle.colorName);

  return (
    <div className="space-y-8 animate-fade-in text-[#0f172a]">
      {/* Main Principle Header Card — light surface with a principle-colored accent edge */}
      <div
        className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 border-r-8"
        style={{ borderRightColor: principle.accentColor }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start md:items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${colors.badge} text-xl font-bold p-3 overflow-hidden`}>
              <i className={principle.icon}></i>
            </div>
            <div className="space-y-1 text-right">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: principle.accentColor }}>עמוד השדרה הפדגוגי והארגוני - עיקרון {principle.id}</span>
              <h2 className="text-xl md:text-3xl font-bold tracking-tight text-slate-900">{principle.title}</h2>
            </div>
          </div>

          <div className="bg-slate-50 px-4 py-2 rounded-xl text-center border border-slate-200 shrink-0">
            <span className="block text-xs text-slate-500 font-bold uppercase">שיוך רמת בשלות נוכחית</span>
            {assessed ? (
              <span className="text-lg font-mono font-bold text-primary-700">רמה {currentScore.toFixed(1)}</span>
            ) : (
              <span className="text-sm font-bold text-slate-400">טרם בוצע מיפוי</span>
            )}
          </div>
        </div>
      </div>

      {/* Structured detailed content (full width — informational only) */}
      <div className="space-y-8">
        <div className="space-y-8">
          
          {/* 1. Rationale and Vision */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-50 pb-3">
              <span className={`w-2 h-6 rounded ${colors.accent}`}></span>
               הרציונל הפדגוגי-ארגוני והחזון (&quot;לשם מה?&quot;)
            </h3>
            <p className="text-sm md:text-base text-slate-700 leading-relaxed text-slate-800 text-justify">
              {principle.rationale}
            </p>
          </div>

          {/* 2. Gaps Solved & Added Value (Bento Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-base flex items-center gap-1.5 text-rose-700">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>אילו פערים העיקרון פותר?</span>
              </h4>
              <ul className="space-y-3">
                {principle.gapsSolved.map((gap, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-2 leading-relaxed">
                    <span className="p-1 bg-rose-50 rounded-full text-rose-500 mt-0.5 shrink-0 text-[10px] font-bold">
                      <i className="fa-solid fa-xmark"></i>
                    </span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-base flex items-center gap-1.5 text-emerald-700">
                <i className="fa-solid fa-circle-check"></i>
                <span>הערך המוסף בארגון</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {principle.addedValue}
              </p>
            </div>

          </div>

          {/* 3. Implementation Strategy & Routines (collapsed by default) */}
          <Collapsible title='אסטרטגיית היישום והסדירויות הארגוניות ("האיך")' icon="fa-solid fa-list-check">
            <div className="space-y-4">
              {principle.implementationStrategy.map((step, idx) => (
                <div key={idx} className="flex gap-4 items-start bg-slate-50/50 p-3 rounded-xl border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <p className="text-xs md:text-sm text-slate-700 leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </Collapsible>

          {/* 4. Sacrifices Required & Ecosystem Partnerships */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-amber-50/40 rounded-xl p-6 border border-amber-100 shadow-sm space-y-3">
              <h4 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                <i className="fa-solid fa-shield-halved"></i>
                <span>הוויתורים הנדרשים (מה מפסיקים לעשות?)</span>
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                {principle.sacrificesRequired}
              </p>
            </div>

            <div className="bg-teal-50/40 rounded-xl p-6 border border-teal-100 shadow-sm space-y-3">
              <h4 className="font-bold text-teal-950 text-sm flex items-center gap-1.5">
                <i className="fa-solid fa-people-group"></i>
                <span>שותפויות באקו-סיסטם הקהילתי</span>
              </h4>
              <p className="text-xs text-teal-800 leading-relaxed font-medium">
                {principle.ecosystemPartnerships}
              </p>
            </div>

          </div>

          {/* 5. Metrics & KPIs */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2">
              <i className="fa-solid fa-gauge text-primary-500 text-sm"></i>
              מדדי הצלחה מרכזיים (KPIs) לשילוב בתוכנית העבודה
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {principle.kpis.map((kpi, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
                  <span className="text-xs uppercase font-bold text-slate-400">מדד הצלחה {i + 1}</span>
                  <span className="text-xs font-semibold text-slate-800 leading-normal">{kpi}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 6. Concrete Outputs & First Step for Sept 1st */}
          <div className="bg-gradient-to-br from-primary-50 to-primary-100/40 rounded-2xl p-6 border border-primary-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-primary-950 flex items-center gap-2 border-b border-primary-100 pb-2">
              <i className="fa-solid fa-bullseye text-primary-600"></i>
              תוצרים בשטח וצעד ראשון לאחד בספטמבר (&quot;המה&quot;)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/80 p-4 rounded-xl border border-primary-200/40 space-y-1">
                <span className="inline-block px-2 py-0.5 rounded bg-primary-100 text-primary-700 text-xs font-bold">תוצר המורה (בסוף השנה)</span>
                <p className="text-xs text-slate-700 leading-normal font-medium">{principle.teacherDeliverable}</p>
              </div>

              <div className="bg-white/80 p-4 rounded-xl border border-primary-200/40 space-y-1">
                <span className="inline-block px-2 py-0.5 rounded bg-primary-100 text-primary-700 text-xs font-bold">תוצר התלמיד (בסוף השנה)</span>
                <p className="text-xs text-slate-700 leading-normal font-medium">{principle.studentDeliverable}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-primary-200/80 mt-2 space-y-1 shadow-sm">
              <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-bold">
                🚀 הצעד הראשון המעשי ל-1 בספטמבר
              </span>
              <p className="text-xs md:text-sm text-slate-800 font-bold leading-normal">{principle.firstStep}</p>
            </div>
          </div>

          {/* 7. Deepening Sources & Bibliographic Material (collapsed by default) */}
          <Collapsible title="נספח עומק, למידת עמיתים ומקורות דעת מקצועיים" icon="fa-solid fa-book-bookmark">
            <div className="space-y-4">
              {principle.sources.map((src, i) => (
                <div key={i} className="p-4 rounded-xl border border-slate-50 bg-slate-50/40 hover:bg-slate-50 transition-colors space-y-1.5 text-right">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1">
                      <i className="fa-solid fa-link text-xs text-slate-400"></i>
                      <span>{src.title}</span>
                    </span>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-500 hover:text-primary-700 font-bold underline flex items-center gap-0.5"
                    >
                      <span>כניסה לאתר</span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </a>
                  </div>
                  <p className="text-xs text-slate-600 leading-normal">{src.description}</p>
                  <div className="text-xs text-slate-400 font-mono">
                    <strong>נתיב חיפוש ומילות מפתח:</strong> {src.keywords}
                  </div>
                </div>
              ))}
            </div>
          </Collapsible>

        </div>

      </div>
    </div>
  );
};
